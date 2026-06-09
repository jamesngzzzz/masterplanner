"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import NavBar from "../components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType = "GREETING" | "TALK" | "TALK_ACTIVITY" | "LEARN" | "WARM_UP" | "GAME" | "WRAP_UP";

interface ScheduleBlock {
  id: string;
  type: BlockType;
  label: string;
  emoji: string;
  duration_min: number;
  enabled: boolean;
  locked?: boolean;
}

interface RecommendResult {
  adapted_blocks: ScheduleBlock[];
  recommendations: string[];
  warnings: string[];
  stats: {
    total_minutes: number;
    target_minutes: number;
    delta_minutes: number;
    talk_pct: number;
    learn_pct: number;
    fit_score: number;
  };
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const BLOCK_STYLE: Record<BlockType, { bg: string; accent: string; solidBg: string }> = {
  GREETING:      { bg: "bg-slate-100",     accent: "text-slate-600",  solidBg: "bg-slate-400" },
  WARM_UP:       { bg: "bg-amber-100",     accent: "text-amber-700",  solidBg: "bg-[#FFB703]" },
  LEARN:         { bg: "bg-emerald-100",   accent: "text-emerald-700",solidBg: "bg-[#2DB94D]" },
  TALK:          { bg: "bg-blue-100",      accent: "text-blue-700",   solidBg: "bg-blue-400" },
  TALK_ACTIVITY: { bg: "bg-purple-100",    accent: "text-purple-700", solidBg: "bg-[#A855F7]" },
  GAME:          { bg: "bg-pink-100",      accent: "text-pink-700",   solidBg: "bg-pink-500" },
  WRAP_UP:       { bg: "bg-indigo-100",    accent: "text-indigo-700", solidBg: "bg-indigo-400" },
};

const BLOCK_META: Record<BlockType, { emoji: string; label: string; shortLabel: string }> = {
  GREETING:      { emoji: "👋", label: "Chào hỏi & Check-in", shortLabel: "Chào" },
  WARM_UP:       { emoji: "🔥", label: "Warm-up Tiếng Anh",   shortLabel: "WarmUp" },
  LEARN:         { emoji: "📚", label: "Học tiếng Anh",       shortLabel: "Học" },
  TALK:          { emoji: "💬", label: "Trò chuyện",          shortLabel: "Talk" },
  TALK_ACTIVITY: { emoji: "🎭", label: "Trò chuyện / Game",   shortLabel: "Talk" },
  GAME:          { emoji: "🎮", label: "Game vui",            shortLabel: "Game" },
  WRAP_UP:       { emoji: "🌙", label: "Kết thúc & Nghỉ ngơi",shortLabel: "Kết" },
};

const PHASE3_DEFAULT: ScheduleBlock[] = [
  { id: "b1", type: "GREETING",      label: "Chào hỏi & Check-in", emoji: "👋", duration_min: 3,  enabled: true, locked: true  },
  { id: "b2", type: "WARM_UP",       label: "Warm-up Tiếng Anh",   emoji: "🔥", duration_min: 5,  enabled: true, locked: false },
  { id: "b3", type: "LEARN",         label: "Học tiếng Anh · Unit 1", emoji: "📚", duration_min: 8, enabled: true, locked: false },
  { id: "b4", type: "LEARN",         label: "Học tiếng Anh · Unit 2", emoji: "📚", duration_min: 8, enabled: true, locked: false },
  { id: "b5", type: "LEARN",         label: "Học tiếng Anh · Unit 3", emoji: "📚", duration_min: 8, enabled: true, locked: false },
  { id: "b6", type: "TALK_ACTIVITY", label: "Trò chuyện / Game",   emoji: "🎭", duration_min: 10, enabled: true, locked: false },
  { id: "b7", type: "WRAP_UP",       label: "Kết thúc & Nghỉ ngơi",emoji: "🌙", duration_min: 2,  enabled: true, locked: true  },
];

const PRESETS = [
  { id: "talk_heavy",     label: "Talk Heavy", desc: "Tập trung trò chuyện", talk: 3, learn: 2 },
  { id: "balanced",       label: "Cân bằng",   desc: "Xen kẽ đều", talk: 2, learn: 3 },
  { id: "learn_heavy",    label: "Learn Heavy",desc: "Học là chính", talk: 1, learn: 4 },
  { id: "phase3_default", label: "Phase 3",    desc: "Lộ trình chuẩn", talk: 1, learn: 3 },
];

const ADD_OPTIONS: { type: BlockType; label: string }[] = [
  { type: "TALK_ACTIVITY", label: "Trò chuyện / Game"},
  { type: "LEARN",         label: "Học tiếng Anh"},
  { type: "WARM_UP",       label: "Khởi động"    },
  { type: "GAME",          label: "Game vui"      },
];

let _counter = 100;
const newId = () => `b${++_counter}`;

// ─── Main Component ───────────────────────────────────────────────────────────

import { useAuth } from "@/contexts/AuthContext";

function ScheduleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profileId, phone } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [blocks, setBlocks] = useState<ScheduleBlock[]>(PHASE3_DEFAULT);
  const [preset, setPreset] = useState("phase3_default");
  const [sessionMin, setSessionMin] = useState(45);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [includeGame, setIncludeGame] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const [recommend, setRecommend] = useState<RecommendResult | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const adaptTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load initial config
  useEffect(() => {
    (async () => {
      try {

        const res = await fetch(`${API_BASE}/api/planner/schedule-config?dataset=${dataset}`);
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.blocks?.length) setBlocks(cfg.blocks);
          if (cfg.preset) setPreset(cfg.preset);
          if (cfg.session_duration_min) setSessionMin(cfg.session_duration_min);
          if (cfg.days_per_week) setDaysPerWeek(cfg.days_per_week);
          if (typeof cfg.include_game === "boolean") setIncludeGame(cfg.include_game);
          if (cfg.feedback_text) setFeedbackText(cfg.feedback_text);
        }
      } catch (err: any) {
        console.error("Config Error:", err);
      }
      setLoading(false);
    })();
  }, [dataset, API_BASE, profileId, phone]);

  // Call /recommend whenever any config changes (debounced 600ms)
  const callRecommend = useCallback(() => {
    if (adaptTimeout.current) clearTimeout(adaptTimeout.current);
    adaptTimeout.current = setTimeout(async () => {
      setAdapting(true);
      try {
        const res = await fetch(`${API_BASE}/api/planner/schedule-config/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, preset, session_duration_min: sessionMin, days_per_week: daysPerWeek, blocks }),
        });
        if (res.ok) {
          const data: RecommendResult = await res.json();
          setRecommend(data);
          // Auto-apply adapted block durations (the visual update)
          setBlocks(prev => data.adapted_blocks.map((ab, i) => ({
            ...prev.find(pb => pb.id === ab.id) || ab,
            duration_min: ab.duration_min,
          })));
        }
      } catch (_) {}
      setAdapting(false);
    }, 600);
  }, [blocks, preset, sessionMin, daysPerWeek, dataset, API_BASE]);

  useEffect(() => {
    if (!loading) callRecommend();
    return () => { if (adaptTimeout.current) clearTimeout(adaptTimeout.current); };
  }, [preset, sessionMin, daysPerWeek, loading]);

  // Drag handlers
  const onDrop = () => {
    const from = dragIdx.current, to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;
    if (blocks[from]?.locked || blocks[to]?.locked) return;
    const next = [...blocks];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setBlocks(next);
    dragIdx.current = null; dragOverIdx.current = null; setDragging(null);
  };
  const onDragEnd = () => setDragging(null);

  // Actions
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));
  const changeDuration = (id: string, d: number) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, duration_min: Math.max(1, b.duration_min + d) } : b));
  const toggleEnabled = (id: string) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  const addBlock = (type: BlockType) => {
    const m = BLOCK_META[type];
    const block: ScheduleBlock = { id: newId(), type, label: m.label, emoji: m.emoji, duration_min: type === "LEARN" ? 8 : 5, enabled: true };
    const wrapIdx = blocks.findIndex(b => b.type === "WRAP_UP");
    const next = [...blocks];
    next.splice(wrapIdx >= 0 ? wrapIdx : next.length, 0, block);
    setBlocks(next);
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/planner/schedule-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, preset, session_duration_min: sessionMin, days_per_week: daysPerWeek, include_greeting: true, include_game: includeGame, blocks, feedback_text: feedbackText }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (_) {}
    setSaving(false);
  };

  const enabled = blocks.filter(b => b.enabled);
  const totalMin = enabled.reduce((s, b) => s + b.duration_min, 0);
  const talkCount = enabled.filter(b => b.type === "TALK" || b.type === "TALK_ACTIVITY").length;
  const learnCount = enabled.filter(b => b.type === "LEARN").length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const miniToggle = (on: boolean, onToggle: () => void) => (
    <button onClick={onToggle}
      className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${on ? "bg-emerald-500" : "bg-slate-200"}`}>
      <div className={`w-4 h-4 bg-white rounded-full absolute top-[2px] shadow transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white shrink-0 shadow-sm z-10 relative">
        <div className="flex flex-col">
          <p className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase">Cấu trúc ngày học</p>
          <h1 className="text-lg font-extrabold text-slate-800 leading-tight">Thiết lập lịch</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`text-[12px] font-extrabold px-4 py-2 rounded-xl transition-all shadow-md ${
            saved ? "bg-emerald-100 text-emerald-700" : "bg-[#2DB94D] text-white hover:bg-emerald-600"
          } disabled:opacity-60`}>
          {saving ? "⏳" : saved ? "✓ Đã lưu" : "LƯU"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">



        {/* ─── Top Status Pills ─── */}
        <div className="flex items-center gap-2 px-4 py-3 bg-white">
          {[
            { bg: "bg-slate-50", text: "text-slate-600", label: <><span className="text-[14px] font-black text-slate-800">{totalMin}</span> phút</> },
            { bg: "bg-blue-50", text: "text-blue-500", label: <><span className="text-[14px] font-black text-blue-600">{talkCount}</span> Talk</> },
            { bg: "bg-emerald-50", text: "text-emerald-500", label: <><span className="text-[14px] font-black text-emerald-600">{learnCount}</span> Learn</> },
            { bg: "bg-amber-50", text: "text-amber-500", label: <><span className="text-[14px] font-black text-amber-600">{daysPerWeek}</span> ngày</> },
          ].map((p, i) => (
            <div key={i} className={`${p.bg} ${p.text} text-[11px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap flex-1 text-center border border-slate-100`}>
              {p.label}
            </div>
          ))}
        </div>

        {/* ─── Visual Horizontal Timeline ─── */}
        <div className="bg-white px-4 pb-4">
          <div className="w-full flex h-14 rounded-xl overflow-hidden shadow-sm border border-slate-200">
            {enabled.map((block, idx) => {
              const pct = totalMin > 0 ? (block.duration_min / totalMin) * 100 : 100 / enabled.length;
              const s = BLOCK_STYLE[block.type];
              return (
                <div
                  key={block.id}
                  draggable={!block.locked}
                  onDragStart={() => { dragIdx.current = idx; setDragging(idx); }}
                  onDragOver={e => { e.preventDefault(); dragOverIdx.current = idx; }}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  style={{ width: `${pct}%` }}
                  className={`h-full ${s.solidBg} border-r-2 border-white flex flex-col items-center justify-center transition-all cursor-grab active:cursor-grabbing hover:brightness-110 relative group`}
                  title={`${block.label} (${block.duration_min}p)`}
                >
                  {/* Emoji & text overlay */}
                  {pct > 10 && (
                    <span className="text-lg leading-none drop-shadow-sm">{block.emoji}</span>
                  )}
                  {pct > 15 && (
                    <span className="text-[10px] font-extrabold text-white leading-none mt-1 drop-shadow-sm">
                      {block.duration_min}p
                    </span>
                  )}
                  {pct <= 15 && pct > 8 && (
                    <span className="text-[8px] font-extrabold text-white leading-none mt-0.5 drop-shadow-sm opacity-80">{block.duration_min}p</span>
                  )}
                  {block.locked && (
                    <span className="absolute top-1 left-1 text-[8px] opacity-40">🔒</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar label */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-400 font-bold">0p</span>
            <div className="flex-1 mx-2 flex flex-col gap-1">
              <span className={`text-[10px] font-bold text-right ${totalMin > sessionMin ? "text-red-500" : "text-emerald-500"}`}>
                {totalMin}p / {sessionMin}p ({Math.round((totalMin / sessionMin) * 100)}%)
              </span>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full relative">
                <div 
                  className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-300 ${totalMin > sessionMin ? "bg-red-400" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (totalMin / sessionMin) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Backend Auto-scaling Feedback */}
          {recommend?.recommendations && recommend.recommendations.length > 0 && (
            <div className="mt-3 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
              <span className="text-blue-500 text-sm leading-tight mt-0.5">💡</span>
              <p className="text-[11px] text-blue-700 font-medium leading-snug">
                {recommend.recommendations[0]}
              </p>
            </div>
          )}
        </div>

        <div className="w-full h-1.5 bg-slate-100" />

        {/* ─── Configuration ─── */}
        <div className="p-4 flex flex-col gap-6">

          {/* PRESET RATIO */}
          <div>
            <h3 className="text-[11px] font-black text-slate-500 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="text-base">🎛</span> PRESET RATIO
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setPreset(p.id)}
                  className={`p-3 rounded-2xl text-left transition-all border-2 ${
                    preset === p.id
                      ? "bg-emerald-50 border-emerald-400"
                      : "bg-white border-transparent shadow-sm hover:border-emerald-200"
                  }`}
                >
                  <p className="text-[13px] font-extrabold text-slate-800 leading-tight">{p.label}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{p.desc}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-100 rounded-md px-1.5 py-0.5 shadow-sm">💬 {p.talk}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-100 rounded-md px-1.5 py-0.5 shadow-sm">📚 {p.learn}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CẤU HÌNH CHUNG */}
          <div>
            <h3 className="text-[11px] font-black text-slate-500 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="text-base">⚙️</span> CẤU HÌNH CHUNG
            </h3>
            <div className="bg-white rounded-3xl p-1 shadow-sm border border-slate-100 flex flex-col gap-1">
              
              <div className="flex items-center justify-between p-3 rounded-2xl">
                <div>
                  <p className="text-[13px] font-extrabold text-slate-800">⏱ Thời gian mỗi ngày</p>
                  <p className="text-[11px] text-slate-400 font-medium">Tổng tối đa</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-2 py-1.5 shadow-inner">
                  <button onClick={() => setSessionMin(Math.max(15, sessionMin - 5))} className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-500 font-black hover:text-emerald-600 active:scale-95">−</button>
                  <span className="text-base font-black text-slate-800 w-8 text-center">{sessionMin}p</span>
                  <button onClick={() => setSessionMin(Math.min(90, sessionMin + 5))} className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-500 font-black hover:text-emerald-600 active:scale-95">+</button>
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              <div className="flex items-center justify-between p-3 rounded-2xl">
                <div>
                  <p className="text-[13px] font-extrabold text-slate-800">📆 Số ngày / tuần</p>
                  <p className="text-[11px] text-slate-400 font-medium">Mỗi tuần</p>
                </div>
                <div className="flex gap-1.5">
                  {[3, 4, 5, 6, 7].map(n => (
                    <button key={n} onClick={() => setDaysPerWeek(n)}
                      className={`w-8 h-8 rounded-full text-[12px] font-black transition-all ${
                        daysPerWeek === n ? "bg-[#2DB94D] text-white shadow-md shadow-emerald-200 scale-110" : "bg-white border border-slate-200 text-slate-500 hover:border-emerald-300"
                      }`}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              <div className="flex items-center justify-between p-4 rounded-2xl">
                <span className="text-[13px] font-extrabold text-slate-800">👋 Bắt đầu bằng Chào hỏi</span>
                {miniToggle(true, () => {})}
              </div>

              <div className="w-full h-px bg-slate-100" />

              <div className="flex items-center justify-between p-4 rounded-2xl">
                <span className="text-[13px] font-extrabold text-slate-800">🎮 Thêm Game vui</span>
                {miniToggle(includeGame, () => {
                  setIncludeGame(!includeGame);
                  if (!includeGame) {
                    const m = BLOCK_META["GAME"];
                    const b: ScheduleBlock = { id: newId(), type: "GAME", label: m.label, emoji: m.emoji, duration_min: 5, enabled: true };
                    const wrapIdx = blocks.findIndex(b => b.type === "WRAP_UP");
                    setBlocks(prev => { const next = [...prev]; next.splice(wrapIdx >= 0 ? wrapIdx : next.length, 0, b); return next; });
                  } else {
                    setBlocks(prev => prev.filter(b => b.type !== "GAME"));
                  }
                })}
              </div>

            </div>
          </div>

          {/* THỨ TỰ SESSIONS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-black text-slate-500 tracking-widest uppercase flex items-center gap-1.5">
                <span className="text-base">🗂</span> THỨ TỰ SESSIONS
              </h3>
              <span className="text-[10px] text-slate-400">⠿ Kéo để đổi vị trí</span>
            </div>

            <div className="flex flex-col gap-2">
              {blocks.map((block, idx) => {
                const s = BLOCK_STYLE[block.type];
                return (
                  <div
                    key={block.id}
                    draggable={!block.locked}
                    onDragStart={() => { dragIdx.current = idx; setDragging(idx); }}
                    onDragOver={e => { e.preventDefault(); dragOverIdx.current = idx; }}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    className={`bg-white rounded-2xl p-3 flex items-center gap-3 transition-all shadow-sm border border-slate-100
                      ${!block.locked ? "cursor-grab hover:border-emerald-300 active:cursor-grabbing" : ""}
                      ${dragging === idx ? "opacity-40 scale-[0.98]" : ""}
                      ${!block.enabled ? "opacity-50 grayscale" : ""}
                    `}
                  >
                    <div className="w-8 flex justify-center shrink-0">
                      <span className="text-[14px] text-slate-300">{block.locked ? "🔒" : "⠿"}</span>
                    </div>

                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0 text-xl`}>
                      {block.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold text-slate-800 truncate">{block.label}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{BLOCK_META[block.type].shortLabel}</p>
                    </div>

                    {!block.locked && (
                      <div className="flex flex-col items-end gap-1.5">
                        {miniToggle(block.enabled, () => toggleEnabled(block.id))}
                        <div className="flex items-center gap-2 mt-0.5">
                          {block.type !== "LEARN" && (
                            <button onClick={() => changeDuration(block.id, -1)} className="text-slate-300 hover:text-slate-600 font-bold text-sm leading-none">−</button>
                          )}
                          <span className={`text-[11px] font-extrabold ${s.accent} bg-white border border-slate-100 rounded px-1 min-w-[24px] text-center shadow-sm`}>{block.duration_min}p</span>
                          {block.type !== "LEARN" && (
                            <button onClick={() => changeDuration(block.id, 1)} className="text-slate-300 hover:text-slate-600 font-bold text-sm leading-none">+</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={() => addBlock("LEARN")} className="mt-2 w-full border-2 border-dashed border-slate-200 rounded-2xl py-3 text-[12px] font-extrabold text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all">
                + Thêm session
              </button>
            </div>
          </div>

          {/* ─── Góc nhắn của Mama ─── */}
          <div>
            <h3 className="text-[11px] font-black text-slate-500 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="text-base">💬</span> GÓC NHẮN CHO PIKA
            </h3>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium mb-2 leading-relaxed">
                Bạn muốn điều chỉnh gì trong cấu trúc học? Pika sẽ ghi nhận để cải thiện kế hoạch học tập.
              </p>
              <div className="relative">
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value.slice(0, 300))}
                  placeholder="VD: Con thích học nhiều hơn, bớt game đi / Muốn thêm thời gian Warm-up..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 focus:border-[#2DB94D] focus:bg-white focus:outline-none text-[12px] text-slate-700 placeholder:text-slate-400 p-3 leading-relaxed"
                  rows={3}
                />
                <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 font-bold">
                  {feedbackText.length}/300
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

function SchedulePageInner() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-sans flex flex-col items-center justify-center p-0 md:p-6">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/4 blur-[160px]" />
      </div>
      <div className="w-full max-w-[390px] h-[844px] bg-white rounded-none md:rounded-[48px] md:border-[10px] border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden relative z-10">
        <div className="h-9 bg-white shrink-0 flex items-center justify-between px-6 text-[11px] font-extrabold text-slate-600 font-mono pointer-events-none border-b border-slate-50 relative z-20">
          <span>9:41</span>
          <div className="w-20 h-3.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-2.5 border border-slate-800/50" />
          <div className="flex items-center gap-1">
            <span>5G</span>
            <div className="w-4 h-2.5 border border-slate-400 rounded-[3px] p-[1px]"><div className="w-full h-full bg-slate-600 rounded-[1px]" /></div>
          </div>
        </div>

        <ScheduleContent />
        <NavBar dataset={dataset} />

        <div className="h-4 bg-white shrink-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-28 h-1 bg-black/10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SchedulePageInner />
    </Suspense>
  );
}
