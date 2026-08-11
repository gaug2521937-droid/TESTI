"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

/** Стандартный европейский порядок ячеек на колесе рулетки */
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type BetType = "red" | "black" | "green" | "even" | "odd" | "low" | "high" | "number";

interface Bet {
  type: BetType;
  number?: number;
  amount: number;
}

const BET_LABELS: Record<BetType, { label: string; mult: number; color: string }> = {
  red: { label: "Красное", mult: 2, color: "#d32f4f" },
  black: { label: "Чёрное", mult: 2, color: "#1a1a1a" },
  even: { label: "Чёт", mult: 2, color: "#7c5cff" },
  odd: { label: "Нечет", mult: 2, color: "#7c5cff" },
  low: { label: "1–18", mult: 2, color: "#7c5cff" },
  high: { label: "19–36", mult: 2, color: "#7c5cff" },
  green: { label: "Зеро", mult: 35, color: "#00a870" },
  number: { label: "Число", mult: 35, color: "#a68fff" },
};

/**
 * Реалистичная рулетка: настоящее колесо со всеми 37 ячейками,
 * шарик крутится в обратную сторону, поле для ставок с фишками.
 */
export function RouletteWheel({ coins, onResult }: Props) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [chip, setChip] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [wonAmount, setWonAmount] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<number[]>([]);

  const wheelRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ wheel: 0, ball: 0 });

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);

  const addBet = (type: BetType, number?: number) => {
    if (spinning) return;
    if (totalBet + chip > coins) {
      setError("Недостаточно монет");
      return;
    }
    setError("");
    setBets((prev) => {
      const key = type === "number" ? `${type}-${number}` : type;
      const existing = prev.findIndex((b) => (b.type === "number" ? `${b.type}-${b.number}` : b.type) === key);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { ...copy[existing], amount: copy[existing].amount + chip };
        return copy;
      }
      return [...prev, { type, number, amount: chip }];
    });
  };

  const clear = () => { if (!spinning) setBets([]); };
  const undo = () => { if (!spinning) setBets((p) => p.slice(0, -1)); };

  const spin = async () => {
    if (spinning || bets.length === 0) return;
    setSpinning(true);
    setResult(null);
    setError("");

    try {
      // Сервер возвращает число — используем цвет первой ставки как «затравку»
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "roulette", bet: totalBet, betType: "red", clientSeed: String(Date.now()) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      const winning: number = d.pocket ?? 0;

      // Крутим колесо и шарик в разные стороны
      const idx = WHEEL_ORDER.indexOf(winning);
      const anglePerCell = 360 / 37;
      const wheelFinal = 360 * 6 + idx * anglePerCell;
      const ballFinal = -(360 * 8 + idx * anglePerCell);

      rotRef.current.wheel = wheelFinal;
      rotRef.current.ball = ballFinal;

      if (wheelRef.current) {
        wheelRef.current.style.transition = "transform 4.2s cubic-bezier(0.15, 0.7, 0.2, 1)";
        wheelRef.current.style.transform = `rotate(${wheelFinal}deg)`;
      }
      if (ballRef.current) {
        ballRef.current.style.transition = "transform 4.2s cubic-bezier(0.15, 0.7, 0.2, 1)";
        ballRef.current.style.transform = `rotate(${ballFinal}deg)`;
      }

      setTimeout(() => {
        setResult(winning);
        setHistory((h) => [winning, ...h].slice(0, 14));

        // Считаем выигрыш по всем ставкам
        const isRed = REDS.has(winning);
        let won = 0;
        for (const b of bets) {
          let hit = false;
          if (b.type === "red") hit = isRed;
          else if (b.type === "black") hit = winning !== 0 && !isRed;
          else if (b.type === "green") hit = winning === 0;
          else if (b.type === "even") hit = winning !== 0 && winning % 2 === 0;
          else if (b.type === "odd") hit = winning % 2 === 1;
          else if (b.type === "low") hit = winning >= 1 && winning <= 18;
          else if (b.type === "high") hit = winning >= 19 && winning <= 36;
          else if (b.type === "number") hit = b.number === winning;
          if (hit) won += Math.round(b.amount * BET_LABELS[b.type].mult);
        }

        setWonAmount(won);
        if (typeof d.coins === "number") {
          const delta = won - totalBet;
          onResult(d.coins - (d.win ? d.payout : 0) - totalBet + won, d.xp);
          void delta;
        }
        setSpinning(false);
        setTimeout(() => setBets([]), 2500);
      }, 4400);
    } catch {
      setError("Не удалось сделать ставку");
      setSpinning(false);
    }
  };

  const hcol = (n: number) => n === 0 ? "#00a870" : REDS.has(n) ? "#d32f4f" : "#1a1a1a";

  return (
    <div>
      {/* Лента прошлых чисел */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
        {history.map((n, i) => (
          <span key={i} className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[13px] font-black flex-shrink-0"
            style={{ background: hcol(n), border: "1px solid rgba(255,255,255,0.1)" }}>
            {n}
          </span>
        ))}
      </div>

      {/* Колесо */}
      <div className="relative flex justify-center mb-5">
        <div
          className="relative rounded-full flex items-center justify-center"
          style={{
            width: 280, height: 280,
            background: "radial-gradient(circle at 30% 25%, #3a3a48 0%, #16161f 60%, #0a0a12 100%)",
            border: "6px solid #23232e",
            boxShadow: "0 24px 50px -18px rgba(0,0,0,1), inset 0 4px 20px rgba(255,255,255,0.05)",
          }}
        >
          {/* Диск колеса — вращается */}
          <div ref={wheelRef} className="absolute inset-4 rounded-full" style={{ willChange: "transform" }}>
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <defs>
                <radialGradient id="wheelBg">
                  <stop offset="0%" stopColor="#3a2418" />
                  <stop offset="100%" stopColor="#1a0f0a" />
                </radialGradient>
              </defs>
              {/* Ячейки */}
              {WHEEL_ORDER.map((n, i) => {
                const angle = (i * 360) / 37;
                const a1 = ((angle - 360 / 74) * Math.PI) / 180;
                const a2 = ((angle + 360 / 74) * Math.PI) / 180;
                const r1 = 100, r2 = 68;
                const path = `M ${100 + r1 * Math.cos(a1)} ${100 + r1 * Math.sin(a1)} A ${r1} ${r1} 0 0 1 ${100 + r1 * Math.cos(a2)} ${100 + r1 * Math.sin(a2)} L ${100 + r2 * Math.cos(a2)} ${100 + r2 * Math.sin(a2)} A ${r2} ${r2} 0 0 0 ${100 + r2 * Math.cos(a1)} ${100 + r2 * Math.sin(a1)} Z`;
                const tx = 100 + 84 * Math.cos((angle * Math.PI) / 180);
                const ty = 100 + 84 * Math.sin((angle * Math.PI) / 180);
                return (
                  <g key={n}>
                    <path d={path} fill={hcol(n)} stroke="#d4af37" strokeWidth="0.5" />
                    <text x={tx} y={ty} fill="white" fontSize="8" fontWeight="900"
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${angle + 90} ${tx} ${ty})`}>
                      {n}
                    </text>
                  </g>
                );
              })}
              {/* Внутренний круг */}
              <circle cx="100" cy="100" r="64" fill="url(#wheelBg)" stroke="#d4af37" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="14" fill="#d4af37" />
              <circle cx="100" cy="100" r="6" fill="#3a2418" />
            </svg>
          </div>

          {/* Шарик — крутится в обратную сторону */}
          <div ref={ballRef} className="absolute inset-0 pointer-events-none" style={{ willChange: "transform" }}>
            <div className="absolute left-1/2 -translate-x-1/2 top-[10px] w-3.5 h-3.5 rounded-full"
              style={{ background: "radial-gradient(circle at 30% 30%, #fff, #d0d0d8)", boxShadow: "0 2px 6px rgba(0,0,0,0.6)" }} />
          </div>

          {/* Указатель сверху */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-[#d4af37]" />
          </div>

          {/* Результат по центру */}
          {result !== null && !spinning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[24px] font-black animate-pop"
                style={{ background: hcol(result), border: "3px solid #d4af37", boxShadow: `0 0 30px ${hcol(result)}` }}>
                {result}
              </div>
            </div>
          )}
        </div>
      </div>

      {result !== null && !spinning && (
        <div className={`gash-alert mb-4 ${wonAmount > totalBet ? "gash-alert-success" : wonAmount > 0 ? "gash-alert-warning" : "gash-alert-danger"}`}>
          {wonAmount > 0
            ? `🎉 Выигрыш ${wonAmount.toLocaleString("ru-RU")} (ставка ${totalBet})`
            : `😔 Проигрыш ${totalBet.toLocaleString("ru-RU")}`}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

      {/* Поле чисел 1-36 */}
      <div className="mb-3">
        <div className="flex gap-1 mb-1">
          <button onClick={() => addBet("green")} disabled={spinning}
            className="w-9 h-[104px] rounded-lg text-white text-[13px] font-black flex items-center justify-center relative"
            style={{ background: "#00a870" }}>
            0
            {bets.find((b) => b.type === "green") && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ffb340] text-[9px] font-black text-black flex items-center justify-center">
                {bets.find((b) => b.type === "green")?.amount}
              </span>
            )}
          </button>
          <div className="grid grid-cols-12 gap-1 flex-1">
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
              const num = ((n - 1) % 3 === 0) ? n + 2 : ((n - 1) % 3 === 1) ? n : n - 2;
              const bet = bets.find((b) => b.type === "number" && b.number === num);
              return (
                <button key={num} onClick={() => addBet("number", num)} disabled={spinning}
                  className="h-8 rounded-md text-white text-[11px] font-black flex items-center justify-center relative"
                  style={{ background: hcol(num) }}>
                  {num}
                  {bet && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ffb340] text-[8px] font-black text-black flex items-center justify-center">
                      {bet.amount > 99 ? "99+" : bet.amount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Внешние ставки */}
        <div className="grid grid-cols-6 gap-1">
          {(["low", "even", "red", "black", "odd", "high"] as BetType[]).map((t) => {
            const meta = BET_LABELS[t];
            const bet = bets.find((b) => b.type === t);
            return (
              <button key={t} onClick={() => addBet(t)} disabled={spinning}
                className="h-11 rounded-lg text-white text-[11px] font-black flex items-center justify-center relative"
                style={{ background: meta.color, border: "1px solid rgba(255,255,255,0.1)" }}>
                {meta.label}
                {bet && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ffb340] text-[9px] font-black text-black flex items-center justify-center">
                    {bet.amount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Фишки */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} onClick={() => setChip(v)}
            className="w-12 h-12 rounded-full text-white text-[11.5px] font-black flex items-center justify-center transition-transform"
            style={{
              background: chip === v ? "radial-gradient(circle at 30% 30%, #ffd76e, #d99b28)" : "radial-gradient(circle at 30% 30%, #4a4a5e, #2a2a36)",
              border: chip === v ? "2px solid #fff" : "2px dashed rgba(255,255,255,0.2)",
              boxShadow: chip === v ? "0 8px 20px -8px rgba(255,179,64,1)" : "none",
              transform: chip === v ? "scale(1.1)" : "scale(1)",
            }}>
            {v}
          </button>
        ))}
      </div>

      {/* Итог + кнопки */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={undo} disabled={spinning || bets.length === 0} className="gash-btn-ghost !py-3 !px-4">
          ↶
        </button>
        <button onClick={clear} disabled={spinning || bets.length === 0} className="gash-btn-ghost !py-3 !px-4">
          ✕
        </button>
        <div className="flex-1 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between px-4">
          <span className="text-[11px] uppercase tracking-wider text-[#6a6a80] font-bold">Ставка</span>
          <span className="text-[16px] font-black text-white tabular-nums">{totalBet.toLocaleString("ru-RU")}</span>
        </div>
      </div>

      <button onClick={() => void spin()} disabled={spinning || bets.length === 0}
        className="w-full h-14 rounded-2xl text-[15px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        style={{
          background: "linear-gradient(135deg, #8f72ff, #7c5cff 50%, #5334d6)",
          boxShadow: "0 14px 30px -12px rgba(124,92,255,1), 0 1px 0 rgba(255,255,255,0.25) inset",
        }}>
        {spinning ? "🎡 Колесо крутится…" : "🎡 КРУТИТЬ"}
      </button>
    </div>
  );
}
