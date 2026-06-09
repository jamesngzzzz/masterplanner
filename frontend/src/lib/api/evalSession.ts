import createApiClient from "@/lib/axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const api = createApiClient(API_BASE);

export interface EvalSessionDetail {
  id: string;
  created_at: string;
  updated_at: string;
  phone: string;
  profile_id: string;
  profile_name: string;
  current_step: string;
  data: Record<string, any>;
  totals: Record<string, any>;
}

export const fetchLatestActiveEvalSessionByProfile = async (
  profile_id: string
): Promise<{ session: EvalSessionDetail | null }> => {
  const { data } = await api.get("/api/eval-sessions/latest-active/by-profile", {
    params: { profile_id },
  });
  return data;
};

export const createEvalSession = async (payload: {
  phone: string;
  profile_id: string;
  profile_name: string;
}) => {
  const { data } = await api.post("/api/eval-sessions", payload);
  return data;
};

export const patchEvalSessionQuiet = async (
  session_id: string | null,
  payload: {
    current_step?: string;
    patch?: Record<string, any>;
    append_llm?: Record<string, any>;
  }
) => {
  if (!session_id) return null;
  
  // Transform payload to match backend EvalSessionPatch
  const body = {
    current_step: payload.current_step,
    data: payload.patch, // assuming patch contains the updated data
  };

  const { data } = await api.post(`/api/eval-sessions/${session_id}/update`, body);
  return data;
};
