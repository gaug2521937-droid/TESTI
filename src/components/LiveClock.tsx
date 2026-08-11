"use client";

import { useEffect, useState } from "react";

// Живые часы: инициализируются серверным временем, затем тикают на клиенте
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    return (
      <div className="flex items-center justify-center gap-2.5 flex-wrap">
        <div className="skeleton h-8 w-52 !rounded-full" />
        <div className="skeleton h-8 w-32 !rounded-full" />
      </div>
    );
  }

  const dateStr = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center justify-center gap-2.5 flex-wrap animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
        <span className="text-sm">📅</span>
        <span className="text-[13px] font-semibold text-[#b8b8c8] capitalize">{dateStr}</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#6c5ce7]/20 to-[#6c5ce7]/8 border border-[#6c5ce7]/30 backdrop-blur-sm">
        <span className="text-sm">🕐</span>
        <span className="text-[13px] font-extrabold text-[#c5bcff] tabular-nums">{timeStr}</span>
      </div>
    </div>
  );
}
