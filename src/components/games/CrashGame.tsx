"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

type Phase = "idle" | "flying" | "crashed" | "cashed";

/**
 * Crash — ракета летит по кривой, множитель растёт с ускорением.
 * Дизайн вдохновлён классической схемой: жёлто-оранжевое небо,
 * пустыня внизу, ракета оставляет пламенный след.
 * Точка взрыва приходит с сервера заранее — предсказать нельзя.
 */
export function CrashGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [auto, setAuto] = useState("2.00");
  const [useAuto, setUseAuto] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(1);
  const [crashAt, setCrashAt] = useState(0);
  const [cashedMult, setCashedMult] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<number[]>([]);
  const [autoBet, setAutoBet] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const crashRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const pathRef = useRef<{ x: number; y: number }[]>([]);
  const betRef = useRef(0);
  const autoRef = useRef(0);
  const cashedRef = useRef(false);
  const partsRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; col: string; size: number }[]>([]);
  const shakeRef = useRef(0);
  const autoBetRef = useRef(false);
  const starsRef = useRef<{ x: number; y: number; r: number; s: number }[]>([]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);

  const multAt = (ms: number) => Math.pow(1.00005, ms) + ms / 30000;

  /* Отрисовка */
  const draw = useCallback((speed = 0) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (cv.width !== Math.floor(W * dpr)) {
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      starsRef.current = Array.from({ length: 50 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.75,
        r: Math.random() * 1.3 + 0.4,
        s: Math.random() * 0.4 + 0.1,
      }));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const shake = shakeRef.current;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shakeRef.current = Math.max(0, shake - 0.7);
    }

    /* Небо: розово-оранжевый градиент */
    const sky = ctx.createLinearGradient(0, 0, W, H);
    sky.addColorStop(0, "#4a2372");
    sky.addColorStop(0.4, "#8a3d7e");
    sky.addColorStop(0.75, "#e07443");
    sky.addColorStop(1, "#ffa961");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    /* Звёзды */
    for (const st of starsRef.current) {
      st.y += st.s * (1 + speed * 1.5);
      if (st.y > H * 0.75) { st.y = 0; st.x = Math.random() * W; }
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 240, 200, ${0.4 + st.r * 0.2})`;
      ctx.fill();
    }

    /* Дюны внизу */
    const duneY = H - 40;
    const dune = ctx.createLinearGradient(0, duneY, 0, H);
    dune.addColorStop(0, "#c96431");
    dune.addColorStop(1, "#8a3d1e");
    ctx.fillStyle = dune;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, duneY + 10);
    ctx.quadraticCurveTo(W * 0.3, duneY - 8, W * 0.55, duneY + 4);
    ctx.quadraticCurveTo(W * 0.8, duneY + 16, W, duneY);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    const crashed = phaseRef.current === "crashed";
    const cashed = cashedRef.current;
    const trail = crashed ? "#ff3040" : cashed ? "#34e5a0" : "#ffd76b";

    const pts = pathRef.current;
    if (pts.length > 1) {
      /* Пламенный след */
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, trail + "88");
      g.addColorStop(1, trail + "10");
      ctx.beginPath();
      ctx.moveTo(pts[0].x, H - 30);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(pts[pts.length - 1].x, H - 30);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      /* Линия следа */
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], prev = pts[i - 1];
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + p.x) / 2, (prev.y + p.y) / 2);
      }
      ctx.strokeStyle = trail;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowBlur = 22;
      ctx.shadowColor = trail;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Ракета */
      const last = pts[pts.length - 1];
      if (!crashed) {
        const flame = 14 + speed * 30;
        const fg = ctx.createLinearGradient(last.x - flame, last.y + flame * 0.4, last.x, last.y);
        fg.addColorStop(0, "rgba(255,80,20,0)");
        fg.addColorStop(0.5, "rgba(255,180,60,0.7)");
        fg.addColorStop(1, "rgba(255,240,180,1)");
        ctx.beginPath();
        ctx.moveTo(last.x - flame, last.y + flame * 0.5);
        ctx.lineTo(last.x - flame * 0.35, last.y + flame * 0.1);
        ctx.lineTo(last.x - 2, last.y + 3);
        ctx.closePath();
        ctx.fillStyle = fg;
        ctx.fill();

        if (Math.random() > 0.5) {
          partsRef.current.push({
            x: last.x - 6, y: last.y + 4,
            vx: -(1 + Math.random() * 3), vy: (Math.random() - 0.3) * 2,
            life: 1, col: Math.random() > 0.5 ? "#ffb347" : "#ff5030", size: 1.5 + Math.random() * 2,
          });
        }

        /* Ракета: корпус */
        ctx.save();
        ctx.translate(last.x, last.y);
        ctx.rotate(-0.55);
        const bodyGrad = ctx.createLinearGradient(-14, 0, 14, 0);
        bodyGrad.addColorStop(0, "#e8e8f0");
        bodyGrad.addColorStop(0.5, "#ffffff");
        bodyGrad.addColorStop(1, "#a8a8bd");
        ctx.fillStyle = bodyGrad;
        // Корпус
        ctx.beginPath();
        ctx.moveTo(-16, 5);
        ctx.lineTo(10, 5);
        ctx.lineTo(18, 0);
        ctx.lineTo(10, -5);
        ctx.lineTo(-16, -5);
        ctx.closePath();
        ctx.fill();
        // Иллюминатор
        ctx.beginPath();
        ctx.arc(4, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#22d3ee";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#22d3ee";
        ctx.fill();
        ctx.shadowBlur = 0;
        // Крылья
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.moveTo(-12, 5);
        ctx.lineTo(-18, 10);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, -5);
        ctx.lineTo(-18, -10);
        ctx.lineTo(-6, -5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    /* Частицы */
    partsRef.current = partsRef.current.filter((p) => p.life > 0);
    for (const p of partsRef.current) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.09; p.life -= 0.024;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, []);

  const explode = useCallback(() => {
    const pts = pathRef.current;
    const last = pts[pts.length - 1];
    if (!last) return;
    shakeRef.current = 16;
    for (let i = 0; i < 60; i++) {
      const a = (Math.PI * 2 * i) / 60 + Math.random() * 0.3;
      const sp = 1.5 + Math.random() * 6;
      partsRef.current.push({
        x: last.x, y: last.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        life: 1,
        col: ["#ff3040", "#ff8a5c", "#ffc542", "#ffffff"][Math.floor(Math.random() * 4)],
        size: 2 + Math.random() * 3.5,
      });
    }
  }, []);

  const loop = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const elapsed = performance.now() - startRef.current;
    const m = multAt(elapsed);
    const target = crashRef.current;
    const speed = Math.min(1, (m - 1) / 8);

    if (m >= target) {
      setMult(target);
      setPhase("crashed");
      phaseRef.current = "crashed";
      setHistory((h) => [target, ...h].slice(0, 14));
      explode();
      let frames = 0;
      const after = () => {
        draw(0);
        frames++;
        if (frames < 70) rafRef.current = requestAnimationFrame(after);
        else if (autoBetRef.current) startCountdown();
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(after);
      return;
    }

    setMult(m);
    if (useAuto && !cashedRef.current && autoRef.current > 1 && m >= autoRef.current) {
      void cashout(autoRef.current);
    }

    // Логарифмическая шкала: и на ×2, и на ×100 ракета остаётся в кадре
    const prog = Math.min(1, elapsed / 25000);
    const x = 20 + Math.min(prog * (W - 60), W - 50);
    const yProgress = Math.min(1, Math.log(m) / Math.log(50));
    const y = H - 40 - yProgress * (H - 80);

    pathRef.current.push({ x, y });
    if (pathRef.current.length > 1000) pathRef.current.shift();

    draw(speed);
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, explode, useAuto]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          if (autoBetRef.current) void start();
          return 0;
        }
        return c - 1;
      });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    const amount = Number(bet);
    if (!amount || amount <= 0) return;
    if (amount > coins) { setError("Недостаточно монет"); setAutoBet(false); return; }

    setError("");
    setPhase("flying");
    phaseRef.current = "flying";
    setMult(1); setCashedMult(0); setCountdown(0);
    cashedRef.current = false;
    pathRef.current = []; partsRef.current = [];
    betRef.current = amount;
    autoRef.current = Number(auto) || 0;

    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "crash", bet: amount, autoCashout: useAuto ? Number(auto) : 0, clientSeed: String(Date.now()) }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Ошибка"); setPhase("idle"); setAutoBet(false); return; }
      crashRef.current = d.crashPoint;
      setCrashAt(d.crashPoint);
      if (typeof d.coins === "number") onResult(d.coins, d.xp);
      startRef.current = performance.now();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setError("Нет связи с сервером");
      setPhase("idle"); setAutoBet(false);
    }
  }, [bet, auto, useAuto, coins, loop, onResult]);

  const cashout = useCallback(async (atMult?: number) => {
    if (cashedRef.current || phaseRef.current !== "flying") return;
    cashedRef.current = true;
    const m = atMult ?? multAt(performance.now() - startRef.current);
    setCashedMult(m);
    setPhase("cashed");
    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "crash", bet: betRef.current, autoCashout: m, clientSeed: String(Date.now()) }),
      });
      const d = await r.json();
      if (typeof d.coins === "number") onResult(d.coins, d.xp);
    } catch { /* тихо */ }
  }, [onResult]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => { draw(0); }, [draw]);

  const flying = phase === "flying" && !cashedRef.current;
  const shown = phase === "flying" ? mult : phase === "crashed" ? crashAt : phase === "cashed" ? cashedMult : 1;
  const bigCol = phase === "crashed" ? "#ff3040" : phase === "cashed" ? "#34e5a0" : "#ffb340";

  /** Цвет плитки истории по величине множителя */
  const hCol = (h: number) => {
    if (h >= 10) return { bg: "rgba(240, 67, 160, 0.28)", txt: "#f043a0", bd: "rgba(240, 67, 160, 0.5)" };
    if (h >= 3) return { bg: "rgba(255, 179, 64, 0.24)", txt: "#ffb340", bd: "rgba(255, 179, 64, 0.5)" };
    if (h >= 2) return { bg: "rgba(52, 229, 160, 0.2)", txt: "#34e5a0", bd: "rgba(52, 229, 160, 0.4)" };
    return { bg: "rgba(124, 92, 255, 0.18)", txt: "#a68fff", bd: "rgba(124, 92, 255, 0.4)" };
  };

  return (
    <div>
      {/* Лента прошлых раундов */}
      <div className="flex gap-1.5 items-center mb-3 overflow-x-auto no-scrollbar pb-1">
        {history.map((h, i) => {
          const c = hCol(h);
          return (
            <span
              key={i}
              className="px-3 py-1.5 rounded-xl text-[12px] font-black tabular-nums flex-shrink-0"
              style={{ background: c.bg, color: c.txt, border: `1px solid ${c.bd}` }}
            >
              {h.toFixed(2)}×
            </span>
          );
        })}
        <span className="ml-auto flex-shrink-0 w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[12px] text-[#5a5a70]">
          🕐
        </span>
      </div>

      {/* Небо */}
      <div
        className="relative rounded-3xl overflow-hidden mb-5 border transition-colors duration-300"
        style={{
          height: 340,
          borderColor: phase === "crashed" ? "rgba(255,48,64,0.45)" : phase === "cashed" ? "rgba(52,229,160,0.4)" : "rgba(255,179,64,0.28)",
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Множитель */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
          <div
            className="font-black tabular-nums leading-none transition-all"
            style={{
              fontSize: phase === "flying" ? "clamp(56px, 14vw, 96px)" : "clamp(46px, 11vw, 74px)",
              color: bigCol,
              textShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 60px ${bigCol}88`,
              letterSpacing: "-0.04em",
            }}
          >
            x{shown.toFixed(2)}
          </div>

          {phase === "crashed" && (
            <p className="mt-2 text-[15px] font-black text-white bg-[#ff3040]/90 px-4 py-1.5 rounded-full">
              💥 Ракета взорвалась
            </p>
          )}
          {phase === "cashed" && (
            <p className="mt-2 text-[15px] font-black text-white bg-[#34e5a0]/90 px-4 py-1.5 rounded-full">
              ✅ Забрано {Math.round(betRef.current * cashedMult).toLocaleString("ru-RU")}
            </p>
          )}
          {countdown > 0 && (
            <p className="mt-3 text-[14px] font-extrabold text-white bg-black/60 px-4 py-1.5 rounded-full">
              Следующий раунд · {countdown}
            </p>
          )}
        </div>
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Автоставка / автовывод */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <span
            onClick={() => setAutoBet((v) => !v)}
            className={`w-10 h-5 rounded-full relative transition-colors ${autoBet ? "bg-[#7c5cff]" : "bg-white/15"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoBet ? "left-[22px]" : "left-0.5"}`} />
          </span>
          <span className="text-[12.5px] font-bold text-[#c8c8d8]">Автоставка</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <span
            onClick={() => setUseAuto((v) => !v)}
            className={`w-10 h-5 rounded-full relative transition-colors ${useAuto ? "bg-[#7c5cff]" : "bg-white/15"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useAuto ? "left-[22px]" : "left-0.5"}`} />
          </span>
          <span className="text-[12.5px] font-bold text-[#c8c8d8]">Автовывод</span>
        </label>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11.5px] text-[#6a6a80]">×</span>
          <input
            type="number"
            step="0.1" min="1.01"
            value={auto}
            onChange={(e) => setAuto(e.target.value)}
            disabled={phase === "flying"}
            className="w-20 gash-input !py-2 !text-[13px] !text-center !font-bold"
          />
        </div>
      </div>

      {/* Быстрые множители */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[1.5, 2, 3, 5, 10, 20].map((m) => (
          <button
            key={m}
            onClick={() => { setAuto(m.toFixed(2)); setUseAuto(true); }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all ${
              useAuto && Number(auto) === m
                ? "bg-[#7c5cff] text-white border-transparent"
                : "bg-white/[0.04] text-[#8a8a9e] border-white/[0.08] hover:bg-white/[0.08]"
            }`}
          >
            ×{m}
          </button>
        ))}
      </div>

      {/* Ставка */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setBet(String(Math.max(1, Number(bet) - 50)))}
          disabled={phase === "flying"}
          className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[20px] font-bold text-[#c8c8d8] hover:bg-white/[0.08] disabled:opacity-40">
          −
        </button>
        <div className="flex-1 relative">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={phase === "flying"}
            className="gash-input !text-center !text-[22px] !font-black !py-3"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a5a70] text-[15px] font-bold pointer-events-none">₽</span>
        </div>
        <button onClick={() => setBet(String(Number(bet) + 50))}
          disabled={phase === "flying"}
          className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[20px] font-bold text-[#c8c8d8] hover:bg-white/[0.08] disabled:opacity-40">
          +
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[50, 100, 200, 500, 1000].map((b) => (
          <button key={b} onClick={() => setBet(String(b))} disabled={phase === "flying"}
            className="flex-1 min-w-[60px] px-2 py-1.5 rounded-lg text-[11.5px] font-bold bg-white/[0.04] text-[#8a8a9e] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-40">
            +{b}
          </button>
        ))}
      </div>

      {/* Главная кнопка */}
      {flying ? (
        <button onClick={() => void cashout()}
          className="w-full h-16 rounded-2xl text-[17px] font-black text-white transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #34e5a0, #12b47a)",
            boxShadow: "0 14px 32px -12px rgba(52,229,160,1), 0 1px 0 rgba(255,255,255,0.3) inset",
          }}>
          ЗАБРАТЬ {Math.round(Number(bet) * mult).toLocaleString("ru-RU")}
        </button>
      ) : (
        <button onClick={() => void start()} disabled={phase === "flying" || Number(bet) <= 0}
          className="w-full h-16 rounded-2xl text-[17px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #8f72ff, #7c5cff 50%, #5334d6)",
            boxShadow: "0 14px 32px -12px rgba(124,92,255,1), 0 1px 0 rgba(255,255,255,0.25) inset",
          }}>
          СТАВКА
        </button>
      )}
    </div>
  );
}
