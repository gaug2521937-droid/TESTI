import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Настроение рынка:
 *  • Fear & Greed Index — alternative.me (без ключа)
 *  • Официальные курсы ЦБ РФ — cbr-xml-daily.ru (без ключа)
 */

interface FngItem {
  value: string;
  value_classification: string;
  timestamp: string;
}

/** Перевод классификации на русский */
const RU_CLASS: Record<string, { label: string; color: string; emoji: string }> = {
  "Extreme Fear": { label: "Крайний страх", color: "#ff5470", emoji: "😱" },
  Fear: { label: "Страх", color: "#ff8a5c", emoji: "😨" },
  Neutral: { label: "Нейтрально", color: "#ffc542", emoji: "😐" },
  Greed: { label: "Жадность", color: "#8ede5c", emoji: "🤑" },
  "Extreme Greed": { label: "Крайняя жадность", color: "#00e0a4", emoji: "🚀" },
};

function classify(v: number) {
  if (v <= 24) return RU_CLASS["Extreme Fear"];
  if (v <= 44) return RU_CLASS.Fear;
  if (v <= 55) return RU_CLASS.Neutral;
  if (v <= 75) return RU_CLASS.Greed;
  return RU_CLASS["Extreme Greed"];
}

async function fearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=30", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: FngItem[] };
    const items = d.data || [];
    if (items.length === 0) return null;

    const now = Number(items[0].value);
    const history = items
      .map((i) => ({ v: Number(i.value), t: Number(i.timestamp) * 1000 }))
      .reverse();

    const week = items[6] ? Number(items[6].value) : now;
    const month = items[29] ? Number(items[29].value) : now;

    return {
      value: now,
      ...classify(now),
      yesterday: items[1] ? Number(items[1].value) : now,
      weekAgo: week,
      monthAgo: month,
      history,
    };
  } catch {
    return null;
  }
}

interface CbrValute {
  CharCode: string;
  Name: string;
  Value: number;
  Previous: number;
  Nominal: number;
}

async function cbrRates() {
  try {
    const res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      Date?: string;
      Valute?: Record<string, CbrValute>;
    };
    const v = d.Valute;
    if (!v) return null;

    const want = ["USD", "EUR", "CNY", "GBP", "JPY", "TRY", "KZT", "BYN"];
    const list = want
      .filter((c) => v[c])
      .map((c) => {
        const x = v[c];
        const cur = x.Value / x.Nominal;
        const prev = x.Previous / x.Nominal;
        return {
          code: c,
          name: x.Name,
          value: cur,
          previous: prev,
          diff: cur - prev,
          diffPct: prev ? ((cur - prev) / prev) * 100 : 0,
        };
      });

    return { date: d.Date ?? null, rates: list };
  } catch {
    return null;
  }
}

export async function GET() {
  const [fng, cbr] = await Promise.all([fearGreed(), cbrRates()]);

  return NextResponse.json({
    fearGreed: fng,
    cbr,
    updatedAt: new Date().toISOString(),
  });
}
