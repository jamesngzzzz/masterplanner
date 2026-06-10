"use client";

/**
 * JourneyGuide — Guided onboarding pill that walks parents through 5 steps.
 *
 * Steps:
 *   1. dashboard         → Báo cáo hôm nay
 *   2. memory_clusters   → Cụm ký ức bé  (/memory, tab: memory)
 *   3. memory_dev        → Sự phát triển  (/memory, tab: development)
 *   4. planner           → Kế hoạch tuần  (/planner/golden-plan)
 *   5. schedule          → Cấu trúc lịch học (/schedule)
 *
 * Persistence:
 *   - Visited steps → localStorage "journey_visited" (permanent)
 *   - Pill dismissed → sessionStorage "journey_dismissed" (resets each session)
 *
 * Usage:
 *   <JourneyPill dataset={dataset} currentStep="dashboard" />
 *   <JourneyPill dataset={dataset} currentStep="memory_clusters" />
 *   etc.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Steps config ─────────────────────────────────────────────────────────────

export type JourneyStepKey =
  | "dashboard"
  | "memory_clusters"
  | "memory_dev"
  | "planner"
  | "schedule";

export interface JourneyStep {
  key: JourneyStepKey;
  icon: string;
  label: string;
  desc: string;
  href: string;         // full path (without dataset)
  tabParam?: string;    // optional ?tab= param for memory page
}

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    key: "dashboard",
    icon: "📊",
    label: "Báo cáo hôm nay",
    desc: "Xem bé học gì trong ngày",
    href: "/dashboard",
  },
  {
    key: "memory_clusters",
    icon: "🧠",
    label: "Cụm ký ức bé",
    desc: "Sở thích & ký ức AI ghi nhận",
    href: "/memory",
    tabParam: "memory",
  },
  {
    key: "memory_dev",
    icon: "📈",
    label: "Sự phát triển",
    desc: "Xu hướng nổi bật trong tuần",
    href: "/memory",
    tabParam: "development",
  },
  {
    key: "planner",
    icon: "📅",
    label: "Kế hoạch tuần",
    desc: "5 buổi học được lên kế hoạch",
    href: "/planner/golden-plan",
  },
  {
    key: "schedule",
    icon: "🗓️",
    label: "Cấu trúc lịch học",
    desc: "Lịch buổi học cụ thể theo ngày",
    href: "/schedule",
  },
];

// ─── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = "journey_visited";
const SS_KEY = "journey_dismissed";

export function getVisited(): JourneyStepKey[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}

export function markVisited(key: JourneyStepKey) {
  if (typeof window === "undefined") return;
  const visited = getVisited();
  if (!visited.includes(key)) {
    localStorage.setItem(LS_KEY, JSON.stringify([...visited, key]));
  }
}

export function getNextStep(): JourneyStep | null {
  const visited = getVisited();
  return JOURNEY_STEPS.find(s => !visited.includes(s.key)) || null;
}

// ─── JourneyPill component ────────────────────────────────────────────────────

interface JourneyPillProps {
  dataset: string;
  /** The step key that the current page represents. Marks it as visited on mount. */
  currentStep: JourneyStepKey;
}

export function JourneyPill({ dataset, currentStep }: JourneyPillProps) {
  const router = useRouter();
  const [nextStep, setNextStep] = useState<JourneyStep | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // "attention" = user came back to an already-visited page while journey incomplete
  const [attention, setAttention] = useState(false);
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(() => {
    // Mark current step visited
    markVisited(currentStep);
    // Find next
    const next = getNextStep();
    setNextStep(next);
    if (!next) { setDismissed(true); return; }

    // Check if dismissed this session
    const dis = sessionStorage.getItem(SS_KEY);
    if (dis) { setDismissed(true); return; }
    setDismissed(false);

    // "attention" mode: current page step is already visited (user came back)
    // and there's still a next step ahead
    const visited = getVisited();
    const isComingBack = visited.includes(currentStep);
    setAttention(isComingBack);

    // Small delay for slide-in animation
    setTimeout(() => setVisible(true), 300);
  }, [currentStep]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setDismissed(true);
      sessionStorage.setItem(SS_KEY, "true");
    }, 200);
  };

  const handleNavigate = () => {
    if (!nextStep) return;
    const tab = nextStep.tabParam ? `&tab=${nextStep.tabParam}` : "";
    router.push(`${nextStep.href}?dataset=${dataset}${tab}`);
  };

  if (dismissed || !nextStep) return null;

  // Step progress
  const totalSteps = JOURNEY_STEPS.length;
  const visitedCount = getVisited().length;
  const progressPct = Math.round((visitedCount / totalSteps) * 100);
  const stepNumber = visitedCount + 1;

  return (
    <div
      className={`absolute bottom-14 left-3 right-3 z-50 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`rounded-2xl overflow-hidden transition-all duration-500 ${
          attention
            ? "ring-2 ring-[#F59E0B] ring-offset-1 ring-offset-transparent shadow-[0_0_24px_rgba(245,158,11,0.4)]"
            : "shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
        }`}
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          boxShadow: attention
            ? "0 8px 32px rgba(0,0,0,0.25), 0 0 0 2px rgba(245,158,11,0.6), 0 0 24px rgba(245,158,11,0.3)"
            : "0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Progress bar */}
        <div className="h-[3px] bg-white/10 w-full">
          <div
            className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          {/* Step icon with pulse */}
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                attention ? "animate-bounce" : ""
              }`}
              style={{ background: "rgba(245,158,11,0.15)" }}
            >
              {nextStep.icon}
            </div>
            {/* Pulse ring */}
            <span
              className={`absolute inset-0 rounded-full border-2 border-[#F59E0B] ${
                attention ? "animate-ping" : "animate-pulse opacity-60"
              }`}
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#F59E0B]">
                Bước {stepNumber}/{totalSteps}
              </span>
              {attention && (
                <span className="text-[8px] font-black text-white/40 uppercase tracking-wide">
                  · Tiếp tục khám phá
                </span>
              )}
            </div>
            <div className="text-[11px] font-black text-white leading-tight truncate">
              {nextStep.label}
            </div>
            <div className="text-[9px] text-white/50 font-medium mt-0.5 truncate">
              {nextStep.desc}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleNavigate}
            className={`shrink-0 text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
              attention
                ? "bg-[#F59E0B] hover:bg-[#D97706] shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                : "bg-[#F59E0B] hover:bg-[#D97706]"
            }`}
          >
            {attention ? "Tiếp →" : "Xem →"}
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="shrink-0 text-white/20 hover:text-white/50 transition-colors text-[10px] w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {JOURNEY_STEPS.map((step, i) => {
            const isVisited = getVisited().includes(step.key);
            const isCurrent = step.key === nextStep.key;
            return (
              <div
                key={step.key}
                className={`rounded-full transition-all duration-300 ${
                  isVisited
                    ? "w-4 h-1.5 bg-[#2DB94D]"
                    : isCurrent
                    ? "w-4 h-1.5 bg-[#F59E0B] animate-pulse"
                    : "w-1.5 h-1.5 bg-white/20"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
