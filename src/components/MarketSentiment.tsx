"use client";

import { useEffect, useState } from "react";

interface Fng {
  value: number;
  label: string;
  color: string;
  emoji: string;
  yesterday: number;
  weekAgo: number;
  monthAgo: number;
  history: { v: number; t: number }[];
}

interface CbrRate {
  code: string;
  name: string;
  value: number;
  previous: number;
  diff: number;
  diffPct: number;
}

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", CNY: "🇨🇳", GBP: "🇬🇧",
  JPY: "🇯🇵", TRY: "🇹🇷", KZT: "🇰🇿", BYN: "🇧🇾",
};

/** Индекс страха и жадности + официальные курсы ЦБ РФ */
export function MarketSentiment() {
  const [fng, setFng] = useState<Fng | null>(null);
  const [cbr, setCbr] = useState<{ date: string | null; rates: CbrRate[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/crypto/sentiment");
        const d = await r.json();
        if (!alive) return;
        setFng(d.fearGreed);
        setCbr(d.cbr);
      } catch {
        /* тихо */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 120000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-4 mb-5">
        <div className="skeleton h-[250px]" />
        <div className="skeleton h-[250px]" />
      </div>
    );
  }

  // Дуга спидометра: 180° слева направо
  const angle = fng ? -90 + (fng.value / 100) * 180 : -90;
  const R = 78;
  const cx = 100;
  const cy = 96;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-4 mb-5">
      {/* Индекс страха и жадности */}
      <div className="gash-card gash-card-static p-5">
        <h3 className="text-[14px] font-extrabold text-[#e8e8f0] mb-1">
          😰 Индекс страха и жадности
        </h3>
        <p className="text-[11.5px] text-[#6a6a7a] mb-2">Настроение крипторынка сегодня</p>

        {fng ? (
          <>
            <div className="relative flex justify-center">
              <svg width="200" height="120" viewBox="0 0 200 120">
                <defs>
                  <linearGradient id="fngGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ff5470" />
                    <stop offset="30%" stopColor="#ff8a5c" />
                    <stop offset="50%" stopColor="#ffc542" />
                    <stop offset="72%" stopColor="#8ede5c" />
                    <stop offset="100%" stopColor="#00e0a4" />
                  </linearGradient>
                </defs>

                {/* Дуга */}
                <path
                  d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
                  fill="none"
                  stroke="url(#fngGrad)"
                  strokeWidth="13"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                {/* Деления */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const a = (-90 + (v / 100) * 180) * (Math.PI / 180);
                  const x1 = cx + Math.sin(a) * (R - 11);
                  const y1 = cy - Math.cos(a) * (R - 11);
                  const x2 = cx + Math.sin(a) * (R + 11);
                  const y2 = cy - Math.cos(a) * (R + 11);
                  return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />;
                })}

                {/* Стрелка */}
                <g
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: "transform 1.1s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  <line x1={cx} y1={cy} x2={cx} y2={cy - R + 16} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <circle cx={cx} cy={cy - R + 16} r="4" fill="#fff" />
                </g>
                <circle cx={cx} cy={cy} r="8" fill="#1a1a22" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
              </svg>

              <div className="absolute bottom-0 left-0 right-0 text-center">
                <div className="text-[34px] font-extrabold tabular-nums leading-none" style={{ color: fng.color }}>
                  {fng.value}
                </div>
              </div>
            </div>

            <div className="text-center mt-2 mb-4">
              <span
                className="gash-badge !text-[12px] !px-3.5 !py-1.5"
                style={{ background: `${fng.color}18`, color: fng.color, borderColor: `${fng.color}40` }}
              >
                {fng.emoji} {fng.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "Вчера", v: fng.yesterday },
                { l: "Неделю", v: fng.weekAgo },
                { l: "Месяц", v: fng.monthAgo },
              ].map((x) => (
                <div key={x.l} className="stat-tile !p-2.5">
                  <div className="v !text-[15px]" style={{ color: "#a8a8b8" }}>{x.v}</div>
                  <div className="l">{x.l}</div>
                </div>
              ))}
            </div>

            <p className="text-[10.5px] text-[#5a5a6a] mt-3 leading-relaxed">
              Ниже 25 — паника, часто удачное время для покупки. Выше 75 — эйфория, рынок перегрет.
            </p>
          </>
        ) : (
          <div className="empty-state !py-10">
            <div className="icon">📊</div>
            <p className="hint">Индекс временно недоступен</p>
          </div>
        )}
      </div>

      {/* Курсы ЦБ РФ */}
      <div className="gash-card gash-card-static p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-[14px] font-extrabold text-[#e8e8f0]">🏛 Официальный курс ЦБ РФ</h3>
            <p className="text-[11.5px] text-[#6a6a7a]">
              {cbr?.date ? new Date(cbr.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
          <span className="gash-badge gash-badge-info !text-[10px]">cbr.ru</span>
        </div>

        {cbr && cbr.rates.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {cbr.rates.map((r) => {
              const up = r.diff >= 0;
              return (
                <div key={r.code} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#6c5ce7]/35 transition-colors">
                  <span className="text-lg flex-shrink-0">{FLAGS[r.code] ?? "💱"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-extrabold text-[#e8e8f0]">{r.code}</p>
                    <p className="text-[10px] text-[#6a6a7a] truncate">{r.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[14px] font-extrabold text-white tabular-nums">
                      {r.value.toFixed(2)}
                    </p>
                    <p className="text-[10.5px] font-bold tabular-nums" style={{ color: up ? "#00e0a4" : "#ff5470" }}>
                      {up ? "▲" : "▼"} {Math.abs(r.diffPct).toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state !py-10">
            <div className="icon">🏛</div>
            <p className="hint">Курсы ЦБ временно недоступны</p>
          </div>
        )}
      </div>
    </div>
  );
}
