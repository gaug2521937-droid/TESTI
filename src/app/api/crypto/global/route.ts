import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Общая картина крипторынка из четырёх открытых источников:
 *  • CoinGecko /global   — капитализация, объём, доминация
 *  • CoinGecko /trending — что сейчас ищут чаще всего
 *  • Blockchain.info     — состояние сети Bitcoin
 *  • Mempool.space       — рекомендованные комиссии
 */

interface GlobalData {
  marketCap: number;
  volume24h: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChange: number;
  activeCoins: number;
  markets: number;
}

async function fetchGlobal(): Promise<GlobalData | null> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/global", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      data?: {
        total_market_cap?: Record<string, number>;
        total_volume?: Record<string, number>;
        market_cap_percentage?: Record<string, number>;
        market_cap_change_percentage_24h_usd?: number;
        active_cryptocurrencies?: number;
        markets?: number;
      };
    };
    const g = d.data;
    if (!g) return null;

    return {
      marketCap: g.total_market_cap?.usd ?? 0,
      volume24h: g.total_volume?.usd ?? 0,
      btcDominance: g.market_cap_percentage?.btc ?? 0,
      ethDominance: g.market_cap_percentage?.eth ?? 0,
      marketCapChange: g.market_cap_change_percentage_24h_usd ?? 0,
      activeCoins: g.active_cryptocurrencies ?? 0,
      markets: g.markets ?? 0,
    };
  } catch {
    return null;
  }
}

interface TrendCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  rank: number;
  price: number | null;
}

async function fetchTrending(): Promise<TrendCoin[]> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      coins?: Array<{
        item?: {
          id?: string;
          name?: string;
          symbol?: string;
          thumb?: string;
          market_cap_rank?: number;
          data?: { price?: number | string };
        };
      }>;
    };

    return (d.coins || [])
      .map((c) => c.item)
      .filter((i): i is NonNullable<typeof i> => Boolean(i?.id))
      .slice(0, 8)
      .map((i) => ({
        id: i.id!,
        name: i.name ?? "",
        symbol: (i.symbol ?? "").toUpperCase(),
        thumb: i.thumb ?? "",
        rank: i.market_cap_rank ?? 0,
        price: typeof i.data?.price === "number" ? i.data.price : Number(i.data?.price) || null,
      }));
  } catch {
    return [];
  }
}

interface BtcNetwork {
  hashRate: number;
  difficulty: number;
  blocks24h: number;
  txCount24h: number;
  minutesBetweenBlocks: number;
  totalBtc: number;
}

async function fetchBtcNetwork(): Promise<BtcNetwork | null> {
  try {
    const r = await fetch("https://api.blockchain.info/stats", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, number>;
    return {
      hashRate: d.hash_rate ?? 0,
      difficulty: d.difficulty ?? 0,
      blocks24h: d.n_blocks_mined ?? 0,
      txCount24h: d.n_tx ?? 0,
      minutesBetweenBlocks: d.minutes_between_blocks ?? 0,
      totalBtc: (d.totalbc ?? 0) / 1e8,
    };
  } catch {
    return null;
  }
}

interface Fees {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
}

async function fetchFees(): Promise<Fees | null> {
  try {
    const r = await fetch("https://mempool.space/api/v1/fees/recommended", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, number>;
    return {
      fastest: d.fastestFee ?? 0,
      halfHour: d.halfHourFee ?? 0,
      hour: d.hourFee ?? 0,
      economy: d.economyFee ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [global, trending, network, fees] = await Promise.all([
    fetchGlobal(),
    fetchTrending(),
    fetchBtcNetwork(),
    fetchFees(),
  ]);

  return NextResponse.json({
    global,
    trending,
    network,
    fees,
    updatedAt: new Date().toISOString(),
  });
}
