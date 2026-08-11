import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Дополнительные срезы крипторынка из открытых источников:
 *  • CoinGecko /coins/markets — топ монет с недельной динамикой
 *  • CoinGecko /exchanges     — рейтинг бирж по объёму доверия
 *  • CoinLore /global         — независимая сводка по рынку
 *  • Mempool difficulty       — прогресс пересчёта сложности BTC
 *  • Kraken ticker            — цены с ещё одной биржи для сверки
 */

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

async function topCoins(): Promise<TopCoin[]> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc" +
        "&per_page=20&page=1&sparkline=true&price_change_percentage=24h,7d",
      { cache: "no-store", signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) return [];

    const d = (await r.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      image: string;
      current_price: number;
      price_change_percentage_24h: number | null;
      price_change_percentage_7d_in_currency: number | null;
      market_cap: number;
      total_volume: number;
      market_cap_rank: number;
      ath: number;
      ath_change_percentage: number;
      sparkline_in_7d?: { price: number[] };
    }>;

    return d.map((c) => {
      const full = c.sparkline_in_7d?.price ?? [];
      const step = full.length > 28 ? Math.ceil(full.length / 28) : 1;
      return {
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image,
        price: c.current_price ?? 0,
        change24h: c.price_change_percentage_24h ?? 0,
        change7d: c.price_change_percentage_7d_in_currency ?? 0,
        marketCap: c.market_cap ?? 0,
        volume: c.total_volume ?? 0,
        rank: c.market_cap_rank ?? 0,
        ath: c.ath ?? 0,
        athChange: c.ath_change_percentage ?? 0,
        sparkline: full.filter((_, i) => i % step === 0).slice(-28),
      };
    });
  } catch {
    return [];
  }
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

async function exchanges(): Promise<Exchange[]> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/exchanges?per_page=10&page=1", {
      cache: "no-store",
      signal: AbortSignal.timeout(11000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as Array<{
      id: string;
      name: string;
      image: string;
      trust_score_rank: number;
      trade_volume_24h_btc: number;
      country: string | null;
      year_established: number | null;
    }>;
    return d.map((e) => ({
      id: e.id,
      name: e.name,
      image: e.image,
      trustRank: e.trust_score_rank ?? 0,
      volumeBtc: e.trade_volume_24h_btc ?? 0,
      country: e.country ?? "—",
      year: e.year_established,
    }));
  } catch {
    return [];
  }
}

interface Difficulty {
  progress: number;
  remainingBlocks: number;
  estimatedChange: number;
  daysLeft: number;
}

async function difficulty(): Promise<Difficulty | null> {
  try {
    const r = await fetch("https://mempool.space/api/v1/difficulty-adjustment", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, number>;
    return {
      progress: d.progressPercent ?? 0,
      remainingBlocks: d.remainingBlocks ?? 0,
      estimatedChange: d.difficultyChange ?? 0,
      daysLeft: (d.remainingTime ?? 0) / 86400000,
    };
  } catch {
    return null;
  }
}

interface CoinLore {
  coinsCount: number;
  activeMarkets: number;
  totalMcap: number;
  totalVolume: number;
  btcDominance: number;
  ethDominance: number;
  mcapChange: number;
}

async function coinlore(): Promise<CoinLore | null> {
  try {
    const r = await fetch("https://api.coinlore.net/api/global/", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const arr = (await r.json()) as Array<Record<string, string | number>>;
    const g = arr?.[0];
    if (!g) return null;
    const num = (v: unknown) => Number(v) || 0;
    return {
      coinsCount: num(g.coins_count),
      activeMarkets: num(g.active_markets),
      totalMcap: num(g.total_mcap),
      totalVolume: num(g.total_volume),
      btcDominance: num(g.btc_d),
      ethDominance: num(g.eth_d),
      mcapChange: num(g.mcap_change),
    };
  } catch {
    return null;
  }
}

/** Сверка цены с независимой биржей */
async function kraken(): Promise<{ pair: string; price: number }[]> {
  try {
    const r = await fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD", {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as { result?: Record<string, { c?: string[] }> };
    return Object.entries(d.result ?? {}).map(([pair, v]) => ({
      pair: pair.replace("ZUSD", "/USD").replace("XXBT", "BTC").replace("X", ""),
      price: Number(v.c?.[0]) || 0,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const [coins, exch, diff, lore, kr] = await Promise.all([
    topCoins(),
    exchanges(),
    difficulty(),
    coinlore(),
    kraken(),
  ]);

  // Лидеры роста и падения из топ-20
  const sorted = [...coins].sort((a, b) => b.change24h - a.change24h);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();

  return NextResponse.json({
    coins,
    gainers,
    losers,
    exchanges: exch,
    difficulty: diff,
    coinlore: lore,
    kraken: kr,
    updatedAt: new Date().toISOString(),
  });
}
