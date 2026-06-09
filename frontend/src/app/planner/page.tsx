"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import NavBar from "../components/NavBar";

// ─── Helper: decode E1/E2 memory labels into parent-friendly Vietnamese ────────
// E1 = bé gần đây vẫn đang thể hiện điều này
// E2 = đây là sở thích / ký ức lâu dài của bé
function decodeMemoryLabels(text: string): string {
  return text
    .replace(/\(E1\)/g, "(bé gần đây vẫn đang thể hiện điều này)")
    .replace(/\(E2\)/g, "(đây là sở thích lâu dài của bé)");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LearnActivity {
  id: string;
  name: string;
  category: string;
}

interface LearnSessionItem {
  mission_id: string;
  title: string;
  activities: LearnActivity[];
}

interface TalkSession {
  day: number;
  session: number;
  title: string;
  topic: string;
  topic_strategy: string;
  domain: string;
  pillar: number;
  observation_cited: string;
  template_used: string;
  activity_type: string;
  rationale: string;
  embedded_value: string;
  memory_to_inject: string[];
  follow_up_event: string | null;
  relationship_to_mention: string | null;
  target_vocab: string[];
  target_sentences: string[];
  en_pressure: string;
  max_turns: number;
  cliffhanger_for_next: string;
  parent_summary: string;
}

interface WeekStrategy {
  theme: string;
  goal: string;
  lesson_topic: string;
  priority_relationships: string[];
  important_events: string[];
  parent_rationale: string;
}

interface PlanResponse {
  profile_id: string;
  week_start: string;
  week_end: string;
  week_label: string;
  week_strategy: WeekStrategy;
  talk_sessions: TalkSession[];
  learn_sessions: LearnSessionItem[];
  ai_powered: boolean;
  cost_usd?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MAP: Record<number, string> = {
  1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN",
};

const DOMAIN_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  COGNITIVE:               { label: "Nhận thức",        emoji: "🧠", color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  LANGUAGE:                { label: "Ngôn ngữ",          emoji: "💬", color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200"   },
  SOCIAL_EMOTIONAL:        { label: "Cảm xúc & Xã hội", emoji: "❤️", color: "text-pink-700",   bg: "bg-pink-50",    border: "border-pink-200"   },
  APPROACHES_TO_LEARNING:  { label: "Cách học",          emoji: "🎯", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"  },
  CULTURAL_VALUES:         { label: "Giá trị văn hóa",   emoji: "🌺", color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200"},
  PHYSICAL_HEALTH:         { label: "Sức khỏe",          emoji: "💪", color: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-200"   },
};

const ACTIVITY_CATEGORY_COLOR: Record<string, string> = {
  "Nạp cụm":       "bg-blue-50 text-blue-700 border-blue-100",
  "Hát cùng Pika": "bg-pink-50 text-pink-700 border-pink-100",
  "Luyện tập":     "bg-amber-50 text-amber-700 border-amber-100",
  "Khởi động":     "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Nghe kể":       "bg-violet-50 text-violet-700 border-violet-100",
  "Đọc sách":      "bg-teal-50 text-teal-700 border-teal-100",
};

const PLANNER_RATING_TAGS: Record<number, string[]> = {
  5: ["🎯 Rất phù hợp với con", "📈 Lộ trình vừa sức", "💡 Chủ đề con yêu thích", "🔄 Có ôn tập tốt", "🧠 AI hiểu con"],
  4: ["✅ Hầu hết hợp lý", "📚 Cần thêm từ vựng", "🎮 Muốn thêm game", "💬 Chủ đề khá phù hợp"],
  3: ["📝 Chủ đề chưa thú vị", "🤔 Một số buổi quá khó", "😊 Một số buổi quá dễ", "🔁 Lặp lại chủ đề cũ"],
  2: ["❌ Chủ đề không phù hợp", "😓 Quá khó với con", "😴 Nhàm chán"],
  1: ["🚫 Sai thông tin về con", "⚠️ Lộ trình không hợp lý", "🐛 Lỗi hiển thị"],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TalkCardProps {
  session: TalkSession;
  idx: number;
  liked: boolean | null;
  hasComment: boolean;
  onFeedback: (liked: boolean) => void;
}

function TalkCard({ session, idx, liked, hasComment, onFeedback }: TalkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const domain = DOMAIN_CONFIG[session.domain] || {
    label: session.domain, emoji: "📌", color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200"
  };

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl shadow-xs overflow-hidden">
      <button
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Day badge */}
        <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-[#2DB94D]/10 border border-[#2DB94D]/20">
          <span className="text-[10px] font-black text-[#1A9E3A] leading-none">{DAY_MAP[session.day] || `N${session.day}`}</span>
          <span className="text-[9px] font-bold text-[#2DB94D] leading-none mt-0.5">BS{session.session}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap gap-1 mb-1.5">
            {session.topic_strategy === "anchored" ? (
              <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#2DB94D]/10 text-[#1A9E3A] border border-[#2DB94D]/20">
                📌 Anchored
              </span>
            ) : session.topic_strategy === "new" ? (
              <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                ✨ Chủ đề mới
              </span>
            ) : null}
            {session.domain && (
              <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${domain.bg} ${domain.color} border ${domain.border}`}>
                {domain.emoji} {domain.label}
              </span>
            )}
            {session.follow_up_event && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                ↑ {session.follow_up_event}
              </span>
            )}
          </div>

          <h3 className="text-[13px] font-black text-slate-800 leading-snug break-words">{session.title}</h3>
          {!expanded && (
            <div className="flex flex-col gap-1 mt-0.5">
              <p className="text-[11px] text-slate-500 font-semibold break-words line-clamp-2">{session.parent_summary}</p>
              <div className="flex items-center justify-between mt-0.5">
                {liked !== null && (
                  <span className="text-xs">{liked ? "👍" : "👎"}</span>
                )}
                <span className="text-[9px] font-bold text-[#2DB94D] ml-auto">Ấn để xem chi tiết bài học →</span>
              </div>
            </div>
          )}
        </div>

        <span className={`text-[10px] text-slate-400 mt-1 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 flex flex-col gap-3 animate-fade-in">
          {/* Parent summary */}
          {session.parent_summary && (
            <p className="text-[11.5px] text-slate-700 italic leading-relaxed">{session.parent_summary}</p>
          )}

          {/* Why this topic */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest">Tại sao Pika chọn chủ đề này?</span>
            <p className="text-[11.5px] text-slate-700 font-semibold leading-relaxed break-words">{decodeMemoryLabels(session.rationale)}</p>
            {session.observation_cited && (
              <div className="mt-1 bg-[#2DB94D]/5 border border-[#2DB94D]/20 rounded-lg px-2.5 py-2">
                <span className="text-[9px] text-[#1A9E3A] font-bold block mb-0.5">✦ Bằng chứng từ hồ sơ</span>
                <span className="text-[10.5px] text-slate-600 italic break-words">"{decodeMemoryLabels(session.observation_cited)}"</span>
              </div>
            )}
          </div>

          {/* Embedded value + template */}
          <div className="flex gap-2">
            {session.embedded_value && (
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Giá trị lồng ghép</span>
                <span className="text-[11px] font-bold text-slate-700">{session.embedded_value}</span>
              </div>
            )}
            {session.template_used && (
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Template</span>
                <span className="text-[11px] font-bold text-slate-700">{session.template_used}</span>
              </div>
            )}
          </div>

          {/* Memory to inject */}
          {session.memory_to_inject && session.memory_to_inject.length > 0 && (
            <div>
              <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">🧠 Ký ức nhắc lại</span>
              <div className="flex flex-col gap-1">
                {session.memory_to_inject.map((mem, i) => (
                  <div key={i} className="flex items-start gap-1.5 min-w-0">
                    <span className="text-[#2DB94D] text-[10px] mt-0.5 shrink-0">✦</span>
                    <span className="text-[11px] text-slate-700 font-semibold break-words min-w-0 flex-1">{mem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* English */}
          {(session.target_vocab?.length > 0 || session.target_sentences?.length > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <span className="text-[9px] font-black text-blue-700 uppercase tracking-widest block mb-1.5">
                🇬🇧 Tiếng Anh · Áp lực: {session.en_pressure}
              </span>
              {session.target_vocab?.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {session.target_vocab.map((v, i) => (
                    <span key={i} className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">{v}</span>
                  ))}
                </div>
              )}
              {session.target_sentences?.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {session.target_sentences.map((s, i) => (
                    <span key={i} className="text-[11px] text-blue-800 font-semibold italic">"{s}"</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cliffhanger */}
          {session.cliffhanger_for_next && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-0.5">→ Dẫn dắt buổi sau</span>
              <span className="text-[11px] text-amber-800 italic">"{session.cliffhanger_for_next}"</span>
            </div>
          )}

          {/* Thumbs up/down feedback row */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 bg-white p-3 rounded-xl shadow-xs">
            <span className="text-[11.5px] font-bold text-slate-500">Mama hài lòng với buổi này?</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasComment && (
                <span className="text-[9px] text-[#2DB94D] font-bold border border-[#2DB94D]/35 rounded px-1.5 py-0.5">✏️ Nhận xét</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onFeedback(true); }}
                className={`text-[12px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  liked === true ? "bg-[#2DB94D]/15 border-[#2DB94D]/30 scale-105" : "opacity-45 bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                👍 Tốt
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFeedback(false); }}
                className={`text-[12px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  liked === false ? "bg-[#EC4899]/15 border-[#EC4899]/30 scale-105" : "opacity-45 bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                👎 Chưa tốt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LearnCardProps {
  session: LearnSessionItem;
  idx: number;
  liked: boolean | null;
  hasComment: boolean;
  onFeedback: (liked: boolean) => void;
}

function LearnCard({ session, idx, liked, hasComment, onFeedback }: LearnCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl shadow-xs overflow-hidden">
      <button
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Mission badge */}
        <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-violet-50 border border-violet-200">
          <span className="text-[10px] font-black text-violet-700 leading-none">M{idx + 1}</span>
          <span className="text-[8px] font-bold text-violet-400 leading-none mt-0.5">MISSION</span>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 mb-1 inline-block">
            {session.mission_id}
          </span>
          <h3 className="text-[13px] font-black text-slate-800 leading-snug break-words">{session.title}</h3>
          {!expanded && (
            <div className="flex flex-col gap-1 mt-0.5">
              <p className="text-[11px] text-slate-400 font-semibold break-words">{session.activities.length} hoạt động</p>
              <div className="flex items-center justify-between mt-0.5">
                {liked !== null && (
                  <span className="text-xs">{liked ? "👍" : "👎"}</span>
                )}
                <span className="text-[9px] font-bold text-violet-500 ml-auto">Ấn để xem chi tiết bài học →</span>
              </div>
            </div>
          )}
        </div>

        <span className={`text-[10px] text-slate-400 mt-1 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/40 animate-fade-in flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {session.activities.map((act, i) => {
              const catColor = ACTIVITY_CATEGORY_COLOR[act.category] || "bg-slate-50 text-slate-600 border-slate-200";
              return (
                <div key={i} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-xl px-3 py-2.5">
                  <div className="w-5 h-5 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-[9px] font-black text-violet-700 shrink-0">
                    {i + 1}
                  </div>
                  {act.category && (
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border shrink-0 ${catColor}`}>
                      {act.category}
                    </span>
                  )}
                  <span className="text-[11.5px] text-slate-700 font-semibold flex-1 min-w-0">{act.name}</span>
                </div>
              );
            })}
          </div>

          {/* Thumbs up/down feedback row */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 bg-white p-3 rounded-xl shadow-xs">
            <span className="text-[11.5px] font-bold text-slate-500">Mama hài lòng với buổi này?</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasComment && (
                <span className="text-[9px] text-[#2DB94D] font-bold border border-[#2DB94D]/35 rounded px-1.5 py-0.5">✏️ Nhận xét</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onFeedback(true); }}
                className={`text-[12px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  liked === true ? "bg-[#2DB94D]/15 border-[#2DB94D]/30 scale-105" : "opacity-45 bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                👍 Tốt
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFeedback(false); }}
                className={`text-[12px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  liked === false ? "bg-[#EC4899]/15 border-[#EC4899]/30 scale-105" : "opacity-45 bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                👎 Chưa tốt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function PlannerContent({ dataset }: { dataset: string }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"talk" | "learn">("talk");
  const [showRationale, setShowRationale] = useState(false);

  // Overall Feedback State
  const [userRating, setUserRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  
  // Item Feedback State (Key is unique session string: e.g. "talk_1_1" or "learn_mission_id")
  const [itemFeedback, setItemFeedback] = useState<Record<string, boolean>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});

  // Bottom Sheet State
  const [feedbackSheet, setFeedbackSheet] = useState<
    null | { itemId: string; itemName: string; itemType: "talk" | "learn"; liked: boolean }
  >(null);
  const [sheetText, setSheetText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const fetchPlan = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/api/planner/weekly-plan?dataset=${dataset}&force_refresh=${force}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json() as PlanResponse;
      setPlan(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPlan(); }, [dataset, API_BASE]);

  const openItemSheet = (id: string, name: string, type: "talk" | "learn", liked: boolean) => {
    setItemFeedback(prev => ({ ...prev, [id]: liked }));
    setSheetText(itemComments[id] || "");
    setFeedbackSheet({ itemId: id, itemName: name, itemType: type, liked });
  };

  const handleSheetSubmit = () => {
    if (!feedbackSheet) return;
    if (sheetText.trim()) {
      setItemComments(prev => ({ ...prev, [feedbackSheet.itemId]: sheetText.trim() }));
    }
    setFeedbackSheet(null);
    setSheetText("");
  };

  const handleSubmitAllFeedback = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const itemFeedbackArr = [
        ...talkSessions.map(s => {
          const key = `talk_${s.day}_${s.session}`;
          return {
            id: key,
            title: s.title,
            type: "talk",
            liked: itemFeedback[key] ?? null,
            comment: itemComments[key] ?? null,
          };
        }),
        ...learnSessions.map(s => {
          const key = `learn_${s.mission_id}`;
          return {
            id: key,
            title: s.title,
            type: "learn",
            liked: itemFeedback[key] ?? null,
            comment: itemComments[key] ?? null,
          };
        })
      ].filter(f => f.liked !== null);

      const res = await fetch(`${API_BASE}/api/planner/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          week_label: plan.week_label,
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 min-h-screen bg-[#F5F6F8]">
        <div className="w-10 h-10 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-extrabold tracking-wider">ĐANG TẠO KẾ HOẠCH TUẦN...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 min-h-screen bg-[#F5F6F8]">
        <p className="text-3xl">⚠️</p>
        <p className="text-sm text-slate-600 font-bold text-center max-w-xs">{error || "Không tìm thấy kế hoạch. Hãy thử tạo lại."}</p>
        <button
          onClick={() => fetchPlan(true)}
          className="mt-2 bg-[#2DB94D] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:bg-[#25A344] transition-colors"
        >
          Tạo lại kế hoạch
        </button>
      </div>
    );
  }

  const ws = plan.week_strategy;
  const talkSessions = plan.talk_sessions || [];
  const learnSessions = plan.learn_sessions || [];

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar flex flex-col bg-[#F5F6F8] pb-10">
      {/* Toast feedback thành công */}
      {showToast && (
        <div className="absolute top-4 left-4 right-4 bg-[#2DB94D] rounded-xl py-3 px-4 shadow-lg z-50 text-[11px] font-black text-white flex items-center gap-2 animate-scale-up">
          <span>✓</span> Đánh giá thành công! Cảm ơn ý kiến đóng góp của Mama.
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-100 p-5 shrink-0 z-10 shadow-sm">
        <div className="flex items-start justify-between mb-3.5">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide block">KẾ HOẠCH TUẦN · PIKA BRAIN</span>
            <h2 className="text-[20px] font-extrabold tracking-tight text-slate-800 mt-0.5 leading-tight">
              {ws.theme || "Kế hoạch tuần này"}
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold">{plan.week_label} · {plan.week_start} → {plan.week_end}</span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* Golden plan link */}
            <a
              href={`/planner/golden-plan`}
              className="text-[9px] font-extrabold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 transition-all"
            >
              ⚡ XEM GOLDEN
            </a>
            <button
              onClick={() => fetchPlan(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-50 transition-colors"
              title="Tạo lại kế hoạch"
            >
              <span className={`text-slate-600 text-sm ${refreshing ? "animate-spin inline-block" : ""}`}>↻</span>
            </button>
            {plan.ai_powered && (
              <span className="text-[9px] font-bold text-[#2DB94D] bg-[#2DB94D]/10 px-1.5 py-0.5 rounded-full">AI</span>
            )}
          </div>
        </div>

        {/* Strategy card */}
        <div className="bg-slate-50 border border-[#E8E8E8] rounded-2xl p-3.5 shadow-xs flex flex-col gap-2">
          <p className="text-[11.5px] text-slate-700 font-semibold leading-relaxed">{ws.goal}</p>

          <div className="flex flex-wrap gap-1.5">
            {ws.priority_relationships?.map((r, i) => (
              <span key={i} className="text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">👤 {r}</span>
            ))}
            {ws.important_events?.map((e, i) => (
              <span key={i} className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">🎖️ {e}</span>
            ))}
          </div>

          {ws.parent_rationale && (
            <button
              className="flex items-center justify-between w-full text-left mt-0.5"
              onClick={() => setShowRationale(!showRationale)}
            >
              <span className="text-[10px] font-bold text-[#2DB94D] flex items-center gap-1">
                💡 Vì sao Pika chọn kế hoạch này?
              </span>
              <span className={`text-[9px] text-slate-400 transition-transform ${showRationale ? "rotate-180" : ""}`}>▼</span>
            </button>
          )}
          {showRationale && ws.parent_rationale && (
            <div className="bg-[#2DB94D]/5 border border-[#2DB94D]/20 rounded-xl px-3 py-2 animate-fade-in">
              <p className="text-[11px] text-slate-700 italic leading-relaxed">{ws.parent_rationale}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex bg-white border-b border-slate-100 shrink-0 px-4 sticky top-0 z-20 shadow-md">
        <button
          onClick={() => setActiveTab("talk")}
          className={`flex-1 py-3 text-[10.5px] font-extrabold uppercase tracking-wide border-b-[2.5px] transition-all ${
            activeTab === "talk"
              ? "border-[#2DB94D] text-[#2DB94D]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Trò chuyện ({talkSessions.length})
        </button>
        <button
          onClick={() => setActiveTab("learn")}
          className={`flex-1 py-3 text-[10.5px] font-extrabold uppercase tracking-wide border-b-[2.5px] transition-all ${
            activeTab === "learn"
              ? "border-[#2DB94D] text-[#2DB94D]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Học tập ({learnSessions.length})
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-5 flex flex-col gap-3">

        {/* TALK TAB */}
        {activeTab === "talk" && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">
              💬 {talkSessions.length} buổi trò chuyện trong tuần
            </span>
            {talkSessions.length === 0 ? (
              <p className="text-center text-sm text-slate-400 font-semibold py-8">Chưa có buổi trò chuyện nào</p>
            ) : (
              talkSessions.map((session, idx) => {
                const key = `talk_${session.day}_${session.session}`;
                return (
                  <TalkCard
                    key={idx}
                    session={session}
                    idx={idx}
                    liked={itemFeedback[key] ?? null}
                    hasComment={!!itemComments[key]}
                    onFeedback={(liked) => openItemSheet(key, session.title, "talk", liked)}
                  />
                );
              })
            )}
          </div>
        )}

        {/* LEARN TAB */}
        {activeTab === "learn" && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">
              📚 {learnSessions.length} missions học tập trong tuần
            </span>
            {learnSessions.length === 0 ? (
              <p className="text-center text-sm text-slate-400 font-semibold py-8">Chưa có mission học tập nào</p>
            ) : (
              learnSessions.map((session, idx) => {
                const key = `learn_${session.mission_id}`;
                return (
                  <LearnCard
                    key={idx}
                    session={session}
                    idx={idx}
                    liked={itemFeedback[key] ?? null}
                    hasComment={!!itemComments[key]}
                    onFeedback={(liked) => openItemSheet(key, session.title, "learn", liked)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── OVERALL FEEDBACK SECTION ── */}
      <div className="px-5 pb-5">
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
                {(PLANNER_RATING_TAGS[userRating] || []).map((tag) => {
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
                  onClick={handleSubmitAllFeedback}
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] hover:opacity-95 rounded-xl text-[11.5px] font-black tracking-wider text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    "GỬI ĐÁNH GIÁ KẾ HOẠCH TUẦN 💚"
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
              Đánh giá của Mama đã được lưu lại để Pika cải thiện kế hoạch học tập tuần tới.
            </p>
          </div>
        )}
      </div>

      {/* ── CTA → Schedule ── */}
      <div className="px-5 pb-6">
        <a
          href={`/schedule?dataset=${dataset}`}
          className="flex items-center justify-between w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl px-4 py-3.5 shadow-[0_4px_12px_rgba(245,158,11,0.25)] hover:opacity-95 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-base">🗓️</div>
            <div>
              <span className="text-[12px] font-black text-white block leading-tight">Thiết lập Cấu trúc Ngày học</span>
              <span className="text-[10px] text-white/70 font-semibold">Kéo thả, config ratio, thời gian</span>
            </div>
          </div>
          <span className="text-white/70 group-hover:text-white text-lg transition-colors">→</span>
        </a>
      </div>

      {/* ── FEEDBACK BOTTOM SHEET OVERLAY FOR ITEM COMMENTS ── */}
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
              style={{ maxHeight: "75%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[14px] font-extrabold text-slate-800 animate-fade-in">
                  {feedbackSheet.liked ? "👍 Thích hoạt động" : "👎 Chưa hài lòng với hoạt động"}
                </p>
                <span className="inline-flex items-center gap-1 self-start bg-[#2DB94D]/10 text-[#1A9E3A] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#2DB94D]/25 mt-0.5">
                  {feedbackSheet.itemType === "talk" ? "💬" : "📚"} {feedbackSheet.itemName}
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

// ─── Page Export ──────────────────────────────────────────────────────────────

function PlannerPageInner() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  // Also read from localStorage as fallback to avoid stale hardcoded dataset
  const localStorageId = typeof window !== "undefined" ? localStorage.getItem("profile_id") : null;
  const dataset = searchParams.get("dataset") || profileId || localStorageId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 font-sans flex flex-col items-center justify-center p-0 md:p-6 overflow-x-hidden selection:bg-[#2DB94D]/20 selection:text-[#1A9E3A]">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#2DB94D]/4 blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-400/3 blur-[160px]" />
      </div>

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

        <PlannerContent dataset={dataset} />

        <NavBar dataset={dataset} />

        {/* Home indicator */}
        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PlannerPageInner />
    </Suspense>
  );
}
