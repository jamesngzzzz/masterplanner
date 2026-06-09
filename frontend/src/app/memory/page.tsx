"use client";

import React, { useState, useEffect, Suspense } from "react";
import posthog from "posthog-js";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import NavBar from "../components/NavBar";
import FeedbackModal from "../components/FeedbackModal";

interface MemoryCluster {
  name: string;
  size?: number;
  recency?: string;
  insight_for_parents?: string;
  educational_application?: string;
  top_items: string[];
  engagement_potential?: string;
}

interface LifeEvent {
  event: string;
  date?: string;
  priority?: string;
  follow_up_question?: string;
}

interface Relationship {
  name: string;
  role?: string;
  details?: string;
  mention_count?: number;
  conversation_potential?: string;
}

interface Persona {
  disc_type?: string;
  talkative_score?: number;
  proactive_score?: number;
  emotional_score?: number;
  en_level?: string;
  age_estimate?: number;
  persona_summary?: string;
  persona_tone?: string;
  engage_preferences?: string[];
  engagement_insights?: string;
}

interface GoldenTrend {
  title: string;
  category: string;
  evidence: string;
  source_axis: string;
}

interface GoldenEngagement {
  summary?: string;
  primary_topics?: string[];
  emerging_signals?: string[];
}

interface GoldenDerived {
  summary?: string;
  summary_highlights?: string[];
  trends?: GoldenTrend[];
  growing_skills?: string[];
}

interface MissingPillar {
  domain: string;
  axis: string;
}

interface MemoryData {
  dataset?: string;
  profile_id?: string;
  week_label?: string;
  persona?: Persona;
  memory_clusters?: MemoryCluster[];
  life_events?: LifeEvent[];
  relationship_graph?: Relationship[];
  talk_history?: string[];
  conversation_count?: number;
  message_count?: number;
  generated_at?: string;
  ai_powered?: boolean;
  engagement?: GoldenEngagement;
  derived?: GoldenDerived;
  missing_pillars?: MissingPillar[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISC_EMOJI: Record<string, string> = {
  I: "🌟", S: "🤝", C: "🔍", D: "⚡",
  "I/S": "😄", "S/C": "📚", "C/S": "🎯", "D/I": "🚀",
};

const EN_LEVEL_LABEL: Record<string, string> = {
  pre_a1: "Mới bắt đầu", A1: "A1 - Cơ bản", A2: "A2 - Sơ cấp", B1: "B1 - Trung cấp",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-slate-50 border-slate-200 text-slate-600",
};

const POTENTIAL_DOT: Record<string, string> = {
  high: "bg-[#2DB94D]",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  COGNITIVE: { label: "Nhận thức", emoji: "🧠", color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  LANGUAGE: { label: "Ngôn ngữ", emoji: "💬", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  SOCIAL_EMOTIONAL: { label: "Cảm xúc & Xã hội", emoji: "❤️", color: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200" },
  APPROACHES_TO_LEARNING: { label: "Cách học", emoji: "🎯", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  CULTURAL_VALUES: { label: "Giá trị văn hóa", emoji: "🌺", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Expandable list: shows first maxVisible items, rest behind a toggle */
function ExpandableList<T>({
  items,
  maxVisible = 3,
  renderItem,
}: {
  items: T[];
  maxVisible?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item, i) => renderItem(item, i))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-bold text-[#2DB94D] bg-[#2DB94D]/8 border border-[#2DB94D]/20 rounded-xl px-3 py-1.5 self-start mt-0.5 hover:bg-[#2DB94D]/15 transition-colors"
        >
          {expanded ? "▴ Thu gọn" : `▾ Xem thêm ${items.length - maxVisible} mục`}
        </button>
      )}
    </div>
  );
}

/** Collapsible paragraph that shows first 3 visual lines then expands */
function CollapsibleParagraph({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p className={`${className} ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-bold text-violet-500 mt-1.5 hover:text-violet-700 transition-colors"
      >
        {expanded ? "▴ Thu gọn" : "▾ Xem thêm"}
      </button>
    </div>
  );
}

// ─── MemoryItemCard ───────────────────────────────────────────────────────────
// Shows fact only — Insight toggle removed (content repetition)
function MemoryItemCard({ item, onFeedback, feedback }: {
  item: string;
  onFeedback?: (liked: boolean | null) => void;
  feedback?: boolean | null;
}) {
  const splitIdx = item.indexOf(" — ");
  const fact = splitIdx !== -1 ? item.slice(0, splitIdx).trim() : item;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className="text-[#2DB94D] text-xs mt-0.5 shrink-0">✦</span>
        <span className="text-[11.5px] text-slate-800 leading-relaxed font-semibold flex-1 min-w-0 break-words">{fact}</span>
      </div>
      {onFeedback && (
        <div className="ml-5 flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-slate-400 font-semibold">Điều này có đúng với bé?</span>
          <button
            onClick={() => onFeedback(feedback === true ? null : true)}
            className={`text-[11px] px-1.5 py-0.5 rounded-lg transition-all ${feedback === true ? "bg-green-100 text-green-600 ring-1 ring-green-300" : "text-slate-300 hover:text-green-500 hover:bg-green-50"}`}
          >👍</button>
          <button
            onClick={() => onFeedback(feedback === false ? null : false)}
            className={`text-[11px] px-1.5 py-0.5 rounded-lg transition-all ${feedback === false ? "bg-red-100 text-red-500 ring-1 ring-red-200" : "text-slate-300 hover:text-red-400 hover:bg-red-50"}`}
          >👎</button>
        </div>
      )}
    </div>
  );
}

// ─── Week Summary block — shown as FIRST section in Cụm ký ức tab ─────────────
function WeekSummaryBlock({ engagement }: { engagement?: GoldenEngagement }) {
  if (!engagement?.summary) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-0.5">
        <div className="w-1 h-5 rounded-full bg-[#2DB94D]" />
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">📊 Sự phát triển tuần</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-[#2DB94D]/15 flex items-center justify-center text-[11px]">📊</div>
          <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Nhận xét tuần</span>
        </div>

        {/* Summary paragraph — collapsed to 3 lines, expandable */}
        <CollapsibleParagraph
          text={engagement.summary}
          className="text-[11.5px] text-slate-700 leading-relaxed font-semibold"
        />

        {/* Primary topics — first 3, expandable */}
        {engagement.primary_topics && engagement.primary_topics.length > 0 && (
          <div className="mt-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Chủ đề chính</span>
            <ExpandableList
              items={engagement.primary_topics}
              maxVisible={3}
              renderItem={(t, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#2DB94D]/5 border border-[#2DB94D]/20 rounded-xl px-3 py-2">
                  <span className="text-[10px] font-black text-[#1A9E3A] shrink-0">#{i + 1}</span>
                  <span className="text-[11px] font-bold text-slate-700 break-words min-w-0">{t}</span>
                </div>
              )}
            />
          </div>
        )}

        {/* Emerging signals */}
        {engagement.emerging_signals && engagement.emerging_signals.length > 0 && (
          <div className="mt-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">⚡ Tín hiệu mới nổi</span>
            <div className="flex flex-wrap gap-2">
              {engagement.emerging_signals.map((s, i) => (
                <span key={i} className="text-[10.5px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-xl break-words">
                  ✨ {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GoldenDevelopmentView — Sự phát triển tab ───────────────────────────────
// Engagement summary moved to Cụm ký ức tab — NOT shown here.
// "Đúc kết từ Pika" summary: collapsed to 3 lines. summary_highlights removed (content repetition).
// Axis tags removed from trend cards.
function GoldenDevelopmentView({
  data,
  devFeedback,
  onDevFeedback,
}: {
  data: MemoryData;
  devFeedback: Record<string, boolean | null>;
  onDevFeedback: (key: string, liked: boolean | null) => void;
}) {
  const derived = data.derived;
  const missing = data.missing_pillars || [];

  return (
    <div className="flex flex-col gap-4">

      {/* Đúc kết từ Pika — summary collapsed to 3 lines; highlights (✦ bullets) removed */}
      {derived?.summary && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-[11px] text-white">💡</div>
            <span className="text-[9.5px] font-extrabold text-violet-700 uppercase tracking-widest">Đúc kết từ Pika</span>
          </div>
          {/* Collapsed paragraph — summary_highlights (✦ items) are removed, they duplicate the summary */}
          <CollapsibleParagraph
            text={derived.summary}
            className="text-[11.5px] text-violet-900 leading-relaxed font-semibold"
          />
        </div>
      )}

      {/* Trends — axis tag (🧠 Tưởng tượng, etc.) removed */}
      {derived?.trends && derived.trends.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">📈 Xu hướng nổi bật</span>
          {derived.trends.map((trend, i) => {
            const cat = CATEGORY_CONFIG[trend.category] || { label: trend.category, emoji: "📌", color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" };
            return (
              <div key={i} className={`bg-white border ${cat.border} rounded-2xl p-4 shadow-xs`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.emoji}</span>
                    <span className="text-[12.5px] font-black text-slate-800 break-words">{trend.title}</span>
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${cat.bg} ${cat.color} border ${cat.border}`}>
                    {cat.label}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-[9px] font-black text-slate-500 block mb-0.5">Bằng chứng</span>
                  <p className="text-[11px] text-slate-700 font-semibold leading-relaxed break-words">{trend.evidence}</p>
                </div>
                {/* Axis tag removed — feedback buttons remain */}
                <div className="flex justify-end mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDevFeedback(`trend_${i}`, devFeedback[`trend_${i}`] === true ? null : true)}
                      className={`text-[11px] px-1.5 py-0.5 rounded-lg border transition-all ${devFeedback[`trend_${i}`] === true ? "bg-[#2DB94D]/15 border-[#2DB94D]/30" : "opacity-35 bg-slate-50 border-slate-200"}`}
                    >👍</button>
                    <button
                      onClick={() => onDevFeedback(`trend_${i}`, devFeedback[`trend_${i}`] === false ? null : false)}
                      className={`text-[11px] px-1.5 py-0.5 rounded-lg border transition-all ${devFeedback[`trend_${i}`] === false ? "bg-[#EC4899]/15 border-[#EC4899]/30" : "opacity-35 bg-slate-50 border-slate-200"}`}
                    >👎</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Growing skills */}
      {derived?.growing_skills && derived.growing_skills.length > 0 && (
        <div className="bg-[#2DB94D]/5 border border-[#2DB94D]/20 rounded-2xl p-4">
          <span className="text-[9.5px] font-extrabold text-[#1A9E3A] uppercase tracking-widest block mb-2.5">🌱 Kỹ năng đang phát triển</span>
          <div className="flex flex-col gap-2">
            {derived.growing_skills.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-[#2DB94D]/30 rounded-xl px-3 py-2 shadow-xs">
                <span className="text-[11px] font-bold text-[#1A9E3A] break-words flex-1 min-w-0">✔️ {s}</span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => onDevFeedback(`skill_${i}`, devFeedback[`skill_${i}`] === true ? null : true)}
                    className={`text-[11px] px-1.5 py-0.5 rounded-lg border transition-all ${devFeedback[`skill_${i}`] === true ? "bg-[#2DB94D]/15 border-[#2DB94D]/30" : "opacity-35 bg-slate-50 border-slate-200"}`}
                  >👍</button>
                  <button
                    onClick={() => onDevFeedback(`skill_${i}`, devFeedback[`skill_${i}`] === false ? null : false)}
                    className={`text-[11px] px-1.5 py-0.5 rounded-lg border transition-all ${devFeedback[`skill_${i}`] === false ? "bg-[#EC4899]/15 border-[#EC4899]/30" : "opacity-35 bg-slate-50 border-slate-200"}`}
                  >👎</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing pillars */}
      {missing.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[9.5px] font-extrabold text-amber-700 uppercase tracking-widest block mb-2.5">🎯 Cơ hội phát triển ({missing.length} điểm)</span>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((p, i) => {
              const cat = CATEGORY_CONFIG[p.domain];
              return (
                <span key={i} className="inline-flex items-center gap-1 text-[9.5px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-xl">
                  {cat?.emoji} {cat?.label || p.domain}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Cluster Card ─────────────────────────────────────────────────
function ClusterCard({
  cluster, cIdx, defaultOpen, itemFeedback, editingIndex, editingText, newFactTexts,
  onFeedback, onStartEdit, onSaveEdit, onCancelEdit, onEditTextChange,
  onDeleteFact, onAddFact, onNewFactTextChange,
}: {
  cluster: MemoryCluster;
  cIdx: number;
  defaultOpen: boolean;
  itemFeedback: Record<string, boolean | null>;
  editingIndex: { clusterIdx: number; itemIdx: number } | null;
  editingText: string;
  newFactTexts: Record<number, string>;
  onFeedback: (cIdx: number, iIdx: number, liked: boolean | null) => void;
  onStartEdit: (cIdx: number, iIdx: number, text: string) => void;
  onSaveEdit: (cIdx: number, iIdx: number) => void;
  onCancelEdit: () => void;
  onEditTextChange: (val: string) => void;
  onDeleteFact: (cIdx: number, iIdx: number) => void;
  onAddFact: (cIdx: number) => void;
  onNewFactTextChange: (cIdx: number, val: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl shadow-xs overflow-hidden">
      {/* Header — click to toggle */}
      <button
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {cluster.engagement_potential && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${POTENTIAL_DOT[cluster.engagement_potential] || "bg-slate-300"}`} />
          )}
          {/* Name wraps instead of truncating to avoid overflow */}
          <span className="text-[12.5px] font-black text-slate-800 uppercase tracking-wide leading-snug break-words min-w-0">{cluster.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cluster.top_items?.length > 0 && (
            <span className="text-[10px] font-extrabold bg-[#2DB94D]/10 text-[#1A9E3A] px-2 py-0.5 rounded-full whitespace-nowrap">
              {cluster.top_items.length} đặc điểm
            </span>
          )}
          <span className={`text-[10px] text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {/* Collapsed hint — changes to CTA when not open */}
      {!open && (
        <div className="px-4 pb-3 flex justify-end">
          <button
            onClick={() => setOpen(true)}
            className="text-[9.5px] font-bold text-[#2DB94D]/70 hover:text-[#2DB94D] transition-colors"
          >
            Ấn để xem chi tiết thông tin về con →
          </button>
        </div>
      )}

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 animate-fade-in flex flex-col gap-3">
          <div className="flex flex-col gap-2.5">
            {cluster.top_items?.map((item, iIdx) => {
              const isEditing = editingIndex?.clusterIdx === cIdx && editingIndex?.itemIdx === iIdx;
              return (
                <div key={iIdx} className="group flex flex-col gap-0 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl p-2.5 transition-colors">
                  {isEditing ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => onEditTextChange(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11.5px] font-medium text-slate-800 focus:outline-none focus:border-[#2DB94D]"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(cIdx, iIdx); if (e.key === "Escape") onCancelEdit(); }}
                      />
                      <button onClick={() => onSaveEdit(cIdx, iIdx)} className="bg-[#2DB94D] text-white rounded-lg px-2.5 text-[10px] font-bold">Lưu</button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        <MemoryItemCard
                          item={item}
                          feedback={itemFeedback[`${cIdx}-${iIdx}`]}
                          onFeedback={(liked) => onFeedback(cIdx, iIdx, liked)}
                        />
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-60 transition-opacity mt-0.5 shrink-0">
                        <button onClick={() => onStartEdit(cIdx, iIdx, item)} className="text-slate-400 hover:text-blue-500 text-xs">✏️</button>
                        <button onClick={() => onDeleteFact(cIdx, iIdx)} className="text-slate-400 hover:text-red-500 text-xs">🗑️</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add fact */}
          <div className="flex gap-2 mt-1 pt-2 border-t border-slate-100">
            <input
              type="text"
              placeholder="Thêm ghi nhớ mới..."
              value={newFactTexts[cIdx] || ""}
              onChange={(e) => onNewFactTextChange(cIdx, e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-[11.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2DB94D] focus:bg-white"
              onKeyDown={(e) => { if (e.key === "Enter") onAddFact(cIdx); }}
            />
            <button onClick={() => onAddFact(cIdx)} className="bg-[#2DB94D]/10 hover:bg-[#2DB94D] hover:text-white text-[#1A9E3A] rounded-xl px-4 text-xs font-black transition-all">+ Thêm</button>
          </div>

          {/* When open — show "Đóng" instead of "Ấn để xem..." */}
          <div className="flex justify-end mt-0.5">
            <button
              onClick={() => setOpen(false)}
              className="text-[9.5px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Đóng ▴
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function MemoryContent({ dataset }: { dataset: string }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
  const router = useRouter();

  const [data, setData] = useState<MemoryData>({});
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleNavigateToPlanner = () => {
    const feedbackSubmitted = localStorage.getItem("has_given_usefulness_feedback");
    if (!feedbackSubmitted) {
      setIsFeedbackOpen(true);
    } else {
      router.push(`/planner/golden-plan?dataset=${dataset}`);
    }
  };

  const handleFeedbackClose = (rating?: number, comment?: string) => {
    setIsFeedbackOpen(false);
    localStorage.setItem("has_given_usefulness_feedback", "true");
    
    if (rating) {
      // Capture feedback in PostHog
      posthog.capture("feature_usefulness_rated", {
        feature: "Xem Kế Hoạch Tuần",
        rating,
        comment,
        from_page: "/memory",
        to_page: "/planner/golden-plan",
        dataset,
      });
    }
    
    router.push(`/planner/golden-plan?dataset=${dataset}`);
  };
  const [clusters, setClusters] = useState<MemoryCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"memory" | "development" | "history">("memory");
  const [devFeedback, setDevFeedback] = useState<Record<string, boolean | null>>({});
  const [itemFeedback, setItemFeedback] = useState<Record<string, boolean | null>>({});
  const [editingIndex, setEditingIndex] = useState<{ clusterIdx: number; itemIdx: number } | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newFactTexts, setNewFactTexts] = useState<Record<number, string>>({});
  const [saveToast, setSaveToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleItemFeedback = (clusterIdx: number, itemIdx: number, liked: boolean | null) => {
    setItemFeedback(prev => ({ ...prev, [`${clusterIdx}-${itemIdx}`]: liked }));
  };

  const saveToServer = async (updatedClusters: MemoryCluster[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/planner/memory/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, memory_clusters: updatedClusters }),
      });
      if (!res.ok) {
        setSaveToast({ ok: false, msg: "Lưu thất bại. Vui lòng thử lại." });
      } else {
        setSaveToast({ ok: true, msg: "Đã lưu ✓ — Kế hoạch tuần sẽ được cập nhật." });
      }
    } catch {
      setSaveToast({ ok: false, msg: "Không thể kết nối đến máy chủ." });
    } finally {
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/planner/memo?dataset=${dataset}`);
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(res.status === 404 ? "Chưa có dữ liệu cho người dùng này." : `Lỗi ${res.status}: ${detail}`);
        }
        const json: MemoryData = await res.json();
        setData(json);
        if (json.memory_clusters?.length) setClusters(json.memory_clusters);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
      } finally {
        setLoading(false);
      }
    };
    fetchMemory();
  }, [dataset, API_BASE]);

  const handleSaveEdit = (cIdx: number, iIdx: number) => {
    if (!editingText.trim()) return;
    const updated = [...clusters];
    updated[cIdx].top_items[iIdx] = editingText.trim();
    setClusters(updated);
    setEditingIndex(null);
    setEditingText("");
    saveToServer(updated);
  };

  const handleDeleteFact = (cIdx: number, iIdx: number) => {
    const updated = [...clusters];
    updated[cIdx].top_items.splice(iIdx, 1);
    setClusters(updated);
    saveToServer(updated);
  };

  const handleAddFact = (cIdx: number) => {
    const text = newFactTexts[cIdx] || "";
    if (!text.trim()) return;
    const updated = [...clusters];
    updated[cIdx].top_items.push(text.trim());
    setClusters(updated);
    setNewFactTexts(prev => ({ ...prev, [cIdx]: "" }));
    saveToServer(updated);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-extrabold tracking-wider">ĐANG TẢI KÝ ỨC CỦA PIKA...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <span className="text-3xl">📭</span>
        <p className="text-[12px] text-slate-500 font-bold text-center">{fetchError}</p>
        <p className="text-[10px] text-slate-400 font-semibold text-center font-mono">{dataset}</p>
      </div>
    );
  }

  const persona = data.persona;
  const lifeEvents = data.life_events || [];
  const relationships = data.relationship_graph || [];

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar flex flex-col bg-[#F5F6F8] pb-10">

      {/* Toast */}
      {saveToast && (
        <div className={`absolute top-3 left-3 right-3 z-50 rounded-xl px-4 py-2.5 shadow-lg text-[11px] font-black text-white flex items-center gap-2 animate-scale-up ${saveToast.ok ? "bg-[#2DB94D]" : "bg-red-500"}`}>
          <span>{saveToast.ok ? "✓" : "⚠️"}</span>
          {saveToast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 tracking-wide block">BỘ NHớ PIKA BRAIN</span>
            <h2 className="text-[20px] font-extrabold tracking-tight text-slate-800 mt-0.5 leading-tight">Hồ sơ của bé</h2>
          </div>
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-gradient-to-tr from-[#2DB94D]/10 to-[#FF9500]/10 flex items-center justify-center text-sm shadow-sm shrink-0">🧒</div>
        </div>

        {persona && (
          <div className="bg-slate-50 border border-[#E8E8E8] rounded-2xl p-3.5 shadow-xs flex flex-col gap-2.5">
            <p className="text-[11.5px] text-slate-700 font-semibold leading-relaxed">
              {persona.persona_summary || "Pika đang tìm hiểu thêm về bé..."}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {persona.disc_type && (
                <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                  {DISC_EMOJI[persona.disc_type] || "✨"} DISC-{persona.disc_type}
                </span>
              )}
              {persona.en_level && (
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  🇬🇧 {EN_LEVEL_LABEL[persona.en_level] || persona.en_level}
                </span>
              )}
              {persona.age_estimate && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                  🎂 Khoảng {persona.age_estimate} tuổi
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { label: "Năng động", val: persona.talkative_score, color: "bg-blue-400" },
                { label: "Chủ động", val: persona.proactive_score, color: "bg-emerald-400" },
                { label: "Cảm xúc", val: persona.emotional_score, color: "bg-rose-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-[8.5px] text-slate-400 font-bold uppercase mb-0.5">{label}</span>
                  <div className="h-1.5 bg-slate-200 rounded-full w-full overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${((val || 5) / 10) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Guidance Tip for Older Parents */}
      <div className="mx-4 mt-4 bg-emerald-50/60 border border-emerald-100/80 rounded-2xl p-3 flex items-start gap-2.5 shadow-xs">
        <span className="text-base shrink-0 animate-bounce">💡</span>
        <div className="flex-1">
          <p className="text-[11px] font-black text-emerald-800 leading-snug">Gợi ý dành cho Bố Mẹ</p>
          <p className="text-[10px] text-emerald-600/90 font-bold mt-0.5 leading-normal">
            Chạm vào các thẻ <strong className="text-emerald-700">Cụm ký ức</strong>, <strong className="text-emerald-700">Sự phát triển</strong> hoặc <strong className="text-emerald-700">Lịch sử</strong> bên dưới để xem đầy đủ báo cáo học tập của con.
          </p>
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="bg-slate-100 border border-slate-200/60 p-1 rounded-2xl mx-4 my-3 flex gap-1 z-20 shrink-0 sticky top-0 shadow-xs">
        {(["memory", "development", "history"] as const).map((tab) => {
          const tabConfig = {
            memory: { label: "Cụm ký ức", icon: "🧠" },
            development: { label: "Sự phát triển", icon: "📈" },
            history: { label: "Lịch sử", icon: "🕒" }
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => { 
                setActiveTab(tab); 
                posthog.capture("memory_tab_switched", { tab, dataset }); 
              }}
              className={`flex-1 py-2.5 rounded-xl text-[10.5px] font-black tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                isActive 
                  ? "bg-white text-[#2DB94D] shadow-xs shadow-slate-200/80 scale-[1.02]" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="text-xs shrink-0">{tabConfig[tab].icon}</span>
              <span>{tabConfig[tab].label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-5 flex flex-col gap-5">

        {/* TAB 1: Cụm ký ức */}
        {activeTab === "memory" && (
          <div className="animate-fade-in flex flex-col gap-5">

            {/* ① Sự phát triển tuần — FIRST, before clusters */}
            <WeekSummaryBlock engagement={data.engagement} />

            {/* ② Clusters — collapsible, first one open by default */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">🧠 Cụm ký ức</span>
              {clusters.map((cluster, cIdx) => (
                <ClusterCard
                  key={cIdx}
                  cluster={cluster}
                  cIdx={cIdx}
                  defaultOpen={cIdx === 0}
                  itemFeedback={itemFeedback}
                  editingIndex={editingIndex}
                  editingText={editingText}
                  newFactTexts={newFactTexts}
                  onFeedback={handleItemFeedback}
                  onStartEdit={(ci, ii, text) => { setEditingIndex({ clusterIdx: ci, itemIdx: ii }); setEditingText(text); }}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={() => setEditingIndex(null)}
                  onEditTextChange={setEditingText}
                  onDeleteFact={handleDeleteFact}
                  onAddFact={handleAddFact}
                  onNewFactTextChange={(ci, val) => setNewFactTexts(prev => ({ ...prev, [ci]: val }))}
                />
              ))}
            </div>

            {/* ③ Life Events */}
            {lifeEvents.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">🗓️ Sự kiện đáng nhớ</span>
                {lifeEvents.map((ev, i) => (
                  <div key={i} className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col gap-2 ${PRIORITY_COLOR[ev.priority || "medium"] || "border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-sm mt-0.5">🎖️</span>
                        <span className="text-[12px] font-bold text-slate-800 leading-snug break-words">{ev.event}</span>
                      </div>
                      {ev.priority && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_COLOR[ev.priority]}`}>
                          {ev.priority === "high" ? "Quan trọng" : ev.priority === "medium" ? "Bình thường" : "Thấp"}
                        </span>
                      )}
                    </div>
                    {ev.follow_up_question && (
                      <div className="bg-white/60 border border-current/20 rounded-xl px-3 py-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Pika có thể hỏi:</span>
                        <span className="text-[11px] text-slate-700 italic">"{ev.follow_up_question}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ④ Relationships */}
            {relationships.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-0.5">👥 Mối quan hệ</span>
                <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
                  {relationships.map((rel, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-100 to-blue-100 flex items-center justify-center text-sm shrink-0 font-bold text-purple-700">
                        {rel.name?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12.5px] font-bold text-slate-800">{rel.name}</span>
                          {rel.role && <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full capitalize">{rel.role}</span>}
                          {rel.mention_count && <span className="text-[9px] font-semibold text-slate-400">{rel.mention_count}x đề cập</span>}
                        </div>
                        {rel.details && <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 leading-relaxed">{rel.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Sự phát triển */}
        {activeTab === "development" && (
          <div className="animate-fade-in flex flex-col gap-4">
            <GoldenDevelopmentView
              data={data}
              devFeedback={devFeedback}
              onDevFeedback={(key, liked) => setDevFeedback(prev => ({ ...prev, [key]: liked }))}
            />
          </div>
        )}

        {/* TAB 3: Lịch sử */}
        {activeTab === "history" && (
          <div className="animate-fade-in flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 p-2.5 text-center shadow-xs">
                <span className="text-[16px] font-black text-[#2DB94D] block">{data.conversation_count || 0}</span>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">Hội thoại</span>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-slate-200 p-2.5 text-center shadow-xs">
                <span className="text-[16px] font-black text-slate-700 block">{data.message_count || 0}</span>
                <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">Lượt nói</span>
              </div>
            </div>
            {data.talk_history && data.talk_history.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Chủ đề đã khám phá tuần này</span>
                  <span className="text-[8px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{data.talk_history.length} chủ đề</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.talk_history.map((topic, idx) => {
                    const colors = [
                      "bg-violet-50 border-violet-200 text-violet-700",
                      "bg-blue-50 border-blue-200 text-blue-700",
                      "bg-emerald-50 border-emerald-200 text-emerald-700",
                      "bg-amber-50 border-amber-200 text-amber-700",
                      "bg-pink-50 border-pink-200 text-pink-700",
                      "bg-cyan-50 border-cyan-200 text-cyan-700",
                      "bg-indigo-50 border-indigo-200 text-indigo-700",
                      "bg-orange-50 border-orange-200 text-orange-700",
                    ];
                    return (
                      <span key={idx} className={`inline-flex items-center gap-1 border rounded-xl px-3 py-1.5 text-[11px] font-bold ${colors[idx % colors.length]}`}>
                        <span className="text-[9px] opacity-60">#{idx + 1}</span>
                        {topic}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic text-center py-4">Chưa có lịch sử hội thoại</p>
            )}
          </div>
        )}

      </div>

      {/* CTA Bottom */}
      <div className="p-4 shrink-0 bg-white border-t border-slate-100 z-10">
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">📅</span>
            <div className="flex-1">
              <h4 className="text-xs font-black text-slate-800">Kế hoạch tuần</h4>
              <p className="text-[10.5px] text-slate-400 font-semibold leading-normal mt-0.5">
                Xem danh sách chủ đề và kế hoạch học tập sẽ diễn ra trong tuần này.
              </p>
            </div>
          </div>
          <button
            onClick={handleNavigateToPlanner}
            className="mt-3.5 w-full bg-[#2DB94D] hover:bg-[#259E3F] text-white text-[11px] font-black py-2 rounded-2xl shadow-sm shadow-[#2DB94D]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
          >
            Xem kế hoạch tuần <span className="text-[10px]">➔</span>
          </button>
        </div>
      </div>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={handleFeedbackClose}
        featureName="Cụm Ký Ức & Phát Triển"
      />
    </div>
  );
}

function MemoryPageInner() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  // Also read from localStorage as fallback to avoid using hardcoded stale dataset
  const localStorageId = typeof window !== "undefined" ? localStorage.getItem("profile_id") : null;
  const dataset = searchParams.get("dataset") || profileId || localStorageId || "019cff81-1bc3-7939-9230-a1f032605728";

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
        <MemoryContent dataset={dataset} />
        <NavBar dataset={dataset} />
        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function MemoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MemoryPageInner />
    </Suspense>
  );
}
