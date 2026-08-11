"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  path: number[];
  step: number;
  done: boolean;
  slot: number;
  mult: number;
  trail: { x: number; y: number }[];
}

const ROWS = 12;
const PAYOUTS = [10, 5, 2.4, 1.4, 1.1, 0.6, 0.4, 0.6, 1.1, 1.4, 2.4, 5, 10];

/** Цвет ячейки по величине множителя */
function slotColor(m: number): string {
  if (m >= 5) return "#ff5470";
  if (m >= 2) return "#ff8a5c";
  if (m >= 1.1) return "#ffc542";
  return "#6c5ce7";
}

/**
 * Plinko — шарик падает через треугольник колышков.
 * Путь приходит с сервера (provably fair), физика лишь отрисовывает его.
 */
export function PlinkoGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [dropping, setDropping] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ mult: number; win: number }[]>([]);
  const [totalWin, setTotalWin] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const rafRef = useRef(0);
  const pegsRef = useRef<{ x: number; y: number }[]>([]);
  const flashRef = useRef<Map<number, number>>(new Map());

  /* Раскладка колышков */
  const layout = useCallback((W: number, H: number) => {
    const pegs: { x: number; y: number }[] = [];
    const top = 40;
    const bottom = H - 54;
    const gapY = (bottom - top) / ROWS;

    for (let r = 0; r < ROWS; r++) {
      const count = r + 3;
      const gapX = Math.min(W / (count + 1), 34);
      const startX = W / 2 - ((count - 1) * gapX) / 2;
      for (let c = 0; c < count; c++) {
        pegs.push({ x: startX + c * gapX, y: top + r * gapY });
      }
    }
    pegsRef.current = pegs;
    return { top, bottom, gapY };
  }, []);

  /* Отрисовка */
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (cv.width !== Math.floor(W * dpr)) {
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const { top, bottom, gapY } = layout(W, H);

    /* Колышки */
    for (const p of pegsRef.current) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fill();
    }

    /* Ячейки внизу */
    const slotW = Math.min(W / PAYOUTS.length, 40);
    const slotStart = W / 2 - (PAYOUTS.length * slotW) / 2;
    const now = performance.now();

    PAYOUTS.forEach((m, i) => {
      const x = slotStart + i * slotW;
      const col = slotColor(m);
      const flash = flashRef.current.get(i) ?? 0;
      const glow = Math.max(0, 1 - (now - flash) / 600);

      ctx.beginPath();
      ctx.roundRect(x + 1.5, bottom + 8, slotW - 3, 30, 7);
      ctx.fillStyle = col + (glow > 0 ? "cc" : "33");
      ctx.fill();

      if (glow > 0) {
        ctx.shadowBlur = 18 * glow;
        ctx.shadowColor = col;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = glow > 0 ? "#fff" : col;
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${m}×`, x + slotW / 2, bottom + 23);
    });

    /* Шарики */
    for (const b of ballsRef.current) {
      // След
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const a = (i / b.trail.length) * 0.35;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4 * (i / b.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(169,155,255,${a})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, 6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#8577f0");
      ctx.fillStyle = g;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#6c5ce7";
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    return { top, bottom, gapY, slotW, slotStart };
  }, [layout]);

  /* Анимация падения */
  const animate = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const { top, bottom, gapY } = layout(W, H);

    const slotW = Math.min(W / PAYOUTS.length, 40);
    const slotStart = W / 2 - (PAYOUTS.length * slotW) / 2;

    for (const b of ballsRef.current) {
      if (b.done) continue;

      // Целевая позиция по шагам пути
      const targetRow = Math.min(b.step, ROWS);
      const targetY = top + targetRow * gapY;

      // Смещение вправо-влево по решению сервера
      let offset = 0;
      for (let i = 0; i < Math.min(b.step, b.path.length); i++) {
        offset += b.path[i] === 1 ? 1 : -1;
      }
      const gapX = Math.min(W / (ROWS + 4), 34);
      const targetX = W / 2 + (offset * gapX) / 2;

      b.vy += 0.42;
      b.vx += (targetX - b.x) * 0.055;
      b.vx *= 0.86;
      b.x += b.vx;
      b.y += b.vy;

      // Достигли ряда — переходим к следующему
      if (b.y >= targetY && b.step <= ROWS) {
        b.step++;
        b.vy *= 0.42;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 9) b.trail.shift();

      // Приземление
      if (b.y >= bottom + 4) {
        b.done = true;
        b.y = bottom + 4;
        flashRef.current.set(b.slot, performance.now());
        const win = Math.round(Number(bet) * b.mult);
        setResults((p) => [{ mult: b.mult, win }, ...p].slice(0, 12));
        setTotalWin((t) => t + win);
        setDropping((d) => Math.max(0, d - 1));
      }
    }

    // Убираем упавшие через паузу
    ballsRef.current = ballsRef.current.filter((b) => !b.done || performance.now() - (flashRef.current.get(b.slot) ?? 0) < 400);

    draw();

    if (ballsRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      draw();
    }
  }, [bet, draw, layout]);

  const drop = async () => {
    const amount = Number(bet);
    if (!amount || amount <= 0) return;
    if (amount > coins) {
      setError("Недостаточно монет");
      return;
    }
    setError("");

    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "plinko", bet: amount, clientSeed: String(Date.now()) }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка");
        return;
      }

      const cv = canvasRef.current;
      const W = cv?.getBoundingClientRect().width ?? 340;

      ballsRef.current.push({
        x: W / 2,
        y: 14,
        vx: 0,
        vy: 0,
        path: d.path || [],
        step: 0,
        done: false,
        slot: d.slot ?? 6,
        mult: d.multiplier ?? 1,
        trail: [],
      });

      setDropping((n) => n + 1);
      if (typeof d.coins === "number") onResult(d.coins, d.xp);

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(animate);
    } catch {
      setError("Нет связи");
    }
  };

  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div>
      <div
        className="relative rounded-2xl overflow-hidden mb-4 border border-white/[0.08]"
        style={{
          height: 420,
          background: "radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.15), transparent 65%), #0f0f16",
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {dropping > 0 && (
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[#6c5ce7]/20 text-[#a99bff] border border-[#6c5ce7]/35">
            Шариков в игре: {dropping}
          </div>
        )}
        {totalWin > 0 && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-[12px] font-extrabold tabular-nums bg-[#00e0a4]/15 text-[#4ff0c8] border border-[#00e0a4]/30">
            Всего +{totalWin.toLocaleString("ru-RU")}
          </div>
        )}
      </div>

      {/* Последние падения */}
      {results.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 pb-1">
          {results.map((r, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg text-[11.5px] font-extrabold tabular-nums flex-shrink-0 animate-pop"
              style={{
                background: `${slotColor(r.mult)}22`,
                color: slotColor(r.mult),
                border: `1px solid ${slotColor(r.mult)}44`,
              }}
            >
              {r.mult}× · +{r.win}
            </span>
          ))}
        </div>
      )}

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={bet}
          onChange={(e) => setBet(e.target.value)}
          className="gash-input !text-[16px] !font-bold flex-1"
        />
        <button onClick={() => setBet(String(Math.max(1, Math.floor(Number(bet) / 2))))} className="gash-btn-ghost !px-3">½</button>
        <button onClick={() => setBet(String(Math.floor(Number(bet) * 2)))} className="gash-btn-ghost !px-3">2×</button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => void drop()} className="gash-btn !py-4">
          🔴 Бросить шарик
        </button>
        <button
          onClick={() => {
            for (let i = 0; i < 5; i++) setTimeout(() => void drop(), i * 180);
          }}
          className="gash-btn-outline !py-4"
        >
          ⚡ Бросить 5 подряд
        </button>
      </div>

      <p className="text-[11.5px] text-[#6a6a7a] mt-3 text-center">
        Края поля дают ×10 · центр ×0.4 · чем дальше от середины, тем выше выплата
      </p>
    </div>
  );
}
