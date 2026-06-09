"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Báo cáo"   },
  { href: "/memory",   icon: "🧠", label: "Hồ sơ"     },
  { href: "/planner/golden-plan",  icon: "📅", label: "Kế hoạch"  },
  { href: "/schedule", icon: "🗓️", label: "Cấu trúc"  },
];

export default function NavBar({ dataset }: { dataset?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const q = dataset ? `?dataset=${dataset}` : "";

  return (
    <div className="h-14 bg-white border-t border-slate-100 shrink-0 flex items-center z-20">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <button
            key={item.href}
            onClick={() => router.push(`${item.href}${q}`)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all ${
              active ? "text-[#2DB94D]" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
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
