"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard",          key: "dashboard", icon: "📊", label: "Báo cáo"   },
  { href: "/memory",             key: "memory",    icon: "🧠", label: "Hồ sơ"     },
  { href: "/planner/golden-plan",key: "planner",   icon: "📅", label: "Kế hoạch"  },
  { href: "/schedule",           key: "schedule",  icon: "🗓️", label: "Cấu trúc"  },
];

export default function NavBar({ dataset }: { dataset?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const q = dataset ? `?dataset=${dataset}` : "";
  const [visited, setVisited] = useState<string[]>([]);

  // Load visited tabs from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("visited_tabs") || "[]") as string[];
    setVisited(stored);

    // Mark current page as visited
    const currentKey = NAV_ITEMS.find(
      item => pathname === item.href || pathname.startsWith(item.href + "/")
    )?.key;
    if (currentKey && !stored.includes(currentKey)) {
      const updated = [...stored, currentKey];
      localStorage.setItem("visited_tabs", JSON.stringify(updated));
      setVisited(updated);
    }
  }, [pathname]);

  return (
    <div className="h-14 bg-white border-t border-slate-100 shrink-0 flex items-center z-20">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const isVisited = visited.includes(item.key);
        const showDot = !isVisited && !active;

        return (
          <button
            key={item.href}
            onClick={() => router.push(`${item.href}${q}`)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all relative ${
              active ? "text-[#2DB94D]" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className="relative">
              <span className="text-base leading-none">{item.icon}</span>
              {/* Notification dot for unvisited tabs */}
              {showDot && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-[#F59E0B] rounded-full animate-pulse" />
              )}
            </div>
            <span className={`text-[9px] font-extrabold uppercase tracking-wide leading-none ${active ? "text-[#2DB94D]" : ""}`}>
              {item.label}
            </span>
            {active && <div className="w-4 h-0.5 bg-[#2DB94D] rounded-full absolute bottom-0" />}
          </button>
        );
      })}
    </div>
  );
}
