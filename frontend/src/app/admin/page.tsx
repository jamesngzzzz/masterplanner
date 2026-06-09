"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface EvalSession {
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

const STEP_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  loading_profile:  { label: "Khởi tạo",       color: "bg-slate-100 text-slate-500",    icon: "⏳" },
  analyzing_memory: { label: "Phân tích ký ức", color: "bg-blue-100 text-blue-700",      icon: "🔍" },
  generating_plan:  { label: "Sinh kế hoạch",   color: "bg-purple-100 text-purple-700",  icon: "📋" },
  completed:        { label: "Hoàn tất",         color: "bg-green-100 text-green-700",    icon: "✅" },
  error:            { label: "Lỗi",             color: "bg-red-100 text-red-700",        icon: "❌" },
};

export default function AdminPage() {
  const [sessions, setSessions] = useState<EvalSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<EvalSession | null>(null);
  const [runProfileId, setRunProfileId] = useState("");
  const [runPhone, setRunPhone] = useState("");
  const [runName, setRunName] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"run" | "sessions">("run");
  const router = useRouter();

  const applyToUX = (s: EvalSession, e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate exactly as the user would — all pages load from ?dataset=profile_id naturally
    router.push(`/dashboard?dataset=${s.profile_id}`);
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/eval-sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRun = async () => {
    if (!runProfileId.trim()) return;
    setRunning(true);
    setRunError(null);
    setRunStatus("Đang khởi động pipeline...");
    setRunProgress(5);
    try {
      const { runFullOrchestrationPipeline } = await import("@/lib/api/pipeline");
      await runFullOrchestrationPipeline(
        runProfileId.trim(),
        runPhone.trim(),
        runName.trim(),
        (status, progress) => {
          setRunStatus(status);
          setRunProgress(progress);
        },
        { forceRefresh }
      );
      setRunStatus("✅ Hoàn tất!");
      setRunProgress(100);
      await fetchSessions();
      setActiveTab("sessions");
    } catch (err: any) {
      setRunError(err?.message || "Pipeline thất bại.");
      setRunStatus(null);
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return iso; }
  };

  const stepInfo = (step: string) => STEP_LABELS[step] || { label: step, color: "bg-slate-100 text-slate-500", icon: "•" };

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DB94D] to-[#1A9E3A] flex items-center justify-center text-lg shadow">🧠</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Pika Brain</p>
              <h1 className="text-[18px] font-black text-slate-800 leading-tight">Admin Panel</h1>
            </div>
          </div>
          <a href="/schedule" className="text-[11px] font-bold text-[#2DB94D] hover:underline">← Về ứng dụng</a>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6 flex gap-1 pb-0">
          {([["run", "🚀 Chạy pipeline"], ["sessions", "📋 Lịch sử chạy"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-[12px] font-extrabold rounded-t-xl border-b-2 transition-all ${
                activeTab === id
                  ? "border-[#2DB94D] text-[#2DB94D] bg-[#2DB94D]/5"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── TAB: RUN PIPELINE ── */}
        {activeTab === "run" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-[14px] font-extrabold text-slate-800 mb-1">Chạy pipeline theo Profile ID</h2>
              <p className="text-[11px] text-slate-500 mb-5 font-medium">Nhập User Profile ID để phân tích dữ liệu Mem0 và tạo kế hoạch tuần</p>

              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1 block">Profile ID *</label>
                  <input
                    type="text"
                    value={runProfileId}
                    onChange={e => setRunProfileId(e.target.value)}
                    placeholder="019e8b8e-a40e-7e6e-9d14-..."
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-[12px] font-medium focus:outline-none focus:border-[#2DB94D] transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1 block">Số điện thoại</label>
                    <input
                      type="text"
                      value={runPhone}
                      onChange={e => setRunPhone(e.target.value)}
                      placeholder="0912..."
                      className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-[12px] font-medium focus:outline-none focus:border-[#2DB94D] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1 block">Tên bé</label>
                    <input
                      type="text"
                      value={runName}
                      onChange={e => setRunName(e.target.value)}
                      placeholder="An, Minh..."
                      className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-[12px] font-medium focus:outline-none focus:border-[#2DB94D] transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="forceRefresh"
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#2DB94D] focus:ring-[#2DB94D]"
                  />
                  <label htmlFor="forceRefresh" className="text-[12px] font-bold text-slate-600">
                    Bỏ qua Cache (Phân tích lại từ đầu)
                  </label>
                </div>
              </div>

              <button
                onClick={handleRun}
                disabled={running || !runProfileId.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] text-white text-[13px] font-black shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? "⏳ Đang chạy..." : "🚀 Chạy Pipeline"}
              </button>
            </div>

            {/* Status */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
              <h2 className="text-[14px] font-extrabold text-slate-800 mb-4">Trạng thái</h2>
              {!running && !runStatus && !runError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-[12px] text-slate-400 font-medium">Điền Profile ID và nhấn Chạy Pipeline để bắt đầu phân tích</p>
                </div>
              )}
              {(running || runStatus) && !runError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className={`text-4xl mb-4 ${running ? "animate-bounce" : ""}`}>🧠</div>
                  <p className="text-[13px] font-bold text-slate-700 mb-4">{runStatus}</p>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${runProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">{runProgress}%</p>
                </div>
              )}
              {runError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="text-4xl mb-4">❌</div>
                  <p className="text-[13px] font-bold text-red-600 mb-2">Pipeline thất bại</p>
                  <p className="text-[11px] text-slate-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3 font-medium">{runError}</p>
                  <button onClick={() => { setRunError(null); setRunStatus(null); setRunProgress(0); }}
                    className="mt-4 text-[11px] font-bold text-[#2DB94D] hover:underline">Xóa lỗi & thử lại</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: SESSIONS LIST ── */}
        {activeTab === "sessions" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] font-bold text-slate-500">{sessions.length} lượt chạy</p>
              <button onClick={() => { setLoadingSessions(true); fetchSessions(); }}
                className="text-[11px] font-bold text-[#2DB94D] hover:underline">↻ Làm mới</button>
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-[13px] font-bold text-slate-500">Chưa có lượt chạy nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {sessions.map(s => {
                  const si = stepInfo(s.current_step);
                  const hasAnalysis = !!s.data?.memory_analysis;
                  const hasPlan = !!s.data?.weekly_plan;
                  return (
                    <div key={s.id}
                      onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-[#2DB94D]/40 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg shrink-0">
                            {s.profile_name ? s.profile_name[0].toUpperCase() : "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-extrabold text-slate-800 truncate">
                              {s.profile_name || "Chưa có tên"} · {s.phone || "—"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{s.profile_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${si.color}`}>
                            {si.icon} {si.label}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">{formatDate(s.created_at)}</span>
                        </div>
                      </div>

                      {/* Data badges + View UX button */}
                      <div className="flex gap-2 mt-2.5 items-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${hasAnalysis ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-300"}`}>
                          {hasAnalysis ? "✓" : "○"} Phân tích ký ức
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${hasPlan ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-300"}`}>
                          {hasPlan ? "✓" : "○"} Kế hoạch tuần
                        </span>
                        {(hasAnalysis || hasPlan) && (
                          <button
                            onClick={(e) => applyToUX(s, e)}
                            className="ml-auto text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#2DB94D] text-white hover:bg-[#1A9E3A] active:scale-95 transition-all shadow-sm shrink-0"
                          >
                            👁 Xem UI/UX
                          </button>
                        )}
                      </div>

                      {/* Expanded detail */}
                      {selectedSession?.id === s.id && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          {hasAnalysis && (
                            <div className="mb-3">
                              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-2">Kết quả phân tích</p>
                              <pre className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-600 overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                {JSON.stringify(s.data.memory_analysis?.parsed || s.data.memory_analysis, null, 2)}
                              </pre>
                            </div>
                          )}
                          {hasPlan && (
                            <div>
                              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-2">Kế hoạch tuần</p>
                              <pre className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-600 overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                                {JSON.stringify(s.data.weekly_plan?.week_strategy || s.data.weekly_plan, null, 2)}
                              </pre>
                            </div>
                          )}
                          {!hasAnalysis && !hasPlan && (
                            <p className="text-[11px] text-slate-400 font-medium">Chưa có dữ liệu kết quả</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
