"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface CausalChain {
  phase_reason?: string;
  ratio_reason?: string;
  memory_activation_reason?: string;
  content_thread?: string;
  pronunciation_spaced_repetition?: string;
  talk_game_design_rationale?: string;
}

interface SessionBrief {
  order: number;
  name: string;
  role_in_session: string;
}

interface LayersResponse {
  causal_chain_summary?: CausalChain;
  session_sequence?: SessionBrief[];
}

const RATING_TAGS: Record<number, string[]> = {
  5: ["💡 Rất thấu hiểu con", "📈 Lộ trình vừa sức", "🎯 Đúng sở thích", "🔄 Chu kỳ ôn tập tốt"],
  4: ["Giải thích dễ hiểu", "Cần thêm từ vựng", "Gợi ý trò chơi hay", "Đúng sở thích bé"],
  3: ["Giải thích hơi ngắn", "Chưa khớp sở thích", "Muốn chi tiết hơn", "Bình thường"],
  2: ["Chưa chính xác", "Ít thông tin chuyên môn", "Lời khuyên chưa thiết thực"],
  1: ["Sai thông tin", "Thông tin sơ sài", "Lỗi hiển thị"],
};

function RationaleContent() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [causalChain, setCausalChain] = useState<CausalChain | null>(null);
  const [sessions, setSessions] = useState<SessionBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // Feedback State
  const [userRating, setUserRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [itemFeedback, setItemFeedback] = useState<Record<number, boolean>>({});
  const [itemComments, setItemComments] = useState<Record<number, string>>({});
  
  // Sheet State for per-item comments
  const [feedbackSheet, setFeedbackSheet] = useState<
    null | { itemOrder: number; itemName: string; liked: boolean }
  >(null);
  const [sheetText, setSheetText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reasoning/layers?dataset=${dataset}`);
        if (!res.ok) throw new Error("Failed to fetch layers");
        const data = (await res.json()) as LayersResponse;
        if (data.causal_chain_summary) {
          setCausalChain(data.causal_chain_summary);
        }
        if (data.session_sequence) {
          setSessions(data.session_sequence);
        }
      } catch (err) {
        console.error("Error loading layers:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLayers();
  }, [dataset, API_BASE]);

  const openItemSheet = (order: number, name: string, liked: boolean) => {
    setItemFeedback(prev => ({ ...prev, [order]: liked }));
    setSheetText(itemComments[order] || "");
    setFeedbackSheet({ itemOrder: order, itemName: name, liked });
  };

  const handleSheetSubmit = () => {
    if (!feedbackSheet) return;
    if (sheetText.trim()) {
      setItemComments(prev => ({ ...prev, [feedbackSheet.itemOrder]: sheetText.trim() }));
    }
    setFeedbackSheet(null);
    setSheetText("");
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      const itemFeedbackArr = sessions.map(item => ({
        order: item.order,
        name: item.name,
        liked: itemFeedback[item.order] ?? null,
        comment: itemComments[item.order] ?? null,
      })).filter(f => f.liked !== null);

      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          star_rating: userRating,
          tags: selectedTags,
          comment: feedbackComment,
          item_feedback: itemFeedbackArr.length > 0 ? itemFeedbackArr : null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        alert("Có lỗi xảy ra khi gửi đánh giá.");
      }
    } catch (err) {
      console.error("Feedback error:", err);
      alert("Không thể kết nối đến máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnHome = () => {
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-extrabold tracking-wider">ĐANG TẢI GIẢI THÍCH...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar flex flex-col p-5 gap-5 animate-fade-in bg-[#F5F6F8]">
      {/* Toast */}
      {showToast && (
        <div className="absolute top-4 left-4 right-4 bg-[#2DB94D] rounded-xl py-3 px-4 shadow-lg z-50 text-[11px] font-black text-white flex items-center gap-2 animate-scale-up">
          <span>✓</span> Đánh giá thành công! Cảm ơn ý kiến đóng góp của Mama.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3.5">
        <button onClick={() => window.location.href = `/planner?dataset=${dataset}`} className="text-slate-500 hover:text-slate-800 text-xs font-black flex items-center gap-1 transition-colors shrink-0">❮ Trở lại</button>
        <div>
          <span className="text-[11px] font-semibold text-slate-500 tracking-wide block text-right">LÝ DO THIẾT KẾ</span>
          <h2 className="text-[18px] font-extrabold tracking-tight text-slate-800 mt-0.5 text-right">Giải mã của Pika</h2>
        </div>
      </div>

      {/* Rationale sections */}
      {causalChain && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <h3 className="text-[12.5px] font-black text-[#2DB94D] uppercase tracking-wide">💡 GIẢI THÍCH HỆ THỐNG</h3>
            
            <div className="flex flex-col gap-3.5 text-[11.5px] text-slate-700 leading-relaxed font-semibold">
              {causalChain.phase_reason && (
                <div className="border-l-2 border-[#7C5CFC] pl-2.5">
                  <strong className="text-[#7C5CFC] uppercase text-[10px] block mb-0.5">Giai đoạn phát triển</strong>
                  <span className="font-medium text-slate-600">{causalChain.phase_reason}</span>
                </div>
              )}

              {causalChain.ratio_reason && (
                <div className="border-l-2 border-[#FF9500] pl-2.5">
                  <strong className="text-[#D97706] uppercase text-[10px] block mb-0.5">Tỷ lệ Học & Trò chuyện</strong>
                  <span className="font-medium text-slate-600">{causalChain.ratio_reason}</span>
                </div>
              )}

              {causalChain.memory_activation_reason && (
                <div className="border-l-2 border-[#3B82F6] pl-2.5">
                  <strong className="text-[#1D4ED8] uppercase text-[10px] block mb-0.5">Ký ức được kích hoạt</strong>
                  <span className="font-medium text-slate-600">{causalChain.memory_activation_reason}</span>
                </div>
              )}

              {causalChain.content_thread && (
                <div className="border-l-2 border-[#2DB94D] pl-2.5">
                  <strong className="text-[#1A9E3A] uppercase text-[10px] block mb-0.5">Liên kết dòng chủ đề</strong>
                  <span className="font-medium text-slate-600">{causalChain.content_thread}</span>
                </div>
              )}

              {causalChain.pronunciation_spaced_repetition && (
                <div className="border-l-2 border-[#EC4899] pl-2.5">
                  <strong className="text-[#BE185D] uppercase text-[10px] block mb-0.5">Kế hoạch ôn tập</strong>
                  <span className="font-medium text-slate-600">{causalChain.pronunciation_spaced_repetition}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-session thumbs up/down list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
          Đánh giá từng hoạt động
        </h3>
        
        <div className="flex flex-col gap-2.5 bg-white border border-[#E8E8E8] rounded-2xl p-4 shadow-xs">
          {sessions.map((item) => (
            <div key={item.order} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="text-[12px] font-bold text-slate-800 leading-snug">{item.name}</span>
                <span className="text-[9px] font-extrabold text-slate-400">Buổi #{item.order}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {itemComments[item.order] && (
                  <span className="text-[8px] text-[#2DB94D] font-bold border border-[#2DB94D]/35 rounded px-1">✏️</span>
                )}
                <button
                  onClick={() => openItemSheet(item.order, item.name, true)}
                  className={`text-[12px] px-1.5 py-0.5 rounded ${
                    itemFeedback[item.order] === true ? "bg-[#2DB94D]/15 scale-110" : "opacity-45 bg-slate-50 border"
                  }`}
                >
                  👍
                </button>
                <button
                  onClick={() => openItemSheet(item.order, item.name, false)}
                  className={`text-[12px] px-1.5 py-0.5 rounded ${
                    itemFeedback[item.order] === false ? "bg-[#EC4899]/15 scale-110" : "opacity-45 bg-slate-50 border"
                  }`}
                >
                  👎
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall feedback form */}
      <div className="mt-2 shrink-0">
        {!submitted ? (
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <p className="text-[11px] font-black text-slate-800 text-center tracking-wide uppercase">Mama đánh giá lộ trình tuần này thế nào?</p>
            
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => {
                    setUserRating(star);
                    setSelectedTags([]);
                    setFeedbackComment("");
                  }}
                  className="text-[28px] transition-transform hover:scale-110 active:scale-90"
                >
                  <span className={star <= userRating ? "text-[#FF9500] drop-shadow-[0_0_6px_rgba(255,149,0,0.3)]" : "text-slate-200"}>★</span>
                </button>
              ))}
            </div>

            {userRating > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-1 animate-scale-up">
                {(RATING_TAGS[userRating] || []).map((tag) => {
                  const isSel = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          isSel ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`text-[9.5px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                        isSel
                          ? "bg-[#2DB94D]/10 text-[#1A9E3A] border-[#2DB94D]/40"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {userRating > 0 && (
              <div className="flex flex-col gap-2.5 mt-2.5 animate-slide-in">
                <div className="relative">
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value.slice(0, 400))}
                    placeholder="Mama muốn nhắn gì thêm cho Pika? (tuỳ chọn)"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 focus:border-[#2DB94D] focus:bg-white focus:outline-none transition-all text-[12px] text-slate-700 placeholder:text-slate-400 p-3 leading-relaxed"
                    rows={2.5}
                  />
                  <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 font-bold">
                    {feedbackComment.length}/400
                  </span>
                </div>

                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] hover:opacity-95 rounded-xl text-[11.5px] font-black tracking-wider text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    "GỬI ĐÁNH GIÁ & HOÀN TẤT 💚"
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#2DB94D]/10 border border-[#2DB94D]/25 rounded-2xl p-5 text-center animate-fade-in flex flex-col items-center gap-2">
            <div className="text-3xl">🎉</div>
            <p className="text-[13px] font-extrabold text-[#1A9E3A]">Mama đã đánh giá xong!</p>
            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
              Kế hoạch học tuần của An đã được lưu lại và đồng bộ với trợ lý AI Pika.
            </p>
            <button
              onClick={handleReturnHome}
              className="mt-2.5 px-6 py-2.5 bg-[#2DB94D] hover:bg-[#1A9E3A] text-white rounded-xl text-xs font-black shadow-sm transition-all"
            >
              VỀ TRANG CHỦ ĐĂNG NHẬP
            </button>
          </div>
        )}
      </div>

      {/* FEEDBACK BOTTOM SHEET OVERLAY FOR ITEM COMMENTS */}
      {feedbackSheet && (
        <div
          className="fixed inset-0 z-[999] flex flex-col justify-end"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
          onClick={() => {
            setFeedbackSheet(null);
            setSheetText("");
          }}
        >
          <div className="w-full max-w-[390px] mx-auto flex flex-col justify-end h-full">
            <div
              className="bg-white rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] flex flex-col animate-sheet-up p-5 gap-4"
              style={{ maxHeight: "70%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-extrabold text-slate-800">
                  {feedbackSheet.liked ? "👍 Thích hoạt động" : "👎 Chưa hài lòng với hoạt động"}
                </p>
                <span className="inline-flex items-center gap-1 self-start bg-[#2DB94D]/10 text-[#1A9E3A] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#2DB94D]/25 mt-0.5">
                  📚 {feedbackSheet.itemName}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Nhận xét chi tiết (tuỳ chọn)</label>
                <div className="relative">
                  <textarea
                    value={sheetText}
                    onChange={(e) => setSheetText(e.target.value.slice(0, 200))}
                    placeholder="Nhập ý kiến đóng góp của Mama về buổi học này..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 focus:border-[#2DB94D] focus:bg-white focus:outline-none transition-all text-[13px] text-slate-700 placeholder:text-slate-400 p-3.5 leading-relaxed"
                    rows={3}
                    autoFocus
                  />
                  <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-bold">
                    {sheetText.length}/200
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFeedbackSheet(null);
                    setSheetText("");
                  }}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white text-[11.5px] font-extrabold text-slate-500 hover:bg-slate-50 active:scale-[0.97] transition-all"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={handleSheetSubmit}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] text-[11.5px] font-extrabold text-white shadow-md hover:opacity-95 active:scale-[0.97] transition-all"
                >
                  Lưu nhận xét ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RationalePage() {
  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 font-sans flex flex-col items-center justify-center p-0 md:p-6 overflow-x-hidden selection:bg-[#2DB94D]/20 selection:text-[#1A9E3A]">
      {/* Background light gradient glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#2DB94D]/4 blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#FF9500]/3 blur-[160px]" />
      </div>

      {/* Main Mobile Frame */}
      <div className="w-full max-w-[390px] h-[844px] bg-[#F5F6F8] rounded-none md:rounded-[48px] border-none md:border-[10px] border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden relative z-10">
        {/* Status bar */}
        <div className="h-10 bg-white shrink-0 flex items-center justify-between px-6 z-20 text-[11px] font-extrabold text-slate-600 font-mono pointer-events-none border-b border-slate-100 relative">
          <span>9:41</span>
          <div className="w-24 h-4.5 bg-[#000] rounded-full absolute left-1/2 -translate-x-1/2 top-2 border border-slate-800/50" />
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-4.5 h-2.5 border border-slate-400 rounded-[3px] p-[1px] flex items-center">
              <div className="w-full h-full bg-slate-600 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Content with Suspense */}
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-[#F5F6F8]">
            <div className="w-6 h-6 border-2 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <RationaleContent />
        </Suspense>

        {/* Home indicator */}
        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}
