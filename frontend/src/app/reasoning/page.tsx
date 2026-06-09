"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface Highlight {
  label: string;
  type: "metric" | "preference" | "info";
}

interface AgentMessage {
  agent_id: string;
  agent_name: string;
  avatar: string;
  role: string;
  message: string;
  highlights?: Highlight[];
  addressed_to: string;
}

interface SessionSummary {
  phase_label: string;
  ratio_mode: string;
  total_activities: number;
  key_insight: string;
}

interface PhaseInfo {
  number: number;
  label: string;
}

interface TokenUsage {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  total_tokens: number;
}

interface ReasoningResponse {
  provider: string;
  model: string;
  token_usage?: TokenUsage;
  phase: PhaseInfo;
  ratio_mode: string;
  agent_conversation: AgentMessage[];
  session_summary?: SessionSummary;
  cached?: boolean;
}

const AGENT_INFO: Record<string, { name: string; icon: string; role: string; grad: string; border: string; text: string; dot: string }> = {
  popi: { name: "POPI", icon: "🎓", role: "Trưởng ban điều phối", grad: "from-[#7C5CFC] to-[#5B3FD4]", border: "border-[#7C5CFC]/20", text: "text-[#7C5CFC]", dot: "bg-[#7C5CFC]" },
  lia:  { name: "LIA",  icon: "🗣️", role: "Chuyên gia giao tiếp", grad: "from-[#FF9500] to-[#D97706]", border: "border-[#FF9500]/20", text: "text-[#D97706]", dot: "bg-[#FF9500]" },
  tomo: { name: "TOMO", icon: "🗺️", role: "Chuyên gia học thuật", grad: "from-[#3B82F6] to-[#1D4ED8]", border: "border-[#3B82F6]/20", text: "text-[#1D4ED8]", dot: "bg-[#3B82F6]" },
  mun:  { name: "MUN",  icon: "🧸", role: "Chuyên gia tâm lý",   grad: "from-[#EC4899] to-[#BE185D]", border: "border-[#EC4899]/20", text: "text-[#BE185D]", dot: "bg-[#EC4899]" },
  bo:   { name: "BO",   icon: "🛡️", role: "Chuyên gia an toàn",   grad: "from-[#2DB94D] to-[#1A9E3A]", border: "border-[#2DB94D]/20", text: "text-[#1A9E3A]", dot: "bg-[#2DB94D]" },
};

function ReasoningContent() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(1);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null);

  const [allMessages, setAllMessages] = useState<AgentMessage[]>([]);
  const [sequentialIndex, setSequentialIndex] = useState(0);
  const [streamedTexts, setStreamedTexts] = useState<Record<number, string>>({});
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamingControlsRef = useRef<{ completeAll: () => void; completeCurrent: () => void } | null>(null);

  useEffect(() => {
    let active = true;
    
    const triggerLoading = async () => {
      // 1. Start loading intervals
      const progressSteps = [
        { progress: 35, step: 1, delay: 500 },
        { progress: 55, step: 2, delay: 500 },
        { progress: 75, step: 3, delay: 500 },
        { progress: 90, step: 4, delay: 400 },
      ];

      // Call API in parallel
      const fetchPromise = (async () => {
        const res = await fetch(`${API_BASE}/api/reasoning/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset_name: dataset, force_refresh: false }),
        });
        if (!res.ok) throw new Error("API compilation failed");
        return await res.json() as ReasoningResponse;
      })();

      try {
        for (const item of progressSteps) {
          if (!active) return;
          await new Promise(r => setTimeout(r, item.delay));
          setLoadingProgress(item.progress);
          setCurrentLoadingStep(item.step + 1);
        }

        const apiData = await fetchPromise;
        if (!active) return;
        
        setLoadingProgress(100);
        await new Promise(r => setTimeout(r, 350));
        
        if (apiData) {
          setPhaseInfo(apiData.phase);
          if (apiData.session_summary) setSessionSummary(apiData.session_summary);
          setAllMessages(apiData.agent_conversation || []);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        alert("Kết nối tới máy chủ AI thất bại! Vui lòng đảm bảo backend đang chạy ở cổng 8001.");
        window.location.href = `/memory?dataset=${dataset}`;
      }
    };

    triggerLoading();

    return () => {
      active = false;
    };
  }, [dataset, API_BASE]);

  // Chat message streaming typewriter logic
  useEffect(() => {
    if (loading || allMessages.length === 0) {
      setStreamedTexts({});
      setSequentialIndex(0);
      streamingControlsRef.current = null;
      return;
    }

    setStreamedTexts({});
    setSequentialIndex(0);
    
    let activeIndex = 0;
    let charIndex = 0;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const completeAll = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      const fullTexts: Record<number, string> = {};
      allMessages.forEach((m, i) => { fullTexts[i] = m.message; });
      setStreamedTexts(fullTexts);
      setSequentialIndex(allMessages.length);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };

    const completeCurrent = () => {
      if (activeIndex >= allMessages.length) return;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        charIndex = allMessages[activeIndex].message.length;
        setStreamedTexts(prev => ({ ...prev, [activeIndex]: allMessages[activeIndex].message }));
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        timeoutId = setTimeout(() => { activeIndex++; startStreamingMessage(activeIndex); }, 800);
      } else if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        activeIndex++;
        startStreamingMessage(activeIndex);
      }
    };

    streamingControlsRef.current = { completeAll, completeCurrent };

    const startStreamingMessage = (index: number) => {
      if (index >= allMessages.length) return;
      setSequentialIndex(index + 1);
      setTimeout(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
      const msg = allMessages[index];
      const text = msg.message;
      charIndex = 0;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        charIndex++;
        setStreamedTexts(prev => ({ ...prev, [index]: text.substring(0, charIndex) }));
        if (charIndex % 5 === 0) chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        if (charIndex >= text.length) {
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
          timeoutId = setTimeout(() => { activeIndex++; startStreamingMessage(activeIndex); }, 800);
        }
      }, 25);
    };
    
    timeoutId = setTimeout(() => { startStreamingMessage(0); }, 300);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      streamingControlsRef.current = null;
    };
  }, [loading, allMessages]);

  const handleChatContainerClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      if (streamingControlsRef.current) streamingControlsRef.current.completeAll();
    } else {
      if (streamingControlsRef.current) streamingControlsRef.current.completeCurrent();
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
      }, 300);
    }
  };

  const getAgentColor = (id: string) => {
    return AGENT_INFO[id.toLowerCase()] || AGENT_INFO.popi;
  };

  const renderRichText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-extrabold text-[#2DB94D] not-italic">{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  const handleNext = () => {
    window.location.href = `/planner-memory?dataset=${dataset}`;
  };

  // SCREEN 2: LOADING SCREEN
  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-6 items-center justify-between h-full animate-fade-in bg-white">
        <div className="w-full text-center">
          <span className="text-[11px] font-extrabold text-[#2DB94D] uppercase tracking-widest">Pika Brain System</span>
          <h2 className="text-[20px] font-black text-slate-800 mt-1 flex items-center justify-center gap-1.5">
            Ban chuyên gia đang họp
            <span className="w-2.5 h-2.5 rounded-full bg-[#2DB94D] animate-pulse shrink-0" />
          </h2>
          {phaseInfo && <p className="text-[11px] text-slate-500 mt-1 font-medium">Lập trình kịch bản cho: {phaseInfo.label}</p>}
        </div>

        <div className="w-full aspect-square max-w-[240px] flex items-center justify-center relative my-4">
          <div className="absolute w-[80px] h-[80px] rounded-full bg-white border-2 border-[#7C5CFC] shadow-[0_0_25px_rgba(124,92,252,0.15)] flex flex-col items-center justify-center z-10 animate-pulse">
            <span className="text-2xl">🎓</span>
            <span className="text-[9px] font-black tracking-wider text-[#7C5CFC] mt-0.5">POPI</span>
          </div>
          <div className={`absolute right-4 top-4 w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center text-lg z-10 shadow-sm transition-all duration-300 ${currentLoadingStep >= 2 ? "border-[#FF9500] shadow-[0_0_12px_rgba(255,149,0,0.2)]" : "border-slate-200"}`}>🗣️</div>
          <div className={`absolute right-4 bottom-4 w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center text-lg z-10 shadow-sm transition-all duration-300 ${currentLoadingStep >= 3 ? "border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.2)]" : "border-slate-200"}`}>🗺️</div>
          <div className={`absolute left-4 bottom-4 w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center text-lg z-10 shadow-sm transition-all duration-300 ${currentLoadingStep >= 4 ? "border-[#EC4899] shadow-[0_0_12px_rgba(236,72,153,0.2)]" : "border-slate-200"}`}>🧸</div>
          <div className={`absolute left-4 top-4 w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center text-lg z-10 shadow-sm transition-all duration-300 ${loadingProgress === 100 ? "border-[#2DB94D] shadow-[0_0_12px_rgba(45,185,77,0.2)]" : "border-slate-200"}`}>🛡️</div>
          <div className="absolute inset-0 border border-slate-200 rounded-full scale-[0.82] animate-spin border-dashed" style={{ animationDuration: "14s" }} />
          <div className="absolute inset-0 border border-slate-100 rounded-full scale-[0.64] animate-spin border-dotted" style={{ animationDuration: "9s" }} />
        </div>

        <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-center justify-between text-[11px] border-b border-slate-200 pb-2">
            <span className="font-extrabold text-slate-700">{currentLoadingStep}/5 Chuyên gia kích hoạt</span>
            <span className="font-mono font-bold text-slate-800">{loadingProgress}%</span>
          </div>
          <div className="flex flex-col gap-2 text-[10.5px] font-semibold">
            {[
              { icon: "🎓", name: "POPI · Trưởng ban điều phối", step: 1, doneText: "✓ Đã sẵn sàng" },
              { icon: "🗣️", name: "LIA · Chuyên gia giao tiếp", step: 2, doneText: "✓ Đã phân tích" },
              { icon: "🗺️", name: "TOMO · Chuyên gia học thuật", step: 3, doneText: "✓ Đã lập trình" },
              { icon: "🧸", name: "MUN · Chuyên gia tâm lý", step: 4, doneText: "✓ Đã tối ưu" },
              { icon: "🛡️", name: "BO · Chuyên gia an toàn", step: 5, doneText: "✓ Đã kiểm duyệt" },
            ].map(({ icon, name, step, doneText }) => (
              <div key={step} className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5"><span className="text-xs">{icon}</span> {name}</span>
                {(step === 5 ? loadingProgress === 100 : currentLoadingStep >= step)
                  ? <span className="text-[#2DB94D] font-bold">{doneText}</span>
                  : currentLoadingStep === step - 1
                  ? <span className="text-[#FF9500] animate-pulse">⏳ Đang xử lý...</span>
                  : <span className="text-slate-400/80">• Đang đợi</span>
                }
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1">
            <div className="bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] h-full rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>

        {sessionSummary && (
          <div className="w-full bg-[#2DB94D]/5 border border-[#2DB94D]/15 rounded-2xl p-3.5 text-center">
            <p className="text-[10px] leading-relaxed text-[#1A9E3A] font-bold">
              💡 POPI tiết lộ: <span className="text-slate-600 font-medium">{sessionSummary.key_insight}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // SCREEN 3: STREAMING DISCUSSIONS
  return (
    <div className="flex flex-col h-full animate-fade-in relative bg-[#F5F6F8]">
      {/* Stick Header */}
      <div className="sticky top-0 bg-white/95 border-b border-slate-200 p-4 flex flex-col gap-2.5 z-20 backdrop-blur-md shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => window.location.href = `/memory?dataset=${dataset}`} className="text-slate-500 hover:text-slate-800 text-xs font-black flex items-center gap-1 transition-colors shrink-0">❮ Trở lại</button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
            <h3 className="text-[11px] font-black tracking-wide text-slate-800 uppercase truncate">Chuyên gia tranh biến</h3>
            <span className="w-2 h-2 rounded-full bg-[#2DB94D] animate-pulse shrink-0" />
          </div>
          {phaseInfo && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[#2DB94D]/10 border border-[#2DB94D]/25 text-[#1A9E3A] shrink-0 whitespace-nowrap">{phaseInfo.label}</span>}
        </div>
        <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-4.5">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Đang thảo luận:</span>
          <div className="flex gap-2">
            {["popi", "lia", "tomo", "mun", "bo"].map((ag, i) => (
              <div key={i} className="relative">
                <div className={`w-7 h-7 rounded-full border border-white flex items-center justify-center text-xs bg-gradient-to-tr ${getAgentColor(ag).grad} text-white shadow-xs`}>{getAgentColor(ag).icon}</div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#2DB94D] border-2 border-white" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages Stream Container */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar" onClick={handleChatContainerClick}>
        {allMessages.slice(0, sequentialIndex).map((msg, idx) => {
          const agentId = msg.agent_id.toLowerCase();
          const spec = getAgentColor(agentId);
          const isRight = ["lia", "bo"].includes(agentId);
          const borderColor = agentId === "popi" ? "#7C5CFC" : agentId === "lia" ? "#FF9500" : agentId === "tomo" ? "#3B82F6" : agentId === "mun" ? "#EC4899" : "#2DB94D";
          return (
            <div key={idx} className={`flex gap-3 animate-slide-in ${isRight ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm border bg-gradient-to-tr ${spec.grad} ${spec.border} text-white`}>{msg.avatar || spec.icon}</div>
              <div className={`flex flex-col gap-1 max-w-[80%] ${isRight ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-slate-500">
                  <span className={`font-black uppercase ${spec.text}`}>{spec.name}</span>
                  <span>·</span>
                  <span>{spec.role}</span>
                </div>
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-tl-none p-3.5 shadow-xs border-l-4" style={{ borderLeftColor: borderColor }}>
                  <div className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                    {renderRichText(streamedTexts[idx] || "")}
                  </div>
                </div>
                {msg.highlights && msg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.highlights.map((hl, hIdx) => (
                      <span key={hIdx} className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border border-[#2DB94D]/15 bg-[#2DB94D]/5 text-[#1A9E3A]">{hl.label}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {(() => {
          const isCurrentStreaming = sequentialIndex > 0 && allMessages[sequentialIndex - 1] && (streamedTexts[sequentialIndex - 1]?.length || 0) < allMessages[sequentialIndex - 1].message.length;
          if (isCurrentStreaming || sequentialIndex >= allMessages.length || !allMessages[sequentialIndex]) return null;
          const nextMsg = allMessages[sequentialIndex];
          const agentId = nextMsg.agent_id.toLowerCase();
          const spec = getAgentColor(agentId);
          const isRight = ["lia", "bo"].includes(agentId);
          return (
            <div className={`flex gap-3 animate-pulse ${isRight ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border bg-gradient-to-tr ${spec.grad} ${spec.border} text-white shadow-xs`}>{nextMsg.avatar || spec.icon}</div>
              <div className={`flex flex-col gap-1 max-w-[80%] ${isRight ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-slate-500">
                  <span className={`font-black uppercase ${spec.text}`}>{spec.name}</span>
                  <span>·</span>
                  <span className="italic">đang phát biểu...</span>
                </div>
                <div className="bg-white border border-[#E8E8E8] rounded-2xl rounded-tl-none p-3.5 shadow-xs">
                  <div className="flex gap-1.5 items-center px-2 py-0.5">
                    <span className="w-1.5 h-1.5 bg-[#2DB94D] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#2DB94D] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#2DB94D] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        <div ref={chatBottomRef} />
      </div>

      {/* Sticky Bottom Actions */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3 shrink-0 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-extrabold font-mono tracking-wider">{sequentialIndex} / {allMessages.length} TIN NHẮN THẢO LUẬN</span>
          <div className="flex gap-1.5">
            {allMessages.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i < sequentialIndex ? "bg-[#2DB94D] w-3" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          {(() => {
            const isLastStreaming = allMessages.length > 0 && (streamedTexts[allMessages.length - 1]?.length || 0) < allMessages[allMessages.length - 1].message.length;
            const isDone = sequentialIndex === allMessages.length && !isLastStreaming;
            if (!isDone) {
              return (
                <button
                  onClick={() => streamingControlsRef.current?.completeAll()}
                  className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] font-bold text-slate-500 text-center flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-[#FF9500] animate-ping shrink-0" />
                  Chạm đúp màn hình để bỏ qua streaming
                </button>
              );
            }
            return (
              <button onClick={handleNext} className="flex-1 py-3.5 bg-gradient-to-r from-[#2DB94D] to-[#1A9E3A] hover:opacity-95 rounded-xl text-[11px] font-black text-white shadow-md shadow-[#2DB94D]/15 transition-all active:scale-[0.96] text-center uppercase tracking-wider animate-scale-up">
                Xem kế hoạch tuần 🎉 ❯
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default function ReasoningPage() {
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
          <ReasoningContent />
        </Suspense>

        {/* Home indicator */}
        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}
