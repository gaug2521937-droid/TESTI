"use client";

import { useEffect, useState } from "react";

interface GlobalData {
  marketCap: number;
  volume24h: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChange: number;
  activeCoins: number;
  markets: number;
}

interface TrendCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  rank: number;
  price: number | null;
}

interface Network {
  hashRate: number;
  difficulty: number;
  blocks24h: number;
  txCount24h: number;
  minutesBetweenBlocks: number;
  totalBtc: number;
}

interface Fees {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
}

function big(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + " трлн";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + " млрд";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + " млн";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + " тыс";
  return v.toFixed(0);
}

/** Обзор всего крипторынка: капитализация, тренды, сеть Bitcoin, комиссии */
export function CryptoGlobal() {
  const [g, setG] = useState<GlobalData | null>(null);
  const [trend, setTrend] = useState<TrendCoin[]>([]);
  const [net, setNet] = useState<Network | null>(null);
  const [fees, setFees] = useState<Fees | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crypto/global");
        const d = await r.json();
        if (!alive) return;
        setG(d.global);
        setTrend(d.trending || []);
        setNet(d.network);
        setFees(d.fees);
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

  if (loading) {
    return (
      <div className="space-y-4 mb-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[96px]" />)}
        </div>
        <div className="skeleton h-[180px]" />
      </div>
    );
  }

  const up = (g?.marketCapChange ?? 0) >= 0;

  return (
    <div className="space-y-4 mb-5">
      {/* Основные цифры рынка */}
      {g && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              l: "Капитализация",
              v: `$${big(g.marketCap)}`,
              sub: `${up ? "▲" : "▼"} ${Math.abs(g.marketCapChange).toFixed(2)}% за сутки`,
              c: up ? "#34e5a0" : "#ff4d6d",
              icon: "🌍",
            },
            { l: "Объём 24ч", v: `$${big(g.volume24h)}`, sub: `${g.markets.toLocaleString("ru-RU")} рынков`, c: "#22d3ee", icon: "💵" },
            { l: "Доминация BTC", v: `${g.btcDominance.toFixed(1)}%`, sub: `ETH ${g.ethDominance.toFixed(1)}%`, c: "#ffb340", icon: "₿" },
            { l: "Всего монет", v: g.activeCoins.toLocaleString("ru-RU"), sub: "активных активов", c: "#a68fff", icon: "🪙" },
          ].map((s, i) => (
            <div key={s.l} className="gash-card p-4 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px]">{s.icon}</span>
                <span className="text-[10px] uppercase tracking-[0.13em] font-extrabold text-[#5a5a70]">{s.l}</span>
              </div>
              <div className="text-[20px] font-black tabular-nums leading-none" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[11px] text-[#6a6a80] mt-1.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-4">
        {/* Что в тренде */}
        <div className="gash-card gash-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-extrabold text-[#f2f2f7]">🔥 В тренде поиска</h3>
            <span className="gash-badge gash-badge-neutral !text-[9.5px]">CoinGecko</span>
          </div>
          {trend.length === 0 ? (
            <p className="text-[12.5px] text-[#5a5a70] text-center py-6">Данные недоступны</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {trend.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#7c5cff]/35 transition-colors"
                >
                  <span className="text-[10px] font-black text-[#4a4a5e] w-4">{i + 1}</span>
                  {c.thumb ? (
                    <img src={c.thumb} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-white/[0.07] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold text-[#e4e4ee] truncate leading-tight">{c.symbol}</p>
                    <p className="text-[10px] text-[#5a5a70] truncate">{c.name}</p>
                  </div>
                  {c.rank > 0 && (
                    <span className="text-[9.5px] font-bold text-[#5a5a70] flex-shrink-0">#{c.rank}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Сеть Bitcoin */}
        <div className="gash-card gash-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-extrabold text-[#f2f2f7]">⛓ Сеть Bitcoin</h3>
            <span className="gash-badge gash-badge-neutral !text-[9.5px]">blockchain.info</span>
          </div>

          {net ? (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { l: "Хешрейт", v: `${(net.hashRate / 1e9).toFixed(0)} EH/s`, c: "#ffb340" },
                { l: "Блоков за сутки", v: net.blocks24h.toString(), c: "#a68fff" },
                { l: "Транзакций", v: big(net.txCount24h), c: "#22d3ee" },
                { l: "Блок каждые", v: `${net.minutesBetweenBlocks.toFixed(1)} мин`, c: "#34e5a0" },
              ].map((x) => (
                <div key={x.l} className="stat-tile !p-2.5">
                  <div className="v !text-[13.5px]" style={{ color: x.c }}>{x.v}</div>
                  <div className="l !text-[9px]">{x.l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-[#5a5a70] text-center py-4">Данные сети недоступны</p>
          )}

          {/* Комиссии */}
          {fees && (
            <>
              <p className="section-title !mb-2">Комиссия сети · sat/vB</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { l: "Срочно", v: fees.fastest, c: "#ff4d6d" },
                  { l: "30 мин", v: fees.halfHour, c: "#ffb340" },
                  { l: "1 час", v: fees.hour, c: "#22d3ee" },
                  { l: "Дёшево", v: fees.economy, c: "#34e5a0" },
                ].map((f) => (
                  <div key={f.l} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2 text-center">
                    <div className="text-[14px] font-black tabular-nums" style={{ color: f.c }}>{f.v}</div>
                    <div className="text-[8.5px] uppercase font-bold text-[#5a5a70] mt-0.5">{f.l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
