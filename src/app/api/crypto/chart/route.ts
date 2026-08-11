import { NextRequest, NextResponse } from "next/server";
import { getCoin, getRange, syntheticSeries, type PricePoint } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Кеш графиков в памяти: ключ = "BTC:7d"
// Кеш отключён — свежие данные при каждом запросе

// --- Источник 1: Binance (публичный, без ключа) ---
async function fromBinance(binanceSymbol: string, interval: string, limit: number) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("binance klines failed");

  const raw = (await res.json()) as unknown[][];
  const points: PricePoint[] = raw.map((k) => ({
    t: Number(k[0]),
    p: parseFloat(String(k[4])),
  }));
  if (points.length === 0) throw new Error("binance empty");
  return points;
}

async function binanceTicker(binanceSymbol: string) {
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error("binance ticker failed");
  const d = await res.json();
  return {
    price: parseFloat(d.lastPrice),
    change24h: parseFloat(d.priceChangePercent),
    high24h: parseFloat(d.highPrice),
    low24h: parseFloat(d.lowPrice),
    volume24h: parseFloat(d.quoteVolume),
  };
}

// Тикер CoinGecko (когда Binance недоступен)
async function coingeckoTicker(id: string) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}&price_change_percentage=24h`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error("coingecko ticker failed");
  const list = await res.json();
  const d = Array.isArray(list) ? list[0] : null;
  if (!d) throw new Error("coingecko ticker empty");
  return {
    price: Number(d.current_price) || 0,
    change24h: Number(d.price_change_percentage_24h) || 0,
    high24h: Number(d.high_24h) || 0,
    low24h: Number(d.low_24h) || 0,
    volume24h: Number(d.total_volume) || 0,
  };
}

// --- Источник 2: CoinGecko (резерв) ---
async function fromCoinGecko(id: string, days: number) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error("coingecko failed");
  const d = await res.json();
  const prices = (d.prices || []) as [number, number][];
  if (prices.length === 0) throw new Error("coingecko empty");
  return prices.map(([t, p]) => ({ t, p }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const coin = getCoin(params.get("symbol") || "BTC");
  const range = getRange(params.get("range") || "7d");

  let points: PricePoint[] | null = null;
  let source = "binance";

  // 1. Пробуем Binance
  try {
    points = await fromBinance(coin.binance, range.interval, range.limit);
  } catch {
    // 2. Пробуем CoinGecko
    try {
      points = await fromCoinGecko(coin.coingecko, range.days);
      source = "coingecko";
    } catch {
      // 3. Резервные данные, чтобы график не ломался
      points = syntheticSeries(coin, range);
      source = "offline";
    }
  }

  // Прореживаем слишком длинные ряды (для плавного SVG)
  let series: PricePoint[] = points ?? syntheticSeries(coin, range);
  if (series.length > 400) {
    const step = Math.ceil(series.length / 400);
    series = series.filter((_, i) => i % step === 0 || i === series.length - 1);
  }

  // Статистика по загруженному ряду
  const values = series.map((p) => p.p);
  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const changePct = first !== 0 ? ((last - first) / first) * 100 : 0;

  // Данные тикера (24ч)
  let ticker = {
    price: last,
    change24h: changePct,
    high24h: max,
    low24h: min,
    volume24h: 0,
  };
  if (source === "binance") {
    try {
      ticker = await binanceTicker(coin.binance);
    } catch {
      /* оставляем расчётные значения */
    }
  } else if (source === "coingecko") {
    try {
      ticker = await coingeckoTicker(coin.coingecko);
    } catch {
      /* оставляем расчётные значения */
    }
  }

  const payload = {
    symbol: coin.symbol,
    name: coin.name,
    icon: coin.icon,
    color: coin.color,
    range: range.key,
    rangeLabel: range.label,
    source,
    points: series,
    stats: {
      first,
      last,
      min,
      max,
      changePct,
      changeAbs: last - first,
      ...ticker,
    },
    updatedAt: new Date().toISOString(),
  };


  return NextResponse.json({ ...payload, cached: false });
}
