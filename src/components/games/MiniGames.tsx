"use client";

import { useState } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

async function play(payload: Record<string, unknown>) {
  const r = await fetch("/api/casino/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, clientSeed: String(Date.now()) }),
  });
  return { ok: r.ok, data: await r.json() };
}

/* ══════════════ MINES ══════════════ */
export function MinesGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [mines, setMines] = useState(3);
  const [board, setBoard] = useState<("hidden" | "gem" | "bomb")[]>(Array(25).fill("hidden"));
  const [mineSet, setMineSet] = useState<number[]>([]);
  const [active, setActive] = useState(false);
  const [picks, setPicks] = useState(0);
  const [mult, setMult] = useState(1);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const calcMult = (n: number) => {
    let m = 1;
    for (let k = 0; k < n; k++) m *= (25 - k) / (25 - mines - k);
    return m * 0.97;
  };

  const start = async () => {
    const amount = Number(bet);
    if (amount > coins) { setError("Недостаточно монет"); return; }
    setError(""); setMsg("");

    const { ok, data } = await play({ game: "mines", bet: amount, mines, picks: 1 });
    if (!ok) { setError(data.error); return; }

    setMineSet(data.mines || []);
    setBoard(Array(25).fill("hidden"));
    setPicks(0);
    setMult(1);
    setActive(true);
    if (typeof data.coins === "number") onResult(data.coins, data.xp);
  };

  const open = (i: number) => {
    if (!active || board[i] !== "hidden") return;

    if (mineSet.includes(i)) {
      // Попали на мину — раскрываем всё поле
      const next = board.map((c, k) => (mineSet.includes(k) ? "bomb" : c === "hidden" ? "hidden" : c));
      setBoard(next as typeof board);
      setActive(false);
      setMsg("💣 Мина! Ставка сгорела");
      return;
    }

    const next = [...board];
    next[i] = "gem";
    setBoard(next);
    const p = picks + 1;
    setPicks(p);
    setMult(calcMult(p));
  };

  const cashout = async () => {
    if (!active || picks === 0) return;
    const amount = Number(bet);
    const { data } = await play({ game: "mines", bet: amount, mines, picks });
    const win = Math.round(amount * calcMult(picks));
    setActive(false);
    setMsg(`✅ Забрано ${win.toLocaleString("ru-RU")} монет`);
    if (typeof data.coins === "number") onResult(data.coins + win, data.xp);
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 mb-4 max-w-[340px] mx-auto">
        {board.map((c, i) => (
          <button
            key={i}
            onClick={() => open(i)}
            disabled={!active || c !== "hidden"}
            className="aspect-square rounded-xl text-xl flex items-center justify-center font-bold transition-all active:scale-95"
            style={{
              background: c === "gem" ? "rgba(0,224,164,0.2)" : c === "bomb" ? "rgba(255,84,112,0.22)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${c === "gem" ? "rgba(0,224,164,0.45)" : c === "bomb" ? "rgba(255,84,112,0.5)" : "rgba(255,255,255,0.08)"}`,
              cursor: active && c === "hidden" ? "pointer" : "default",
            }}
          >
            {c === "gem" ? "💎" : c === "bomb" ? "💣" : ""}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`gash-alert mb-3 ${msg.startsWith("✅") ? "gash-alert-success" : "gash-alert-danger"}`}>
          {msg}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { l: "Открыто", v: picks, c: "#00d2ff" },
          { l: "Множитель", v: `×${mult.toFixed(2)}`, c: "#a99bff" },
          { l: "Выплата", v: Math.round(Number(bet) * mult).toLocaleString("ru-RU"), c: "#00e0a4" },
        ].map((s) => (
          <div key={s.l} className="stat-tile"><div className="v" style={{ color: s.c }}>{s.v}</div><div className="l">{s.l}</div></div>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input type="number" value={bet} onChange={(e) => setBet(e.target.value)} disabled={active}
          className="gash-input !font-bold flex-1" />
        <select value={mines} onChange={(e) => setMines(Number(e.target.value))} disabled={active}
          className="gash-select !w-32">
          {[1, 3, 5, 10, 15, 24].map((m) => <option key={m} value={m}>{m} мин</option>)}
        </select>
      </div>

      {active ? (
        <button onClick={() => void cashout()} disabled={picks === 0}
          className="gash-btn gash-btn-success w-full !py-4">
          💰 Забрать {Math.round(Number(bet) * mult).toLocaleString("ru-RU")}
        </button>
      ) : (
        <button onClick={() => void start()} className="gash-btn w-full !py-4">💣 Начать игру</button>
      )}
    </div>
  );
}

/* ══════════════ COINFLIP ══════════════ */
export function CoinflipGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [side, setSide] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{ win: boolean; outcome: string; payout: number } | null>(null);
  const [error, setError] = useState("");

  const flip = async () => {
    const amount = Number(bet);
    if (amount > coins) { setError("Недостаточно монет"); return; }
    setError(""); setResult(null); setFlipping(true);

    const [{ ok, data }] = await Promise.all([
      play({ game: "coinflip", bet: amount, side }),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
    setFlipping(false);
    if (!ok) { setError(data.error); return; }

    setResult({ win: data.win, outcome: data.outcome, payout: data.payout });
    if (typeof data.coins === "number") onResult(data.coins, data.xp);
  };

  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center text-[56px] transition-transform duration-1000"
          style={{
            background: "linear-gradient(145deg, #ffd76e, #d99b28)",
            boxShadow: "0 12px 34px -12px rgba(255,197,66,0.8), inset 0 2px 8px rgba(255,255,255,0.4)",
            transform: flipping ? "rotateY(1800deg)" : "rotateY(0)",
          }}
        >
          {flipping ? "🪙" : result ? (result.outcome === "heads" ? "🦅" : "🔢") : side === "heads" ? "🦅" : "🔢"}
        </div>
      </div>

      {result && (
        <div className={`gash-alert mb-4 ${result.win ? "gash-alert-success" : "gash-alert-danger"}`}>
          {result.win ? `🎉 Победа! +${result.payout.toLocaleString("ru-RU")}` : "😔 Мимо"}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {([["heads", "🦅 Орёл"], ["tails", "🔢 Решка"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSide(k)} disabled={flipping}
            className={`py-4 rounded-xl font-bold text-[14px] border transition-all ${
              side === k ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white border-transparent tab-active-glow"
                : "bg-white/[0.04] text-[#8a8a99] border-white/[0.08]"
            }`}>{l}</button>
        ))}
      </div>

      <input type="number" value={bet} onChange={(e) => setBet(e.target.value)} disabled={flipping}
        className="gash-input !font-bold !text-[16px] mb-3" />
      <button onClick={() => void flip()} disabled={flipping} className="gash-btn w-full !py-4">
        {flipping ? "Монета в воздухе…" : "🪙 Бросить (×1.94)"}
      </button>
    </div>
  );
}

/* ══════════════ СЛОТЫ ══════════════ */
export function SlotsGame({ coins, onResult }: Props) {
  const SYM = ["🍒", "🍋", "🔔", "💎", "7️⃣", "⭐"];
  const [bet, setBet] = useState("100");
  const [reels, setReels] = useState(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ win: boolean; payout: number; mult: number } | null>(null);
  const [error, setError] = useState("");

  const spin = async () => {
    const amount = Number(bet);
    if (amount > coins) { setError("Недостаточно монет"); return; }
    setError(""); setResult(null); setSpinning(true);

    const iv = setInterval(() => {
      setReels([0, 1, 2].map(() => SYM[Math.floor(Math.random() * SYM.length)]));
    }, 80);

    const [{ ok, data }] = await Promise.all([
      play({ game: "slots", bet: amount }),
      new Promise((r) => setTimeout(r, 1400)),
    ]);
    clearInterval(iv);
    setSpinning(false);
    if (!ok) { setError(data.error); return; }

    setReels(data.reels || SYM.slice(0, 3));
    setResult({ win: data.win, payout: data.payout, mult: data.multiplier });
    if (typeof data.coins === "number") onResult(data.coins, data.xp);
  };

  return (
    <div className="text-center">
      <div className="flex justify-center gap-3 mb-6">
        {reels.map((s, i) => (
          <div key={i}
            className="w-24 h-28 rounded-2xl flex items-center justify-center text-[44px] border"
            style={{
              background: "linear-gradient(160deg, #23232e, #16161d)",
              borderColor: result?.win ? "rgba(0,224,164,0.5)" : "rgba(255,255,255,0.1)",
              boxShadow: result?.win ? "0 0 26px -8px rgba(0,224,164,0.7)" : "inset 0 2px 12px rgba(0,0,0,0.6)",
              transform: spinning ? "scale(0.96)" : "scale(1)",
              transition: "all 0.2s ease",
            }}>{s}</div>
        ))}
      </div>

      {result && (
        <div className={`gash-alert mb-4 ${result.win ? "gash-alert-success" : "gash-alert-danger"}`}>
          {result.win ? `🎰 ×${result.mult} → +${result.payout.toLocaleString("ru-RU")}` : "Не сложилось"}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      <input type="number" value={bet} onChange={(e) => setBet(e.target.value)} disabled={spinning}
        className="gash-input !font-bold !text-[16px] mb-3" />
      <button onClick={() => void spin()} disabled={spinning} className="gash-btn w-full !py-4">
        {spinning ? "Крутим…" : "🎰 Крутить"}
      </button>
      <p className="text-[11.5px] text-[#6a6a7a] mt-3">
        Три одинаковых — до ×50 · две — ×1.75
      </p>
    </div>
  );
}

/* ══════════════ РУЛЕТКА ══════════════ */
export function RouletteGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [type, setType] = useState<"red" | "black" | "even" | "odd" | "green">("red");
  const [spinning, setSpinning] = useState(false);
  const [pocket, setPocket] = useState<number | null>(null);
  const [color, setColor] = useState("");
  const [result, setResult] = useState<{ win: boolean; payout: number } | null>(null);
  const [error, setError] = useState("");

  const spin = async () => {
    const amount = Number(bet);
    if (amount > coins) { setError("Недостаточно монет"); return; }
    setError(""); setResult(null); setSpinning(true);

    const iv = setInterval(() => setPocket(Math.floor(Math.random() * 37)), 70);
    const [{ ok, data }] = await Promise.all([
      play({ game: "roulette", bet: amount, betType: type }),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
    clearInterval(iv);
    setSpinning(false);
    if (!ok) { setError(data.error); return; }

    setPocket(data.pocket);
    setColor(data.color);
    setResult({ win: data.win, payout: data.payout });
    if (typeof data.coins === "number") onResult(data.coins, data.xp);
  };

  const bg = color === "red" ? "#d32f4f" : color === "green" ? "#00a870" : "#1f1f28";

  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <div className="w-32 h-32 rounded-full flex items-center justify-center text-[42px] font-extrabold text-white border-4"
          style={{
            background: spinning ? "#2a2a36" : bg,
            borderColor: "rgba(255,255,255,0.15)",
            boxShadow: "0 14px 36px -14px rgba(0,0,0,0.9)",
            transition: spinning ? "none" : "background 0.4s ease",
          }}>
          {pocket ?? "?"}
        </div>
      </div>

      {result && (
        <div className={`gash-alert mb-4 ${result.win ? "gash-alert-success" : "gash-alert-danger"}`}>
          {result.win ? `🎉 +${result.payout.toLocaleString("ru-RU")}` : "😔 Не выпало"}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {([
          ["red", "Красное", "×2"], ["black", "Чёрное", "×2"],
          ["even", "Чёт", "×2"], ["odd", "Нечет", "×2"], ["green", "Зеро", "×35"],
        ] as const).map(([k, l, m]) => (
          <button key={k} onClick={() => setType(k)} disabled={spinning}
            className={`py-2.5 rounded-xl text-[11.5px] font-bold border transition-all ${
              type === k ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white border-transparent"
                : "bg-white/[0.04] text-[#8a8a99] border-white/[0.08]"
            }`}>
            {l}<span className="block text-[9.5px] opacity-70">{m}</span>
          </button>
        ))}
      </div>

      <input type="number" value={bet} onChange={(e) => setBet(e.target.value)} disabled={spinning}
        className="gash-input !font-bold !text-[16px] mb-3" />
      <button onClick={() => void spin()} disabled={spinning} className="gash-btn w-full !py-4">
        {spinning ? "Колесо крутится…" : "🎡 Крутить рулетку"}
      </button>
    </div>
  );
}
