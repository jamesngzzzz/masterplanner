import { fetchLatestActiveEvalSessionByProfile, createEvalSession, patchEvalSessionQuiet } from "./evalSession";
import { fetchMem0Memories } from "./mem0";
import createApiClient from "@/lib/axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const api = createApiClient(API_BASE);

export const runFullOrchestrationPipeline = async (
  profileId: string,
  phone: string,
  profileName: string,
  onProgress?: (step: string, progress: number) => void,
  options?: { allowEmptyMemories?: boolean; forceRefresh?: boolean }
) => {
  try {
    onProgress?.("Đang kiểm tra dữ liệu hiện tại...", 10);
    // 1. Check existing session
    let session = await fetchLatestActiveEvalSessionByProfile(profileId);
    let sessionId: string | null = session?.session?.id || null;
    let data = session?.session?.data || {};

    if (!options?.forceRefresh && session?.session && data.weekly_plan && data.memory_analysis) {
      onProgress?.("Hoàn tất!", 100);
      return { fromCache: true, data };
    }

    // 2. Initialize session if not exists
    if (!sessionId) {
      onProgress?.("Khởi tạo tiến trình đánh giá mới...", 20);
      const newSession = await createEvalSession({ phone, profile_id: profileId, profile_name: profileName });
      sessionId = newSession.id;
    }

    // 3. Fetch Memories
    onProgress?.("Đang lấy dữ liệu hội thoại từ Pika...", 30);
    const memories = await fetchMem0Memories(profileId);
    
    if (!memories || memories.length === 0) {
      if (options?.allowEmptyMemories) {
        onProgress?.("Không có memories — thử sinh kế hoạch mẫu...", 45);
      } else {
        throw new Error("Không có dữ liệu hội thoại cho bé này.");
      }
    }

    // 4. Run Memory Analysis
    onProgress?.("Đang phân tích tính cách và mức độ tiếng Anh...", 50);
    await patchEvalSessionQuiet(sessionId, { current_step: "analyzing_memory" });
    const analysisRes = await api.post("/api/analyze/memory", {
      profile_id: profileId,
      profile_name: profileName,
      memories: memories,
    });
    const memoryAnalysis = analysisRes.data;

    await patchEvalSessionQuiet(sessionId, {
      current_step: "generating_plan",
      patch: { memory_analysis: memoryAnalysis, raw_memories: memories },
      append_llm: {
        api: "analyze_memory",
        model_id: memoryAnalysis.model_id,
        input_tokens: memoryAnalysis.input_tokens,
        output_tokens: memoryAnalysis.output_tokens,
        cost_usd: memoryAnalysis.cost_usd,
        duration_seconds: 0
      }
    });

    // 5. Run Weekly Plan Generation
    onProgress?.("Đang xây dựng lộ trình học cá nhân hóa...", 80);
    // Determine the format expected by weekly plan API. Assuming it expects memory analysis in body
    const planRes = await api.post("/api/analyze/generate-plan", {
      profile_id: profileId,
      profile_name: profileName,
      memory_analysis: memoryAnalysis.parsed,
    });
    const weeklyPlan = planRes.data;

    // 6. Complete and patch
    onProgress?.("Hoàn tất!", 100);
    await patchEvalSessionQuiet(sessionId, {
      current_step: "completed",
      patch: { weekly_plan: weeklyPlan },
      append_llm: {
        api: "weekly_plan",
        model_id: weeklyPlan.model_id || "gpt-4o",
        input_tokens: weeklyPlan.input_tokens || 0,
        output_tokens: weeklyPlan.output_tokens || 0,
        cost_usd: weeklyPlan.cost_usd || 0,
        duration_seconds: 0
      }
    });

    // 7. Sync file cache so /memory and /planner pages see fresh data immediately
    //    (fire-and-forget — don't block pipeline completion on this)
    fetch(`${API_BASE}/api/planner/memory/process?dataset=${encodeURIComponent(profileId)}`, {
      method: "POST",
    }).catch((e) => console.warn("[pipeline] Cache sync failed (non-critical):", e));

    return {
      fromCache: false,
      data: { memory_analysis: memoryAnalysis, weekly_plan: weeklyPlan }
    };

  } catch (error: any) {
    console.error("Pipeline failed:", error);
    throw new Error(error?.message || "Quá trình phân tích thất bại.");
  }
};
