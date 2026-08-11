"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CryptoChart, Sparkline, formatPrice } from "./CryptoChart";

interface Market {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  price: number;
  change24h: number;
  spark: number[];
}

export function HomeCryptoWidget() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [points, setPoints] = useState<{ t: number; p: number }[]>([]);
  const [changePct, setChangePct] = useState(0);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch("/api/crypto/markets"),
          fetch("/api/crypto/chart?symbol=BTC&range=7d"),
        ]);
        const mData = await mRes.json();
        const cData = await cRes.json();
        if (!alive) return;
        if (mRes.ok) setMarkets((mData.markets || []).slice(0, 6));
        if (cRes.ok) {
          setPoints(cData.points || []);
          setChangePct(cData.stats?.changePct ?? 0);
          setPrice(cData.stats?.price ?? 0);
        }
      } catch {
        /* тихо */
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const positive = changePct >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-5">
      {/* График BTC */}
      <div className="gash-card gash-card-static p-5 md:p-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-9 h-9 rounded-xl bg-[#f7931a]/15 text-[#f7931a] flex items-center justify-center text-base font-bold">
                ₿
              </span>
              <div>
                <h3 className="text-[15px] font-extrabold text-white leading-tight">
                  Bitcoin <span className="text-[#6a6a7a]">/ USDT</span>
                </h3>
                <p className="text-[11px] text-[#6a6a7a]">Динамика за 7 дней</p>
              </div>
            </div>
            <div className="flex items-end gap-2.5 mt-2.5">
              <span className="text-2xl font-extrabold text-white tabular-nums">
                {loading ? <span className="skeleton inline-block h-7 w-28" /> : `$${formatPrice(price)}`}
              </span>
              {!loading && (
                <span
                  className={`gash-badge ${positive ? "gash-badge-success" : "gash-badge-danger"} mb-1`}
                >
                  {positive ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <Link href="/rates" className="gash-btn-outline !text-[12.5px] !py-2 !px-4 no-underline">
            Все графики →
          </Link>
        </div>

        <CryptoChart points={points} positive={positive} rangeKey="7d" loading={loading} height={210} />
      </div>

      {/* Список монет */}
      <div className="gash-card gash-card-static p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-white">Рынок сейчас</h3>
          <span className="flex items-center gap-1.5 text-[11px] text-[#00e0a4] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e0a4] animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="space-y-1.5">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-11" />)
            : markets.map((m) => {
                const up = m.change24h >= 0;
                return (
                  <Link
                    key={m.symbol}
                    href="/rates"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.05] transition-colors no-underline group"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                      style={{ background: `${m.color}20`, color: m.color }}
                    >
                      {m.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#e8e8f0] leading-tight">
                        {m.symbol}
                      </div>
                      <div className="text-[10.5px] text-[#6a6a7a] truncate">{m.name}</div>
                    </div>
                    <Sparkline data={m.spark} positive={up} width={48} height={22} />
                    <div className="text-right flex-shrink-0 w-[86px]">
                      <div className="text-[13px] font-extrabold text-white tabular-nums leading-tight">
                        ${formatPrice(m.price)}
                      </div>
                      <div
                        className={`text-[11px] font-bold tabular-nums ${
                          up ? "text-[#00e0a4]" : "text-[#ff5470]"
                        }`}
                      >
                        {up ? "+" : ""}
                        {m.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </div>
  );
}
