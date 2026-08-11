// Общие настройки и утилиты для криптовалютного раздела

export interface CoinMeta {
  symbol: string;
  name: string;
  binance: string;
  coingecko: string;
  icon: string;
  color: string;
  base: number; // ориентировочная цена для резервного режима
}

export const COINS: CoinMeta[] = [
  { symbol: "BTC", name: "Bitcoin", binance: "BTCUSDT", coingecko: "bitcoin", icon: "₿", color: "#f7931a", base: 68000 },
  { symbol: "ETH", name: "Ethereum", binance: "ETHUSDT", coingecko: "ethereum", icon: "Ξ", color: "#627eea", base: 3400 },
  { symbol: "TON", name: "Toncoin", binance: "TONUSDT", coingecko: "the-open-network", icon: "💎", color: "#0098ea", base: 5.4 },
  { symbol: "SOL", name: "Solana", binance: "SOLUSDT", coingecko: "solana", icon: "◎", color: "#14f195", base: 150 },
  { symbol: "BNB", name: "BNB", binance: "BNBUSDT", coingecko: "binancecoin", icon: "⬡", color: "#f3ba2f", base: 590 },
  { symbol: "XRP", name: "XRP", binance: "XRPUSDT", coingecko: "ripple", icon: "✕", color: "#23292f", base: 0.6 },
  { symbol: "DOGE", name: "Dogecoin", binance: "DOGEUSDT", coingecko: "dogecoin", icon: "🐕", color: "#c2a633", base: 0.15 },
  { symbol: "ADA", name: "Cardano", binance: "ADAUSDT", coingecko: "cardano", icon: "₳", color: "#0033ad", base: 0.45 },
];

export function getCoin(symbol: string): CoinMeta {
  return COINS.find((c) => c.symbol === symbol.toUpperCase()) ?? COINS[0];
}

export interface RangeConfig {
  key: string;
  label: string;
  interval: string;
  limit: number;
  days: number;
}

export const RANGES: RangeConfig[] = [
  { key: "1d", label: "24Ч", interval: "15m", limit: 96, days: 1 },
  { key: "7d", label: "7Д", interval: "1h", limit: 168, days: 7 },
  { key: "30d", label: "30Д", interval: "4h", limit: 180, days: 30 },
  { key: "90d", label: "3М", interval: "12h", limit: 180, days: 90 },
  { key: "1y", label: "1Г", interval: "1d", limit: 365, days: 365 },
];

export function getRange(key: string): RangeConfig {
  return RANGES.find((r) => r.key === key) ?? RANGES[1];
}

export interface PricePoint {
  t: number; // timestamp (ms)
  p: number; // цена
}

/**
 * Детерминированный генератор псевдо-исторических данных.
 * Используется только если и Binance, и CoinGecko недоступны,
 * чтобы интерфейс графика оставался рабочим.
 */
export function syntheticSeries(coin: CoinMeta, range: RangeConfig): PricePoint[] {
  const points: PricePoint[] = [];
  const now = Date.now();
  const stepMs = (range.days * 24 * 60 * 60 * 1000) / range.limit;

  // Псевдослучайность на основе символа — стабильна между запросами
  let seed = 0;
  for (let i = 0; i < coin.symbol.length; i++) seed += coin.symbol.charCodeAt(i) * (i + 7);

  const rand = (n: number) => {
    const x = Math.sin(seed + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  let price = coin.base * (0.88 + rand(0) * 0.12);
  const trend = (rand(1) - 0.42) * 0.0016;

  for (let i = 0; i < range.limit; i++) {
    const noise = (rand(i + 2) - 0.5) * 0.022;
    const wave = Math.sin(i / (range.limit / 7)) * 0.008;
    price = price * (1 + trend + noise + wave);
    points.push({ t: now - (range.limit - 1 - i) * stepMs, p: Number(price.toFixed(price < 1 ? 6 : 2)) });
  }

  return points;
}
