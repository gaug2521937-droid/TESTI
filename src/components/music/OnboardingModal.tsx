"use client";

import { useState, useEffect } from "react";

/**
 * При первом входе в раздел музыки просим отметить любимых артистов.
 * Дальше микс будет собираться из их треков и похожих исполнителей.
 */

const SUGGESTIONS = [
  { name: "Miyagi", color: "#7c5cff" },
  { name: "Баста", color: "#ff4d6d" },
  { name: "УННВ", color: "#22d3ee" },
  { name: "1kla$", color: "#ffb340" },
  { name: "CZAR", color: "#f043a0" },
  { name: "Скриптонит", color: "#34e5a0" },
  { name: "Оксимирон", color: "#a68fff" },
  { name: "Гуф", color: "#ff7043" },
  { name: "Каспийский Груз", color: "#22d3ee" },
  { name: "Macan", color: "#f043a0" },
  { name: "ЛСП", color: "#7c5cff" },
  { name: "Big Baby Tape", color: "#ffb340" },
  { name: "Kizaru", color: "#ff4d6d" },
  { name: "Eminem", color: "#a68fff" },
  { name: "Travis Scott", color: "#34e5a0" },
  { name: "Drake", color: "#22d3ee" },
  { name: "The Weeknd", color: "#f043a0" },
  { name: "Post Malone", color: "#ffb340" },
  { name: "Kendrick Lamar", color: "#7c5cff" },
  { name: "Playboi Carti", color: "#ff7043" },
];

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addCustom = () => {
    const name = custom.trim();
    if (name.length < 2) return;
    setChosen((prev) => new Set(prev).add(name));
    setCustom("");
  };

  const save = async () => {
    if (chosen.size < 3) return;
    setBusy(true);
    try {
      await fetch("/api/music/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists: Array.from(chosen) }),
      });
      onDone();
    } catch {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    await fetch("/api/music/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artists: [] }),
    });
    onDone();
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-[24px] animate-rise"
        style={{
          background: "linear-gradient(180deg, #16161f, #0e0e15)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 30px 70px -20px rgba(0,0,0,1)",
        }}
      >
        {/* Шапка */}
        <div className="p-6 pb-4 flex-shrink-0">
          <div className="text-4xl mb-3">🎧</div>
          <h2 className="text-[24px] font-black text-white leading-tight mb-2">
            Кого <span className="gradient-text">любите слушать?</span>
          </h2>
          <p className="text-[13.5px] text-[#8a8a9e] leading-relaxed">
            Отметьте <b className="text-[#a68fff]">от 3 артистов</b> — микс будет собираться из их
            треков и похожих исполнителей.
          </p>
        </div>

        {/* Плитки артистов */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {SUGGESTIONS.map((a) => {
              const on = chosen.has(a.name);
              return (
                <button
                  key={a.name}
                  onClick={() => toggle(a.name)}
                  className="relative p-3.5 rounded-2xl border text-left transition-all active:scale-95"
                  style={{
                    background: on ? `${a.color}22` : "rgba(255,255,255,0.03)",
                    borderColor: on ? `${a.color}70` : "rgba(255,255,255,0.07)",
                    boxShadow: on ? `0 10px 24px -12px ${a.color}` : "none",
                  }}
                >
                  <p className="text-[13.5px] font-extrabold" style={{ color: on ? a.color : "#e4e4ee" }}>
                    {a.name}
                  </p>
                  {on && (
                    <span
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-black"
                      style={{ background: a.color }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Свой артист */}
          <div className="flex gap-2 mb-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Свой артист…"
              className="gash-input !py-2.5 !text-[13px]"
            />
            <button onClick={addCustom} disabled={custom.trim().length < 2} className="gash-btn-outline !py-2.5 !px-4 !text-[13px]">
              Добавить
            </button>
          </div>

          {/* Выбранные, но не из списка */}
          {[...chosen].filter((c) => !SUGGESTIONS.some((s) => s.name === c)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {[...chosen]
                .filter((c) => !SUGGESTIONS.some((s) => s.name === c))
                .map((name) => (
                  <button
                    key={name}
                    onClick={() => toggle(name)}
                    className="px-2.5 py-1 rounded-lg text-[11.5px] font-bold bg-[#7c5cff]/22 text-[#a68fff] border border-[#7c5cff]/40 flex items-center gap-1.5"
                  >
                    {name} <span className="text-[10px]">✕</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Низ */}
        <div className="p-6 pt-4 flex-shrink-0 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-black/20">
          <button onClick={() => void skip()} disabled={busy} className="gash-btn-ghost">
            Пропустить
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#8a8a9e]">
              выбрано{" "}
              <b className="text-white tabular-nums">{chosen.size}</b>
              {chosen.size < 3 && <span className="text-[#ff849c]"> (нужно 3)</span>}
            </span>
            <button onClick={() => void save()} disabled={busy || chosen.size < 3} className="gash-btn !py-2.5 !px-5">
              {busy ? "…" : "🎵 Начать слушать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
