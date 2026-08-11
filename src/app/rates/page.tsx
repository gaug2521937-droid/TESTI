"use client";

import { useState, useEffect, useCallback } from "react";
import { CryptoChart, Sparkline, formatPrice, formatCompact } from "@/components/CryptoChart";
import { MarketSentiment } from "@/components/MarketSentiment";
import { CryptoGlobal } from "@/components/CryptoGlobal";
import { CryptoTop } from "@/components/CryptoTop";

interface Market {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spark: number[];
}

interface ChartData {
  symbol: string;
  name: string;
  icon: string;
  color: string;
  range: string;
  source: string;
  points: { t: number; p: number }[];
  stats: {
    first: number;
    last: number;
    min: number;
    max: number;
    changePct: number;
    changeAbs: number;
    price: number;
    change24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
  };
}

interface Rates {
  USD_RUB: number;
  EUR_RUB: number;
  BTC_USD: number;
  TON_USD: number;
  [k: string]: number;
}

const RANGES = [
  { key: "1d", label: "24Ч" },
  { key: "7d", label: "7Д" },
  { key: "30d", label: "30Д" },
  { key: "90d", label: "3М" },
  { key: "1y", label: "1Г" },
];

const CURRENCIES = [
  { code: "USD", name: "Доллар США", icon: "🇺🇸" },
  { code: "EUR", name: "Евро", icon: "🇪🇺" },
  { code: "RUB", name: "Рубль", icon: "🇷🇺" },
  { code: "BTC", name: "Bitcoin", icon: "₿" },
  { code: "TON", name: "Toncoin", icon: "💎" },
];

export default function RatesPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [selected, setSelected] = useState("BTC");
  const [range, setRange] = useState("7d");
  const [chart, setChart] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [source, setSource] = useState("");

  const [rates, setRates] = useState<Rates | null>(null);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("RUB");
  const [amount, setAmount] = useState("100");
  const [result, setResult] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  // Загрузка рынка
  const loadMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/crypto/markets");
      const data = await res.json();
      if (res.ok) {
        setMarkets(data.markets || []);
        setSource(data.source);
      }
    } catch {
      /* тихо */
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  // Загрузка графика
  const loadChart = useCallback(async (symbol: string, rangeKey: string) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/crypto/chart?symbol=${symbol}&range=${rangeKey}`);
      const data = await res.json();
      if (res.ok) setChart(data);
    } catch {
      /* тихо */
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Курсы фиата
  const loadRates = useCallback(async () => {
    try {
      const res = await fetch("/api/rates");
      const data = await res.json();
      if (res.ok) setRates(data.rates);
    } catch {
      /* тихо */
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
    void loadRates();
    const t = setInterval(() => void loadMarkets(), 10000);
    return () => clearInterval(t);
  }, [loadMarkets, loadRates]);

  useEffect(() => {
    void loadChart(selected, range);
  }, [selected, range, loadChart]);

  // Живой пересчёт при вводе — без нажатия кнопки
  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setResult(null); return; }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/rates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, amount: Number(amount) }),
          });
          const data = await res.json();
          if (res.ok) { setResult(data.result); setRate(data.rate); }
        } catch { /* тихо */ }
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [amount, from, to]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setConverting(true);
    setError("");
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка конвертации");
        return;
      }
      setResult(data.result);
      setRate(data.rate);
    } catch {
      setError("Ошибка при конвертации");
    } finally {
      setConverting(false);
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const stats = chart?.stats;
  const positive = (stats?.changePct ?? 0) >= 0;
  const activeCoin = markets.find((m) => m.symbol === selected);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      {/* Заголовок */}
      <div className="page-head animate-fade-in">
        <div className="status-pill ok">
          <span className="live-dot" />
          Курсы обновляются каждые 10 секунд
          {source === "offline" && <span className="text-[#ffc542]">· резервный режим</span>}
        </div>
        <h1>
          <span className="gradient-text">Крипта и курсы</span>
        </h1>
        <p className="text-[#9a9aa8] max-w-lg mx-auto">
          Живые графики криптовалют, курсы фиатных валют и мгновенный конвертер.
        </p>
      </div>

      <CryptoGlobal />

      <CryptoTop />

      <MarketSentiment />

      {/* Карточки рынка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {marketsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[118px]" />
            ))
          : markets.map((m, i) => {
              const up = m.change24h >= 0;
              const active = m.symbol === selected;
              return (
                <button
                  key={m.symbol}
                  onClick={() => setSelected(m.symbol)}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  className={`gash-card p-4 text-left animate-fade-in border transition-all ${
                    active
                      ? "!border-[#6c5ce7] !shadow-[0_0_36px_-12px_rgba(108,92,231,0.95)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                        style={{ background: `${m.color}22`, color: m.color }}
                      >
                        {m.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-extrabold text-[#e8e8f0] leading-none">
                          {m.symbol}
                        </div>
                        <div className="text-[10px] text-[#6a6a7a] truncate mt-0.5">{m.name}</div>
                      </div>
                    </div>
                    <Sparkline data={m.spark} positive={up} width={44} height={22} />
                  </div>
                  <div className="text-[15.5px] font-extrabold text-white tabular-nums">
                    ${formatPrice(m.price)}
                  </div>
                  <div
                    className={`text-[12px] font-bold tabular-nums mt-0.5 ${
                      up ? "text-[#00e0a4]" : "text-[#ff5470]"
                    }`}
                  >
                    {up ? "▲" : "▼"} {Math.abs(m.change24h).toFixed(2)}%
                  </div>
                </button>
              );
            })}
      </div>

      {/* Большой график */}
      <div className="gash-card gash-card-static p-5 md:p-7 mb-7 animate-rise">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-bold"
                style={{
                  background: `${chart?.color ?? "#6c5ce7"}22`,
                  color: chart?.color ?? "#6c5ce7",
                }}
              >
                {chart?.icon ?? "₿"}
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-white leading-tight">
                  {chart?.name ?? "Bitcoin"}{" "}
                  <span className="text-[#6a6a7a] font-bold">/ USDT</span>
                </h2>
                <p className="text-[11.5px] text-[#6a6a7a]">
                  Источник:{" "}
                  {chart?.source === "binance"
                    ? "Binance"
                    : chart?.source === "coingecko"
                    ? "CoinGecko"
                    : "резервные данные"}
                </p>
              </div>
            </div>
            <div className="flex items-end gap-3 mt-3">
              <span className="text-3xl md:text-4xl font-extrabold text-white tabular-nums">
                ${formatPrice(stats?.price ?? 0)}
              </span>
              <span
                className={`gash-badge ${
                  positive ? "gash-badge-success" : "gash-badge-danger"
                } !text-[12px] mb-1.5`}
              >
                {positive ? "▲" : "▼"} {Math.abs(stats?.changePct ?? 0).toFixed(2)}% за период
              </span>
            </div>
          </div>

          <div className="seg-group">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`seg-btn ${range === r.key ? "active" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* График */}
        <CryptoChart
          points={chart?.points ?? []}
          positive={positive}
          rangeKey={range}
          loading={chartLoading}
          height={320}
        />

        {/* Статистика периода */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/[0.06]">
          {[
            { label: "Максимум 24ч", value: `$${formatPrice(stats?.high24h ?? 0)}`, color: "#00e0a4" },
            { label: "Минимум 24ч", value: `$${formatPrice(stats?.low24h ?? 0)}`, color: "#ff5470" },
            {
              label: "Объём 24ч",
              value: stats?.volume24h ? `$${formatCompact(stats.volume24h)}` : "—",
              color: "#a99bff",
            },
            {
              label: "Изменение",
              value: `${(stats?.changeAbs ?? 0) >= 0 ? "+" : ""}$${formatPrice(Math.abs(stats?.changeAbs ?? 0))}`,
              color: positive ? "#00e0a4" : "#ff5470",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3.5">
              <div className="text-[10.5px] uppercase tracking-wider text-[#6a6a7a] font-bold mb-1.5">
                {s.label}
              </div>
              <div className="text-[15px] font-extrabold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {activeCoin && (
          <p className="text-[11.5px] text-[#5a5a6a] mt-4">
            Диапазон периода: ${formatPrice(stats?.min ?? 0)} — ${formatPrice(stats?.max ?? 0)} ·
            Обновление каждые 60 секунд
          </p>
        )}
      </div>

      {/* Фиат + конвертер */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.25fr] gap-5">
        {/* Фиат */}
        <div className="gash-card gash-card-static p-6 animate-fade-in">
          <h3 className="text-base font-extrabold text-[#e8e8f0] mb-5 flex items-center gap-2">
            💵 Фиатные курсы
          </h3>
          <div className="space-y-3">
            {[
              { label: "USD / RUB", icon: "🇺🇸", value: rates?.USD_RUB, suffix: "₽" },
              { label: "EUR / RUB", icon: "🇪🇺", value: rates?.EUR_RUB, suffix: "₽" },
              { label: "EUR / USD", icon: "💱", value: rates?.EUR_USD, suffix: "$" },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#6c5ce7]/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{r.icon}</span>
                  <span className="text-[13.5px] font-bold text-[#c8c8d8]">{r.label}</span>
                </div>
                {r.value ? (
                  <span className="text-[16px] font-extrabold text-white tabular-nums">
                    {r.value.toFixed(2)} {r.suffix}
                  </span>
                ) : (
                  <span className="skeleton h-4 w-16" />
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#5a5a6a] mt-4">
            Источник: ExchangeRate-API · кеш 5 минут
          </p>
        </div>

        {/* Конвертер */}
        <div className="gash-card gash-card-static gash-card-glow p-6 animate-fade-in">
          <h3 className="text-base font-extrabold text-[#e8e8f0] mb-5 flex items-center gap-2">
            🔄 Конвертер
          </h3>

          {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

          <form onSubmit={handleConvert}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-3 items-end mb-4">
              <div>
                <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                  Из
                </label>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="gash-select"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.icon} {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={swap}
                className="w-11 h-11 mx-auto rounded-xl bg-white/[0.05] border border-white/[0.1] text-[#a99bff] hover:bg-[#6c5ce7]/20 hover:border-[#6c5ce7] hover:rotate-180 transition-all duration-400 flex items-center justify-center flex-shrink-0"
                title="Поменять местами"
              >
                ⇄
              </button>

              <div>
                <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                  В
                </label>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="gash-select"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.icon} {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Сумма"
                min="0"
                step="any"
                className="gash-input flex-1"
              />
              <button type="submit" className="gash-btn">
                {converting ? "Считаем…" : "🔄 Обновить курс"}
              </button>
            </div>
          </form>

          {result !== null && (
            <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-[#6c5ce7]/18 to-[#6c5ce7]/4 border border-[#6c5ce7]/30 animate-bounce-in text-center">
              <p className="text-[12px] text-[#9a9aa8] mb-1.5">
                {Number(amount).toLocaleString("ru-RU")} {from} равно
              </p>
              <p className="text-3xl font-extrabold gradient-text-purple tabular-nums">
                {formatPrice(result)} {to}
              </p>
              {rate !== null && (
                <p className="text-[11.5px] text-[#6a6a7a] mt-2">
                  1 {from} = {formatPrice(rate)} {to}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
