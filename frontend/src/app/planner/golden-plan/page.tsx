"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import NavBar from "../../components/NavBar";
import posthog from "posthog-js";
import { JourneyPill } from "../../components/JourneyGuide";


// ─── Types ────────────────────────────────────────────────────────────────────

interface Phase {
  phase: string;
  intent: string;
  template: string;
}

interface Mission {
  type: string;
  prompt: string;
}

interface CandidateStructure {
  phases: Phase[];
  mission: Mission;
  primary_value: string;
  secondary_value: string;
  notes_for_prompt_gen: string[];
}

interface Candidate {
  id: number;
  type: "new" | "anchored";
  topic: string;
  reasoning: string;
  embeddable_value: string[];
  target_domain: string;
  anchored_interest: string | null;
  persona_summary?: string | null;
  structure: CandidateStructure | null;
}

interface PlanData {
  week_start: string;
  candidates: Candidate[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  COGNITIVE:               { label: "Nhận thức",        emoji: "🧠", color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  LANGUAGE:                { label: "Ngôn ngữ",          emoji: "💬", color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"   },
  SOCIAL_EMOTIONAL:        { label: "Cảm xúc & Xã hội", emoji: "❤️", color: "text-pink-700",   bg: "bg-pink-50",    border: "border-pink-200"   },
  APPROACHES_TO_LEARNING:  { label: "Cách học",          emoji: "🎯", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"  },
  CULTURAL_VALUES:         { label: "Giá trị văn hóa",   emoji: "🌺", color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200"},
  PHYSICAL_HEALTH:         { label: "Sức khỏe",          emoji: "💪", color: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-200"   },
};

const TEMPLATE_ICON: Record<string, string> = {
  "Một ngày của... (A Day In The Life)": "🌅",
  "Đóng vai trong tình huống (Role-Play Scenario)": "🎭",
  "Kể chuyện cùng nhau (Co-Create Story)": "📖",
  "Dạy lại Pika (Teach Pika)": "🎓",
};

const RATING_TAGS: Record<number, string[]> = {
  5: ["🎯 Rất phù hợp với con", "💡 Chủ đề con yêu thích", "🧠 Pika hiểu con", "📈 Kế hoạch đủ thử thách"],
  4: ["✅ Hầu hết hợp lý", "💬 Chủ đề khá phù hợp", "📚 Cần thêm chủ đề mới"],
  3: ["📝 Một số chủ đề chưa phù hợp", "🔁 Chủ đề quá quen", "🤔 Cần điều chỉnh thêm"],
  2: ["❌ Chủ đề không phù hợp", "😓 Quá khó với con", "😴 Con không hứng thú"],
  1: ["🚫 Sai thông tin về con", "⚠️ Kế hoạch không hợp lý", "🐛 Lỗi hiển thị"],
};

// ─── CandidateCard ────────────────────────────────────────────────────────────

interface CandidateCardProps {
  c: Candidate;
  liked: boolean | null;
  hasComment: boolean;
  onFeedback: (liked: boolean) => void;
}

function CandidateCard({ c, liked, hasComment, onFeedback }: CandidateCardProps) {
  const [open, setOpen] = useState(false);
  const domain = DOMAIN_CONFIG[c.target_domain] || {
    label: c.target_domain, emoji: "📌",
    color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
  };
  const isAnchored = c.type === "anchored";

  return (
    <div className={`bg-white border rounded-2xl shadow-xs overflow-hidden ${isAnchored ? "border-[#2DB94D]/30" : "border-[#E8E8E8]"}`}>
      {/* Header */}
      <button
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => { const next = !open; setOpen(next); if (next) posthog.capture("candidate_opened", { topic: c.topic, type: c.type }); }}
      >
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isAnchored ? "bg-[#2DB94D]/10" : "bg-purple-50"}`}>
          {isAnchored ? "📌" : "✨"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            {isAnchored ? (
              <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#2DB94D]/10 text-[#1A9E3A] border border-[#2DB94D]/20">
                📌 Sở thích bé
              </span>
            ) : (
              <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                ✨ Chủ đề mới
              </span>
            )}
            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${domain.bg} ${domain.color} border ${domain.border}`}>
              {domain.emoji} {domain.label}
            </span>
            {c.structure && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                📋 Có cấu trúc
              </span>
            )}
          </div>
          <h3 className="text-[13px] font-black text-slate-800 leading-snug">{c.topic}</h3>
          {!open && (
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{c.reasoning}</p>
          )}
        </div>
        <span className={`text-[10px] text-slate-400 mt-1.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 flex flex-col gap-3">
          {c.anchored_interest && (
            <div className="flex items-center gap-2 bg-[#2DB94D]/5 border border-[#2DB94D]/20 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-[#1A9E3A] uppercase tracking-widest shrink-0">🔗 Sở thích gắn kết</span>
              <span className="text-[11px] text-slate-700 font-semibold">{c.anchored_interest}</span>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tại sao chọn chủ đề này?</span>
            <p className="text-[11.5px] text-slate-700 font-semibold leading-relaxed">{c.reasoning}</p>
          </div>

          <div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Giá trị lồng ghép</span>
            <div className="flex flex-wrap gap-1.5">
              {c.embeddable_value.map((v, i) => (
                <span key={i} className="text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-xl">
                  {v}
                </span>
              ))}
            </div>
          </div>

          {c.structure?.phases && (
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                Cấu trúc buổi học ({c.structure.phases.length} giai đoạn)
              </span>
              <div className="flex flex-col gap-2">
                {c.structure.phases.map((p, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-2.5 flex gap-2.5">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px]">{TEMPLATE_ICON[p.template] || "▸"}</span>
                        <span className="text-[10px] font-black text-slate-700">{p.phase}</span>
                        <span className="text-[8.5px] text-slate-400 font-bold ml-auto shrink-0">
                          {p.template.split("(")[0].trim()}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-600 leading-relaxed">{p.intent}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.structure?.mission && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">🏠</span>
                <span className="text-[9.5px] font-black text-amber-800 uppercase tracking-widest">Nhiệm vụ sau buổi học</span>
              </div>
              <p className="text-[11px] text-amber-900 font-medium leading-relaxed italic">{c.structure.mission.prompt}</p>
            </div>
          )}

          {c.structure?.notes_for_prompt_gen && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Hướng dẫn cho Pika AI</span>
              <ul className="flex flex-col gap-1">
                {c.structure.notes_for_prompt_gen.map((n, i) => (
                  <li key={i} className="text-[10.5px] text-slate-600 font-medium flex gap-1.5">
                    <span className="text-slate-400 shrink-0">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

      {/* Feedback row — always visible */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 bg-white">
        <span className="text-[10.5px] font-bold text-slate-400">Mama thấy thế nào?</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasComment && (
            <span className="text-[9px] text-[#2DB94D] font-bold border border-[#2DB94D]/35 rounded px-1.5 py-0.5">✏️ Nhận xét</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback(true); }}
            className={`text-[11px] px-2 py-1 rounded-lg border font-bold transition-all ${
              liked === true ? "bg-[#2DB94D]/15 border-[#2DB94D]/30 scale-105" : "opacity-40 bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            👍 Tốt
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback(false); }}
            className={`text-[11px] px-2 py-1 rounded-lg border font-bold transition-all ${
              liked === false ? "bg-[#EC4899]/15 border-[#EC4899]/30 scale-105" : "opacity-40 bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            👎 Chưa phù hợp
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function GoldenPlanContent({ dataset }: { dataset: string }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-candidate feedback
  const [itemFeedback, setItemFeedback] = useState<Record<string, boolean>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});

  // Bottom sheet for item comment
  const [feedbackSheet, setFeedbackSheet] = useState<
    null | { itemId: string; itemName: string; liked: boolean }
  >(null);
  const [sheetText, setSheetText] = useState("");

  // Overall feedback
  const [userRating, setUserRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/planner/candidates?dataset=${dataset}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json: PlanData = await res.json();
        setPlan(json);
      } catch (err) {
        console.error("Error fetching candidates:", err);
        setError("Không tải được kế hoạch. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, [dataset, API_BASE]);

  const openItemSheet = (id: string, name: string, liked: boolean) => {
    setItemFeedback(prev => ({ ...prev, [id]: liked }));
    setSheetText(itemComments[id] || "");
    setFeedbackSheet({ itemId: id, itemName: name, liked });
  };

  const handleSheetSubmit = () => {
    if (!feedbackSheet) return;
    if (sheetText.trim()) {
      setItemComments(prev => ({ ...prev, [feedbackSheet.itemId]: sheetText.trim() }));
    }
    setFeedbackSheet(null);
    setSheetText("");
  };

  const handleSubmitFeedback = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const itemFeedbackArr = plan.candidates
        .filter(c => itemFeedback[`candidate_${c.id}`] !== undefined)
        .map(c => ({
          id: `candidate_${c.id}`,
          title: c.topic,
          type: "candidate",
          liked: itemFeedback[`candidate_${c.id}`],
          comment: itemComments[`candidate_${c.id}`] ?? null,
        }));

      const res = await fetch(`${API_BASE}/api/planner/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          week_label: plan.week_start,
          star_rating: userRating,
          tags: selectedTags,
          comment: feedbackComment,
          item_feedback: itemFeedbackArr.length > 0 ? itemFeedbackArr : null,
        }),
      });

      if (res.ok) {
        posthog.capture("plan_feedback_submitted", {
          dataset,
          week_label: plan.week_start,
          star_rating: userRating,
          tags: selectedTags,
          items_rated: itemFeedbackArr.length,
        });
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-extrabold tracking-wider">ĐANG TẢI KẾ HOẠCH...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
        <span className="text-2xl">📭</span>
        <p className="text-[12px] text-slate-500 font-bold text-center">{error || "Chưa có kế hoạch cho tuần này."}</p>
      </div>
    );
  }

  const newTopics = plan.candidates.filter(c => c.type === "new");
  const anchored  = plan.candidates.filter(c => c.type === "anchored");
  const anchoredByInterest: Record<string, Candidate[]> = {};
  anchored.forEach(c => {
    const key = c.anchored_interest || "Khác";
    if (!anchoredByInterest[key]) anchoredByInterest[key] = [];
    anchoredByInterest[key].push(c);
  });

  const personaSummary = plan.candidates.find(c => c.persona_summary)?.persona_summary;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F5F6F8] pb-4 custom-scrollbar relative">

      {/* Success toast */}
      {showToast && (
        <div className="absolute top-4 left-4 right-4 bg-[#2DB94D] rounded-xl py-3 px-4 shadow-lg z-50 text-[11px] font-black text-white flex items-center gap-2 animate-scale-up">
          <span>✓</span> Đánh giá thành công! Cảm ơn ý kiến của Mama.
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 pt-5 pb-4 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide block">KẾ HOẠCH TUẦN</span>
            <h2 className="text-[20px] font-extrabold tracking-tight text-slate-800 mt-0.5 leading-tight">
              {plan.week_start}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[13px] font-black text-slate-700 block">{plan.candidates.length} chủ đề</span>
            <span className="text-[10px] text-slate-400 font-bold">{newTopics.length} mới · {anchored.length} sở thích</span>
          </div>
        </div>

        {personaSummary && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Hồ sơ bé</span>
            <p className="text-[11px] font-semibold text-slate-700 leading-relaxed">{personaSummary}</p>
          </div>
        )}
      </div>

      {/* Candidate lists */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-6">

        {newTopics.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">✨ Chủ đề mới khám phá</span>
              <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full">{newTopics.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {newTopics.map(c => (
                <CandidateCard
                  key={c.id}
                  c={c}
                  liked={itemFeedback[`candidate_${c.id}`] ?? null}
                  hasComment={!!itemComments[`candidate_${c.id}`]}
                  onFeedback={(liked) => openItemSheet(`candidate_${c.id}`, c.topic, liked)}
                />
              ))}
            </div>
          </section>
        )}

        {anchored.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">📌 Từ sở thích của bé</span>
              <span className="text-[9px] font-bold bg-[#2DB94D]/10 text-[#1A9E3A] border border-[#2DB94D]/20 px-1.5 py-0.5 rounded-full">{anchored.length}</span>
            </div>
            {Object.entries(anchoredByInterest).map(([interest, items]) => (
              <div key={interest} className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest whitespace-nowrap">🔗 {interest}</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="flex flex-col gap-3">
                  {items.map(c => (
                    <CandidateCard
                      key={c.id}
                      c={c}
                      liked={itemFeedback[`candidate_${c.id}`] ?? null}
                      hasComment={!!itemComments[`candidate_${c.id}`]}
                      onFeedback={(liked) => openItemSheet(`candidate_${c.id}`, c.topic, liked)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Overall feedback */}
        <div className="pb-2">
          {!submitted ? (
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <p className="text-[11px] font-black text-slate-800 text-center tracking-wide uppercase">
                Mama đánh giá kế hoạch tuần này thế nào?
              </p>

              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => { setUserRating(star); setSelectedTags([]); setFeedbackComment(""); }}
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
                        onClick={() => setSelectedTags(prev => isSel ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`text-[9.5px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                          isSel ? "bg-[#2DB94D]/10 text-[#1A9E3A] border-[#2DB94D]/40" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}

              {userRating > 0 && (
                <div className="flex flex-col gap-2.5 mt-1">
                  <div className="relative">
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value.slice(0, 400))}
                      placeholder="Mama muốn nhắn gì thêm cho Pika? (tuỳ chọn)"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 focus:border-[#2DB94D] focus:bg-white focus:outline-none transition-all text-[12px] text-slate-700 placeholder:text-slate-400 p-3 leading-relaxed"
                      rows={2}
                    />
                    <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 font-bold">{feedbackComment.length}/400</span>
                  </div>

                  <button
                    onClick={handleSubmitFeedback}
                    disabled={submitting}
                    className="w-full py-3.5 bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] hover:opacity-95 rounded-xl text-[11.5px] font-black tracking-wider text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang gửi...</>
                    ) : (
                      "GỬI ĐÁNH GIÁ KẾ HOẠCH TUẦN 💚"
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#2DB94D]/10 border border-[#2DB94D]/25 rounded-2xl p-5 text-center flex flex-col items-center gap-2">
              <div className="text-3xl">🎉</div>
              <p className="text-[13px] font-extrabold text-[#1A9E3A]">Mama đã đánh giá xong!</p>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Đánh giá của Mama đã được lưu lại để Pika cải thiện kế hoạch học tập tuần tới.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet for item comment */}
      {feedbackSheet && (
        <div
          className="fixed inset-0 z-[999] flex flex-col justify-end"
          style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }}
          onClick={() => { setFeedbackSheet(null); setSheetText(""); }}
        >
          <div className="w-full max-w-[390px] mx-auto flex flex-col justify-end h-full">
            <div
              className="bg-white rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] flex flex-col p-5 gap-4"
              style={{ maxHeight: "60%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center shrink-0">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              <div className="flex items-start gap-3 shrink-0">
                <span className="text-xl">{feedbackSheet.liked ? "👍" : "👎"}</span>
                <div>
                  <p className="text-[11px] font-black text-slate-700">{feedbackSheet.itemName}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {feedbackSheet.liked ? "Mama thấy chủ đề này phù hợp với con!" : "Mama thấy chủ đề này chưa phù hợp."}
                  </p>
                </div>
              </div>

              <textarea
                autoFocus
                value={sheetText}
                onChange={(e) => setSheetText(e.target.value.slice(0, 200))}
                placeholder="Thêm nhận xét về chủ đề này... (tuỳ chọn)"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 focus:border-[#2DB94D] focus:bg-white focus:outline-none transition-all text-[12px] text-slate-700 placeholder:text-slate-400 p-3 leading-relaxed flex-1"
                rows={3}
              />
              <span className="text-[9px] text-slate-400 font-bold text-right -mt-2">{sheetText.length}/200</span>

              <button
                onClick={handleSheetSubmit}
                className="w-full py-3 bg-[#2DB94D] hover:bg-[#25A344] rounded-xl text-[11.5px] font-black text-white tracking-wider transition-colors active:scale-[0.98]"
              >
                XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper with phone frame ───────────────────────────────────────────

function GoldenPlanPageInner() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019cff81-1bc3-7939-9230-a1f032605728";

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 font-sans flex flex-col items-center justify-center p-0 md:p-6 overflow-x-hidden selection:bg-[#2DB94D]/20 selection:text-[#1A9E3A]">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#2DB94D]/4 blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#FF9500]/3 blur-[160px]" />
      </div>

      <div className="w-full max-w-[390px] h-[844px] bg-[#F5F6F8] rounded-none md:rounded-[48px] border-none md:border-[10px] border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden relative z-10">
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

        <GoldenPlanContent dataset={dataset} />

        {/* Journey Guide Pill */}
        <JourneyPill dataset={dataset} currentStep="planner" />

        <NavBar dataset={dataset} />


        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function GoldenPlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GoldenPlanPageInner />
    </Suspense>
  );
}
