"use client";

import { useState } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

type Diff = "easy" | "medium" | "hard";

const DIFFS: Record<Diff, { label: string; perRow: number; desc: string; color: string }> = {
  easy: { label: "Лёгкий", perRow: 4, desc: "1 ловушка из 4", color: "#00e0a4" },
  medium: { label: "Средний", perRow: 3, desc: "1 ловушка из 3", color: "#ffc542" },
  hard: { label: "Сложный", perRow: 2, desc: "1 ловушка из 2", color: "#ff5470" },
};

const FLOORS = 8;

/**
 * Tower — поднимаемся по этажам башни.
 * На каждом этаже одна клетка с ловушкой: угадал — идёшь выше,
 * попал — всё сгорает. Можно забрать выигрыш в любой момент.
 */
export function TowerGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [diff, setDiff] = useState<Diff>("medium");
  const [active, setActive] = useState(false);
  const [floor, setFloor] = useState(0);
  const [traps, setTraps] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [dead, setDead] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const perRow = DIFFS[diff].perRow;
  const safe = perRow - 1;

  /** Множитель за пройденные этажи */
  const multAt = (n: number) => (n === 0 ? 1 : Math.pow(perRow / safe, n) * 0.97);

  const start = async () => {
    const amount = Number(bet);
    if (amount > coins) {
      setError("Недостаточно монет");
      return;
    }
    setError("");
    setMsg("");

    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "tower",
          bet: amount,
          difficulty: diff,
          floors: 1,
          clientSeed: String(Date.now()),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка");
        return;
      }

      setTraps(d.trap || []);
      setPicked([]);
      setFloor(0);
      setDead(false);
      setActive(true);
      if (typeof d.coins === "number") onResult(d.coins, d.xp);
    } catch {
      setError("Нет связи");
    }
  };

  const pick = (cell: number) => {
    if (!active || dead) return;

    const trap = traps[floor];
    const next = [...picked, cell];
    setPicked(next);

    if (cell === trap) {
      setDead(true);
      setActive(false);
      setMsg(`💥 Ловушка на ${floor + 1} этаже! Ставка сгорела`);
      return;
    }

    const nf = floor + 1;
    setFloor(nf);

    if (nf >= FLOORS) {
      setActive(false);
      const win = Math.round(Number(bet) * multAt(FLOORS));
      setMsg(`🏆 Вершина взята! +${win.toLocaleString("ru-RU")}`);
      void cashout(FLOORS);
    }
  };

  const cashout = async (atFloor?: number) => {
    const f = atFloor ?? floor;
    if (f === 0) return;
    const amount = Number(bet);
    const win = Math.round(amount * multAt(f));

    if (!atFloor) {
      setActive(false);
      setMsg(`✅ Забрано ${win.toLocaleString("ru-RU")} монет`);
    }

    try {
      const r = await fetch("/api/casino/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "tower",
          bet: amount,
          difficulty: diff,
          floors: f,
          clientSeed: String(Date.now()),
        }),
      });
      const d = await r.json();
      if (typeof d.coins === "number") onResult(d.coins + win, d.xp);
    } catch {
      /* тихо */
    }
  };

  return (
    <div>
      {/* Башня сверху вниз */}
      <div className="space-y-1.5 mb-4">
        {Array.from({ length: FLOORS }).map((_, idx) => {
          const f = FLOORS - 1 - idx; // рисуем сверху
          const isCurrent = active && f === floor;
          const isPassed = f < floor;
          const isFuture = f > floor;
          const chosen = picked[f];

          return (
            <div key={f} className="flex items-center gap-2">
              <span
                className="w-8 text-[11px] font-extrabold tabular-nums text-right flex-shrink-0"
                style={{ color: isPassed ? "#00e0a4" : isCurrent ? "#ffc542" : "#5a5a6a" }}
              >
                {f + 1}
              </span>

              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${perRow}, 1fr)` }}>
                {Array.from({ length: perRow }).map((__, c) => {
                  const isTrap = (dead || isPassed) && traps[f] === c;
                  const isChosen = chosen === c;
                  const revealed = dead || isPassed;

                  let bg = "rgba(255,255,255,0.04)";
                  let border = "rgba(255,255,255,0.07)";
                  let content = "";

                  if (revealed && isTrap) {
                    bg = "rgba(255,84,112,0.22)";
                    border = "rgba(255,84,112,0.5)";
                    content = "💥";
                  } else if (isChosen && isPassed) {
                    bg = "rgba(0,224,164,0.2)";
                    border = "rgba(0,224,164,0.45)";
                    content = "💎";
                  } else if (isCurrent) {
                    bg = "rgba(255,197,66,0.1)";
                    border = "rgba(255,197,66,0.35)";
                  }

                  return (
                    <button
                      key={c}
                      onClick={() => isCurrent && pick(c)}
                      disabled={!isCurrent}
                      className="h-9 rounded-lg text-[15px] flex items-center justify-center transition-all active:scale-95"
                      style={{
                        background: bg,
                        border: `1px solid ${border}`,
                        cursor: isCurrent ? "pointer" : "default",
                        opacity: isFuture && !dead ? 0.35 : 1,
                      }}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>

              <span
                className="w-14 text-[11px] font-bold tabular-nums text-right flex-shrink-0"
                style={{ color: isPassed ? "#00e0a4" : "#5a5a6a" }}
              >
                ×{multAt(f + 1).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {msg && (
        <div className={`gash-alert mb-3 ${msg.startsWith("💥") ? "gash-alert-danger" : "gash-alert-success"}`}>
          {msg}
        </div>
      )}
      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Показатели */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { l: "Этаж", v: `${floor}/${FLOORS}`, c: "#00d2ff" },
          { l: "Множитель", v: `×${multAt(floor).toFixed(2)}`, c: "#a99bff" },
          { l: "Выплата", v: Math.round(Number(bet) * multAt(floor)).toLocaleString("ru-RU"), c: "#00e0a4" },
        ].map((s) => (
          <div key={s.l} className="stat-tile">
            <div className="v" style={{ color: s.c }}>{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Сложность */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {(Object.keys(DIFFS) as Diff[]).map((k) => (
          <button
            key={k}
            onClick={() => setDiff(k)}
            disabled={active}
            className={`py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
              diff === k ? "text-white border-transparent" : "bg-white/[0.04] text-[#8a8a99] border-white/[0.08]"
            }`}
            style={diff === k ? { background: `linear-gradient(135deg, ${DIFFS[k].color}, ${DIFFS[k].color}aa)` } : {}}
          >
            {DIFFS[k].label}
            <span className="block text-[9.5px] opacity-75 font-semibold">{DIFFS[k].desc}</span>
          </button>
        ))}
      </div>

      <input
        type="number"
        value={bet}
        onChange={(e) => setBet(e.target.value)}
        disabled={active}
        className="gash-input !text-[16px] !font-bold mb-3"
      />

      {active ? (
        <button
          onClick={() => void cashout()}
          disabled={floor === 0}
          className="gash-btn gash-btn-success w-full !py-4"
        >
          💰 Забрать {Math.round(Number(bet) * multAt(floor)).toLocaleString("ru-RU")}
        </button>
      ) : (
        <button onClick={() => void start()} className="gash-btn w-full !py-4">
          🏗 Начать восхождение
        </button>
      )}
    </div>
  );
}
