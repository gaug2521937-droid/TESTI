import { NextResponse } from "next/server";
import { COINS, getRange, syntheticSeries } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Кеш списка монет на 60 секунд
// Кеш отключён — данные тянутся заново при каждом запросе

interface MarketRow {
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

// Мини-спарклайн: 24 точки по часу
async function sparkline(binanceSymbol: string): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1h&limit=24`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => parseFloat(String(k[4])));
  } catch {
    return [];
  }
}

export async function GET() {

  const symbols = COINS.map((c) => c.binance);
  let rows: MarketRow[] = [];
  let source = "binance";

  try {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
      JSON.stringify(symbols)
    )}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error("binance markets failed");

    const data = (await res.json()) as Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      quoteVolume: string;
    }>;

    // Спарклайны параллельно
    const sparks = await Promise.all(COINS.map((c) => sparkline(c.binance)));

    rows = COINS.map((coin, i) => {
      const t = data.find((d) => d.symbol === coin.binance);
      return {
        symbol: coin.symbol,
        name: coin.name,
        icon: coin.icon,
        color: coin.color,
        price: t ? parseFloat(t.lastPrice) : coin.base,
        change24h: t ? parseFloat(t.priceChangePercent) : 0,
        high24h: t ? parseFloat(t.highPrice) : coin.base,
        low24h: t ? parseFloat(t.lowPrice) : coin.base,
        volume24h: t ? parseFloat(t.quoteVolume) : 0,
        spark: sparks[i],
      };
    });
  } catch {
    // Резервный вариант через CoinGecko (один запрос, вместе со спарклайнами)
    try {
      const ids = COINS.map((c) => c.coingecko).join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}` +
          `&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
        { cache: "no-store", signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error("coingecko markets failed");

      const list = (await res.json()) as Array<{
        id: string;
        current_price: number;
        price_change_percentage_24h: number | null;
        high_24h: number | null;
        low_24h: number | null;
        total_volume: number | null;
        sparkline_in_7d?: { price: number[] };
      }>;

      source = "coingecko";
      rows = COINS.map((coin) => {
        const entry = list.find((l) => l.id === coin.coingecko);
        const price = entry?.current_price ?? coin.base;

        // Прореживаем 168 точек (7д) до 24 для мини-графика
        const full = entry?.sparkline_in_7d?.price ?? [];
        const step = full.length > 24 ? Math.ceil(full.length / 24) : 1;
        const spark = full.filter((_, i) => i % step === 0).slice(-24);

        return {
          symbol: coin.symbol,
          name: coin.name,
          icon: coin.icon,
          color: coin.color,
          price,
          change24h: entry?.price_change_percentage_24h ?? 0,
          high24h: entry?.high_24h ?? price * 1.02,
          low24h: entry?.low_24h ?? price * 0.98,
          volume24h: entry?.total_volume ?? 0,
          spark,
        };
      });
    } catch {
      // Полностью офлайн — рисуем стабильные резервные данные
      source = "offline";
      rows = COINS.map((coin) => {
        const series = syntheticSeries(coin, getRange("1d")).slice(-24).map((p) => p.p);
        const price = series[series.length - 1] ?? coin.base;
        const change = series.length > 1 ? ((price - series[0]) / series[0]) * 100 : 0;
        return {
          symbol: coin.symbol,
          name: coin.name,
          icon: coin.icon,
          color: coin.color,
          price,
          change24h: change,
          high24h: Math.max(...series),
          low24h: Math.min(...series),
          volume24h: 0,
          spark: series,
        };
      });
    }
  }

  return NextResponse.json({
    markets: rows,
    source,
    updatedAt: new Date().toISOString(),
    cached: false,
  });
}
