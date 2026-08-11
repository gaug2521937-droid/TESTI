"use client";

import { useState } from "react";

interface Props {
  coins: number;
  onResult: (coins: number, xp?: unknown) => void;
}

interface Card {
  code: string;
  value: string;
  suit: string;
  image: string;
}

interface Table {
  state: "playing" | "finished";
  player: Card[];
  dealer: Card[];
  playerTotal: number;
  dealerTotal: number;
  outcome?: string;
  message?: string;
  canDouble?: boolean;
  payout?: number;
}

/** Блэкджек на настоящей колоде из deckofcardsapi */
export function BlackjackGame({ coins, onResult }: Props) {
  const [bet, setBet] = useState("100");
  const [table, setTable] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/casino/blackjack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка");
        return;
      }
      setTable(d);
      if (typeof d.coins === "number") onResult(d.coins, d.xp);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };

  const deal = () => {
    const amount = Number(bet);
    if (!amount || amount <= 0) return;
    if (amount > coins) {
      setError("Недостаточно монет");
      return;
    }
    void call("deal", { bet: amount });
  };

  const finished = table?.state === "finished";
  const won = finished && ["win", "blackjack", "dealer_bust"].includes(table?.outcome ?? "");
  const push = table?.outcome === "push";

  const CardRow = ({ cards, hidden }: { cards: Card[]; hidden?: boolean }) => (
    <div className="flex gap-1.5 flex-wrap justify-center min-h-[92px] items-center">
      {cards.map((c, i) => (
        <img
          key={`${c.code}-${i}`}
          src={c.image}
          alt={c.code}
          className="w-[62px] rounded-lg animate-pop"
          style={{ animationDelay: `${i * 0.08}s`, boxShadow: "0 8px 20px -8px rgba(0,0,0,0.9)" }}
        />
      ))}
      {hidden && (
        <div
          className="w-[62px] h-[88px] rounded-lg flex items-center justify-center text-2xl"
          style={{
            background: "linear-gradient(150deg, #2a2a3a, #16161f)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          🂠
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Стол */}
      <div
        className="rounded-2xl border p-5 mb-4 transition-colors duration-300"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(52,229,160,0.08), transparent 62%), #0f0f16",
          borderColor: finished
            ? won
              ? "rgba(52,229,160,0.45)"
              : push
              ? "rgba(255,179,64,0.4)"
              : "rgba(255,77,109,0.42)"
            : "rgba(255,255,255,0.08)",
        }}
      >
        {/* Дилер */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-extrabold text-[#5a5a70]">
              Дилер
            </span>
            {table && (
              <span className="gash-badge gash-badge-neutral !text-[11px] tabular-nums">
                {table.state === "playing" ? `${table.dealerTotal}+` : table.dealerTotal}
              </span>
            )}
          </div>
          {table ? (
            <CardRow cards={table.dealer} hidden={table.state === "playing"} />
          ) : (
            <div className="min-h-[92px] flex items-center justify-center text-[13px] text-[#4a4a5e]">
              Ожидание раздачи
            </div>
          )}
        </div>

        <div className="divider-accent mb-5" />

        {/* Игрок */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-extrabold text-[#5a5a70]">
              Ваша рука
            </span>
            {table && (
              <span
                className="gash-badge !text-[11px] tabular-nums"
                style={{
                  background: table.playerTotal > 21 ? "rgba(255,77,109,0.15)" : "rgba(124,92,255,0.15)",
                  color: table.playerTotal > 21 ? "#ff4d6d" : "#a68fff",
                  borderColor: table.playerTotal > 21 ? "rgba(255,77,109,0.35)" : "rgba(124,92,255,0.35)",
                }}
              >
                {table.playerTotal}
              </span>
            )}
          </div>
          {table ? (
            <CardRow cards={table.player} />
          ) : (
            <div className="min-h-[92px] flex items-center justify-center text-[13px] text-[#4a4a5e]">
              Сделайте ставку
            </div>
          )}
        </div>

        {/* Итог */}
        {finished && table?.message && (
          <p
            className="text-center text-[15px] font-extrabold mt-5 animate-pop"
            style={{ color: won ? "#34e5a0" : push ? "#ffb340" : "#ff4d6d" }}
          >
            {won ? "🎉 " : push ? "🤝 " : "😔 "}
            {table.message}
            {won && table.payout ? ` · +${table.payout.toLocaleString("ru-RU")}` : ""}
          </p>
        )}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Управление */}
      {table?.state === "playing" ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => void call("hit")} disabled={busy} className="gash-btn !py-4">
            🃏 Ещё
          </button>
          <button onClick={() => void call("stand")} disabled={busy} className="gash-btn gash-btn-success !py-4">
            ✋ Хватит
          </button>
          <button
            onClick={() => void call("double")}
            disabled={busy || !table.canDouble || Number(bet) * 2 > coins}
            className="gash-btn-outline !py-4"
          >
            ×2 Удвоить
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              disabled={busy}
              className="gash-input !text-[16px] !font-bold flex-1"
            />
            <button onClick={() => setBet(String(Math.max(1, Math.floor(Number(bet) / 2))))} className="gash-btn-ghost !px-3">½</button>
            <button onClick={() => setBet(String(Math.floor(Number(bet) * 2)))} className="gash-btn-ghost !px-3">2×</button>
          </div>
          <button onClick={deal} disabled={busy || Number(bet) <= 0} className="gash-btn w-full !py-4 !text-base">
            {busy ? "Раздаём…" : table ? "🃏 Новая партия" : "🃏 Раздать карты"}
          </button>
        </>
      )}

      <p className="text-[11.5px] text-[#5a5a70] mt-3.5 text-center leading-relaxed">
        Настоящая колода из 6 наборов через deckofcardsapi. Блэкджек платит ×2.5,
        обычная победа ×2, дилер добирает до 17.
      </p>
    </div>
  );
}
