"use client";

import { useEffect, useState } from "react";
import { Sparkline, formatPrice, formatCompact } from "./CryptoChart";

interface TopCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume: number;
  rank: number;
  ath: number;
  athChange: number;
  sparkline: number[];
}

interface Exchange {
  id: string;
  name: string;
  image: string;
  trustRank: number;
  volumeBtc: number;
  country: string;
  year: number | null;
}

interface Difficulty {
  progress: number;
  remainingBlocks: number;
  estimatedChange: number;
  daysLeft: number;
}

/** Топ-20 монет, лидеры движения, биржи и сложность сети */
export function CryptoTop() {
  const [coins, setCoins] = useState<TopCoin[]>([]);
  const [gainers, setGainers] = useState<TopCoin[]>([]);
  const [losers, setLosers] = useState<TopCoin[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [diff, setDiff] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"top" | "movers" | "exchanges">("top");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crypto/extra");
        const d = await r.json();
        if (!alive) return;
        setCoins(d.coins || []);
        setGainers(d.gainers || []);
        setLosers(d.losers || []);
        setExchanges(d.exchanges || []);
        setDiff(d.difficulty);
      } catch {
        /* тихо */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 90000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (loading) return <div className="skeleton h-[420px] mb-5" />;

  return (
    <div className="gash-card gash-card-static overflow-hidden mb-5">
      {/* Вкладки */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06] flex-wrap">
        <div className="seg-group">
          {([
            { k: "top", l: "Топ-20" },
            { k: "movers", l: "Движение" },
            { k: "exchanges", l: "Биржи" },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`seg-btn ${tab === t.k ? "active" : ""}`}>
              {t.l}
            </button>
          ))}
        </div>

        {diff && (
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#5a5a70]">
              Сложность BTC
            </span>
            <div className="w-20 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ffb340] to-[#f043a0]"
                style={{ width: `${diff.progress}%` }}
              />
            </div>
            <span
              className="text-[11.5px] font-extrabold tabular-nums"
              style={{ color: diff.estimatedChange >= 0 ? "#34e5a0" : "#ff4d6d" }}
            >
              {diff.estimatedChange >= 0 ? "+" : ""}{diff.estimatedChange.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* ТОП-20 */}
        {tab === "top" && (
          <div className="space-y-1">
            {coins.map((c) => {
              const up24 = c.change24h >= 0;
              const up7 = c.change7d >= 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-[11px] font-black text-[#4a4a5e] w-6 tabular-nums">{c.rank}</span>
                  <img src={c.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0" loading="lazy" />

                  <div className="min-w-0 w-[92px] sm:w-[130px]">
                    <p className="text-[13px] font-extrabold text-[#e4e4ee] leading-tight">{c.symbol}</p>
                    <p className="text-[10.5px] text-[#5a5a70] truncate">{c.name}</p>
                  </div>

                  <div className="hidden md:block flex-shrink-0">
                    <Sparkline data={c.sparkline} positive={up7} width={72} height={26} />
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-[13.5px] font-extrabold text-white tabular-nums leading-tight">
                      ${formatPrice(c.price)}
                    </p>
                    <p className="text-[10.5px] text-[#5a5a70] tabular-nums hidden sm:block">
                      cap ${formatCompact(c.marketCap)}
                    </p>
                  </div>

                  <div className="w-[62px] text-right flex-shrink-0">
                    <p className="text-[12px] font-extrabold tabular-nums" style={{ color: up24 ? "#34e5a0" : "#ff4d6d" }}>
                      {up24 ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(1)}%
                    </p>
                    <p className="text-[10px] font-bold tabular-nums hidden sm:block" style={{ color: up7 ? "#34e5a0aa" : "#ff4d6daa" }}>
                      7д {up7 ? "+" : ""}{c.change7d.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ЛИДЕРЫ ДВИЖЕНИЯ */}
        {tab === "movers" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "📈 Растут сильнее всех", list: gainers, col: "#34e5a0" },
              { title: "📉 Падают сильнее всех", list: losers, col: "#ff4d6d" },
            ].map((g) => (
              <div key={g.title}>
                <p className="section-title">{g.title}</p>
                <div className="space-y-1.5">
                  {g.list.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border"
                      style={{ background: `${g.col}0d`, borderColor: `${g.col}26` }}
                    >
                      <img src={c.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-extrabold text-[#e4e4ee] leading-tight">{c.symbol}</p>
                        <p className="text-[10px] text-[#5a5a70] truncate">{c.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[12.5px] font-extrabold text-white tabular-nums">${formatPrice(c.price)}</p>
                        <p className="text-[11px] font-extrabold tabular-nums" style={{ color: g.col }}>
                          {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* БИРЖИ */}
        {tab === "exchanges" && (
          <div className="space-y-1">
            {exchanges.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors">
                <span className="text-[11px] font-black text-[#4a4a5e] w-5 tabular-nums">{e.trustRank}</span>
                <img src={e.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-[#e4e4ee] leading-tight">{e.name}</p>
                  <p className="text-[10.5px] text-[#5a5a70]">
                    {e.country}{e.year ? ` · с ${e.year}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12.5px] font-extrabold text-[#ffb340] tabular-nums">
                    {formatCompact(e.volumeBtc)} BTC
                  </p>
                  <p className="text-[10px] text-[#5a5a70]">объём 24ч</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
