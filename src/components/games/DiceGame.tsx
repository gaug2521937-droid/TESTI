"use client";

import { useState, useRef } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

/**
 * Dice — классическая игра на порог.
 * Игрок сам задаёт целевое число и направление ставки,
 * от этого зависят шанс и множитель.
 */
export function DiceGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<"over" | "under">("over");
  const [rolling, setRolling] = useState(false);
  const [roll, setRoll] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ v: number; w: boolean }[]>([]);
  const rafRef = useRef(0);

  const chance = mode === "over" ? 100 - target : target;
  const mult = (100 / chance) * 0.97;
  const potential = Math.round(Number(bet) * mult);

  const play = async () => {
    const amount = Number(bet);
    if (!amount || amount <= 0) return;
    if (amount > coins) {
      setError("Недостаточно монет");
      return;
    }

    setError("");
    setRolling(true);
    setWin(null);

    // Прокрутка числа
    const start = performance.now();
    const spin = (now: number) => {
      if (now - start < 900) {
        setRoll(Number((Math.random() * 100).toFixed(2)));
        rafRef.current = requestAnimationFrame(spin);
      }
    };
    rafRef.current = requestAnimationFrame(spin);

    try {
      const [r] = await Promise.all([
        fetch("/api/casino/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: "dice",
            bet: amount,
            target,
            mode,
            clientSeed: String(Date.now()),
          }),
        }),
        new Promise((res) => setTimeout(res, 950)),
      ]);
      cancelAnimationFrame(rafRef.current);

      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка");
        setRolling(false);
        return;
      }

      setRoll(d.roll);
      setWin(d.win);
      setPayout(d.payout);
      setRolling(false);
      setHistory((h) => [{ v: d.roll, w: d.win }, ...h].slice(0, 16));
      if (typeof d.coins === "number") onResult(d.coins, d.xp);
    } catch {
      cancelAnimationFrame(rafRef.current);
      setError("Нет связи");
      setRolling(false);
    }
  };

  const col = rolling ? "#a68fff" : win === true ? "#34e5a0" : win === false ? "#ff4d6d" : "#f2f2f7";

  return (
    <div>
      {/* Лента бросков */}
      {history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 pb-1">
          {history.map((h, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold tabular-nums flex-shrink-0 animate-pop"
              style={{
                background: h.w ? "rgba(52,229,160,0.14)" : "rgba(255,77,109,0.12)",
                color: h.w ? "#34e5a0" : "#ff4d6d",
                border: `1px solid ${h.w ? "rgba(52,229,160,0.3)" : "rgba(255,77,109,0.28)"}`,
              }}
            >
              {h.v.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {/* Результат */}
      <div
        className="rounded-2xl border p-7 mb-5 text-center transition-all duration-300"
        style={{
          background:
            win === true
              ? "linear-gradient(180deg, rgba(52,229,160,0.1), transparent)"
              : win === false
              ? "linear-gradient(180deg, rgba(255,77,109,0.09), transparent)"
              : "rgba(255,255,255,0.02)",
          borderColor:
            win === true ? "rgba(52,229,160,0.4)" : win === false ? "rgba(255,77,109,0.4)" : "rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="font-extrabold tabular-nums leading-none transition-colors duration-200"
          style={{ fontSize: "clamp(46px, 12vw, 74px)", color: col, textShadow: `0 0 44px ${col}55` }}
        >
          {roll !== null ? roll.toFixed(2) : "0.00"}
        </div>
        {win !== null && !rolling && (
          <p className="mt-2.5 text-[15px] font-extrabold animate-pop" style={{ color: col }}>
            {win ? `🎉 +${payout.toLocaleString("ru-RU")}` : `😔 −${Number(bet).toLocaleString("ru-RU")}`}
          </p>
        )}
        {win === null && !rolling && (
          <p className="mt-2.5 text-[13px] text-[#6a6a80]">Настройте порог и бросайте</p>
        )}
      </div>

      {/* Шкала */}
      <div className="mb-5">
        <div className="relative h-4 rounded-full overflow-hidden bg-white/[0.06] mb-3">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-300"
            style={{
              width: `${target}%`,
              background:
                mode === "under"
                  ? "linear-gradient(90deg, rgba(52,229,160,0.5), rgba(52,229,160,0.8))"
                  : "linear-gradient(90deg, rgba(255,77,109,0.4), rgba(255,77,109,0.65))",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 transition-all duration-300"
            style={{
              width: `${100 - target}%`,
              background:
                mode === "over"
                  ? "linear-gradient(90deg, rgba(52,229,160,0.8), rgba(52,229,160,0.5))"
                  : "linear-gradient(90deg, rgba(255,77,109,0.65), rgba(255,77,109,0.4))",
            }}
          />
          {roll !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-full shadow-[0_0_14px_rgba(255,255,255,0.95)]"
              style={{ left: `calc(${roll}% - 2px)`, transition: rolling ? "none" : "left 0.4s ease" }}
            />
          )}
        </div>

        <input
          type="range"
          min={2}
          max={98}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          disabled={rolling}
          className="range-slider"
          style={{ background: `linear-gradient(90deg,#7c5cff ${target}%, rgba(255,255,255,0.12) ${target}%)` }}
        />
        <div className="flex justify-between mt-2 text-[11.5px] font-bold">
          <span className="text-[#6a6a80]">0</span>
          <span className="text-[#a68fff]">
            выигрыш если {mode === "over" ? "больше" : "меньше"} {target}
          </span>
          <span className="text-[#6a6a80]">100</span>
        </div>
      </div>

      {/* Направление */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([
          { k: "under", l: "▼ Меньше", d: `< ${target}` },
          { k: "over", l: "▲ Больше", d: `> ${target}` },
        ] as const).map((m) => (
          <button
            key={m.k}
            onClick={() => setMode(m.k)}
            disabled={rolling}
            className={`py-3 rounded-xl font-bold text-[13.5px] border transition-all ${
              mode === m.k
                ? "bg-gradient-to-br from-[#7c5cff] to-[#5c3ce0] text-white border-transparent tab-active-glow"
                : "bg-white/[0.04] text-[#8a8a9e] border-white/[0.08] hover:bg-white/[0.08]"
            }`}
          >
            {m.l}
            <span className="block text-[11px] opacity-70 font-semibold mt-0.5">{m.d}</span>
          </button>
        ))}
      </div>

      {/* Показатели */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { l: "Шанс", v: `${chance.toFixed(1)}%`, c: "#22d3ee" },
          { l: "Множитель", v: `×${mult.toFixed(2)}`, c: "#a68fff" },
          { l: "Выплата", v: potential.toLocaleString("ru-RU"), c: "#34e5a0" },
        ].map((s) => (
          <div key={s.l} className="stat-tile">
            <div className="v" style={{ color: s.c }}>{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Ставка */}
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          disabled={rolling}
          className="gash-input !text-[16px] !font-bold flex-1"
        />
        <button onClick={() => setBet(String(Math.max(1, Math.floor(Number(bet) / 2))))} disabled={rolling} className="gash-btn-ghost !px-3">½</button>
        <button onClick={() => setBet(String(Math.floor(Number(bet) * 2)))} disabled={rolling} className="gash-btn-ghost !px-3">2×</button>
        <button onClick={() => setBet(String(coins))} disabled={rolling} className="gash-btn-ghost !px-3">Max</button>
      </div>

      {/* Быстрые пороги */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[10, 25, 50, 75, 90].map((t) => (
          <button
            key={t}
            onClick={() => setTarget(t)}
            disabled={rolling}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all ${
              target === t
                ? "bg-[#7c5cff] text-white border-transparent"
                : "bg-white/[0.04] text-[#8a8a9e] border-white/[0.08] hover:bg-white/[0.08]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <button onClick={() => void play()} disabled={rolling || Number(bet) <= 0} className="gash-btn w-full !py-4 !text-base">
        {rolling ? (<><span className="animate-spin-slow inline-block">🎲</span> Бросаем…</>) : "🎲 Бросить кубик"}
      </button>
    </div>
  );
}
