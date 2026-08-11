"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

/**
 * Слоты в стиле пятибарабанных игр: 5 барабанов по 3 символа,
 * каждый крутится с задержкой. Выигрышные линии подсвечиваются.
 */

const SYMBOLS = [
  { s: "💎", name: "diamond", mult: 25, color: "#22d3ee" },
  { s: "👑", name: "crown", mult: 15, color: "#ffb340" },
  { s: "🏺", name: "vase", mult: 10, color: "#f043a0" },
  { s: "💍", name: "ring", mult: 8, color: "#a68fff" },
  { s: "🔺", name: "tri", mult: 5, color: "#34e5a0" },
  { s: "🟨", name: "hex", mult: 3, color: "#ffb340" },
];

const REELS = 5;
const ROWS = 3;

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export function SlotsReels({ coins, onResult }: Props) {
  const [bet, setBet] = useState(20);
  const [reels, setReels] = useState<typeof SYMBOLS[number][][]>(() =>
    Array.from({ length: REELS }, () => Array.from({ length: ROWS }, randomSymbol))
  );
  const [spinning, setSpinning] = useState(false);
  const [wins, setWins] = useState<number[]>([]); // индексы выигрышных барабанов
  const [payout, setPayout] = useState(0);
  const [error, setError] = useState("");
  const [autoSpin, setAutoSpin] = useState(false);
  const autoRef = useRef(false);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { autoRef.current = autoSpin; }, [autoSpin]);

  const spin = async () => {
    if (spinning) return;
    if (bet > coins) { setError("Недостаточно монет"); setAutoSpin(false); return; }
    setError("");
    setSpinning(true);
    setWins([]);
    setPayout(0);

    // Крутим каждый барабан визуально
    reelRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = "translateY(0)";
      requestAnimationFrame(() => {
        el.style.transition = `transform ${1.4 + i * 0.25}s cubic-bezier(0.15, 0.7, 0.15, 1)`;
        el.style.transform = `translateY(-${1200 + i * 200}px)`;
      });
    });

    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "slots", bet, clientSeed: String(Date.now()) }),
      });
      const d = await r.json();

      await new Promise((r) => setTimeout(r, 2500));

      if (!r.ok) throw new Error(d.error);

      // Итоговая раскладка: серверные 3 символа образуют среднюю линию,
      // остальные генерируем локально — это только визуал
      const serverRow = (d.reels ?? []).map((s: string) => SYMBOLS.find((x) => x.s === s) ?? SYMBOLS[0]);
      const finalReels: typeof SYMBOLS[number][][] = Array.from({ length: REELS }, (_, i) => {
        if (i < 3 && serverRow[i]) {
          return [randomSymbol(), serverRow[i], randomSymbol()];
        }
        return Array.from({ length: ROWS }, randomSymbol);
      });

      setReels(finalReels);

      // Сбрасываем позицию барабанов после отрисовки
      reelRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transition = "none";
        el.style.transform = "translateY(0)";
      });

      // Подсветка выигрышных барабанов (по средней линии)
      const winReels: number[] = [];
      if (d.win) {
        const mid = finalReels.map((col) => col[1]);
        const first = mid[0];
        let streak = 1;
        for (let i = 1; i < mid.length; i++) {
          if (mid[i].s === first.s) streak++;
          else break;
        }
        for (let i = 0; i < streak; i++) winReels.push(i);
      }

      setWins(winReels);
      setPayout(d.win ? d.payout : 0);
      setSpinning(false);
      if (typeof d.coins === "number") onResult(d.coins, d.xp);

      if (autoRef.current) setTimeout(() => void spin(), 900);
    } catch {
      setError("Ошибка");
      setSpinning(false);
      setAutoSpin(false);
    }
  };

  const won = payout > 0;

  return (
    <div>
      {/* Игровое поле с барабанами */}
      <div
        className="relative rounded-3xl overflow-hidden mb-4 p-4"
        style={{
          background: "linear-gradient(180deg, #2d1b5e 0%, #6b1e6a 50%, #b83d7a 100%)",
          border: "3px solid #d4af37",
          boxShadow: "0 24px 50px -20px rgba(0,0,0,1), inset 0 4px 20px rgba(255,255,255,0.06)",
        }}
      >
        {/* Верхняя надпись */}
        <div className="text-center mb-3">
          <span className="text-[11px] font-black text-[#d4af37] tracking-[0.2em]">
            ВЫИГРАЙТЕ ДО ×5000
          </span>
        </div>

        {/* Барабаны */}
        <div className="grid grid-cols-5 gap-1.5 relative">
          {reels.map((col, i) => {
            const isWin = wins.includes(i);
            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden relative"
                style={{
                  height: 210,
                  background: "linear-gradient(180deg, #1a0f2e, #2d1b4e)",
                  border: isWin ? "2px solid #ffb340" : "1px solid rgba(212,175,55,0.3)",
                  boxShadow: isWin ? "0 0 24px #ffb340, inset 0 0 20px rgba(255,179,64,0.3)" : "inset 0 2px 10px rgba(0,0,0,0.6)",
                  transition: "box-shadow 0.3s, border-color 0.3s",
                }}
              >
                <div
                  ref={(el) => { reelRefs.current[i] = el; }}
                  className="flex flex-col"
                >
                  {/* Настоящие символы */}
                  {col.map((sym, j) => (
                    <div key={`real-${j}`}
                      className="flex items-center justify-center transition-transform"
                      style={{
                        height: 70,
                        background: `radial-gradient(circle at 50% 50%, ${sym.color}22, transparent 70%)`,
                        transform: isWin && j === 1 ? "scale(1.15)" : "scale(1)",
                      }}>
                      <span className="text-[38px] leading-none" style={{ filter: isWin && j === 1 ? `drop-shadow(0 0 10px ${sym.color})` : "none" }}>
                        {sym.s}
                      </span>
                    </div>
                  ))}
                  {/* Символы для анимации вращения */}
                  {Array.from({ length: 24 }).map((_, k) => {
                    const s = randomSymbol();
                    return (
                      <div key={`spin-${k}`} className="flex items-center justify-center" style={{ height: 70 }}>
                        <span className="text-[38px] leading-none">{s.s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Выделение центральной линии */}
          <div className="absolute inset-x-0 top-[70px] h-[70px] pointer-events-none border-y border-[#d4af37]/25" />
        </div>

        {/* Результат */}
        {!spinning && (won || payout === 0) && payout !== 0 && (
          <div className="text-center mt-3">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#ffb340] text-[#2d1b5e] text-[13px] font-black animate-pop">
              🎰 ВЫИГРЫШ +{payout.toLocaleString("ru-RU")}
            </span>
          </div>
        )}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Пульт управления */}
      <div className="rounded-2xl p-4"
        style={{ background: "linear-gradient(180deg, #1a0f2e, #16161f)", border: "1px solid rgba(212,175,55,0.25)" }}>
        <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center mb-3">
          {/* Кредит */}
          <div>
            <p className="text-[9.5px] uppercase tracking-wider font-black text-[#d4af37]">Кредит</p>
            <p className="text-[18px] font-black text-white tabular-nums">{coins.toLocaleString("ru-RU")}</p>
          </div>

          {/* Кнопка спина */}
          <button onClick={() => void spin()} disabled={spinning}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-60"
            style={{
              background: "radial-gradient(circle at 30% 30%, #ffd76e, #d99b28)",
              border: "3px solid #fff",
              boxShadow: "0 10px 24px -8px rgba(255,179,64,1)",
            }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2d1b5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className={spinning ? "animate-spin-slow" : ""}>
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>

          {/* Ставка */}
          <div className="text-right">
            <p className="text-[9.5px] uppercase tracking-wider font-black text-[#d4af37]">Ставка</p>
            <p className="text-[18px] font-black text-white tabular-nums">{bet}</p>
          </div>
        </div>

        {/* Регулятор ставки */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning}
            className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-[16px] font-black hover:bg-white/[0.1] disabled:opacity-40">
            −
          </button>
          {[10, 20, 50, 100, 500].map((v) => (
            <button key={v} onClick={() => setBet(v)} disabled={spinning}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-black transition-all ${
                bet === v ? "bg-[#d4af37] text-[#2d1b5e]" : "bg-white/[0.05] text-[#c8c8d8] border border-white/[0.08]"
              }`}>
              {v}
            </button>
          ))}
          <button onClick={() => setBet(Math.min(coins, bet + 10))} disabled={spinning}
            className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-[16px] font-black hover:bg-white/[0.1] disabled:opacity-40">
            +
          </button>
        </div>

        {/* Автоспин */}
        <button onClick={() => setAutoSpin((v) => !v)} disabled={spinning && !autoSpin}
          className={`w-full py-2.5 rounded-xl text-[12px] font-black border transition-all ${
            autoSpin ? "bg-[#ffb340]/20 border-[#ffb340]/50 text-[#ffb340]" : "bg-white/[0.04] border-white/[0.08] text-[#8a8a9e]"
          }`}>
          {autoSpin ? "⏹ Остановить автоспин" : "♾ АВТОСПИН"}
        </button>
      </div>
    </div>
  );
}
