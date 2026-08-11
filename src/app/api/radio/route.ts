import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Радиостанции через Radio Browser API (открытый, без ключей).
 * Более 50 000 станций со всего мира.
 */

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
];

export interface Station {
  id: string;
  name: string;
  url: string;
  directUrl: string;
  favicon: string;
  country: string;
  countryCode: string;
  tags: string[];
  codec: string;
  bitrate: number;
  votes: number;
  clickCount: number;
  language: string;
  homepage: string;
}

interface RbStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  url: string;
  favicon: string;
  country: string;
  countrycode: string;
  tags: string;
  codec: string;
  bitrate: number;
  votes: number;
  clickcount: number;
  language: string;
  homepage: string;
  lastcheckok: number;
}

function mapStation(s: RbStation): Station | null {
  const url = s.url_resolved || s.url;
  if (!url || !s.name) return null;
  return {
    id: s.stationuuid,
    name: s.name.trim().slice(0, 90),
    // http-потоки браузер блокирует на https-сайте — гоним через прокси
    url: `/api/radio/stream?url=${encodeURIComponent(url)}${
      s.url && s.url !== url ? `&alt=${encodeURIComponent(s.url)}` : ""
    }`,
    directUrl: url,
    favicon: s.favicon || "",
    country: s.country || "",
    countryCode: s.countrycode || "",
    tags: (s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
    codec: s.codec || "MP3",
    bitrate: s.bitrate || 0,
    votes: s.votes || 0,
    clickCount: s.clickcount || 0,
    language: s.language || "",
    homepage: s.homepage || "",
  };
}

/** Запрос с перебором зеркал */
async function rb(path: string): Promise<RbStation[]> {
  for (const host of MIRRORS) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers: { "User-Agent": "GASHPROJECT/1.0", Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      return (await res.json()) as RbStation[];
    } catch {
      continue;
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const q = (p.get("q") || "").trim();
  const country = p.get("country") || "RU";
  const tag = (p.get("tag") || "").trim();
  const limit = Math.min(Number(p.get("limit") || 40), 80);

  try {
    let path: string;

    if (q) {
      path = `/json/stations/search?name=${encodeURIComponent(q)}&limit=${limit}&hidebroken=true&order=votes&reverse=true`;
    } else if (tag) {
      path =
        country === "ALL"
          ? `/json/stations/bytagexact/${encodeURIComponent(tag)}?limit=${limit}&hidebroken=true&order=votes&reverse=true`
          : `/json/stations/search?tag=${encodeURIComponent(tag)}&countrycode=${country}&limit=${limit}&hidebroken=true&order=votes&reverse=true`;
    } else if (country === "ALL") {
      path = `/json/stations/topvote/${limit}?hidebroken=true`;
    } else {
      path = `/json/stations/bycountrycodeexact/${country}?limit=${limit}&hidebroken=true&order=votes&reverse=true`;
    }

    const raw = await rb(path);
    const stations = raw
      // Radio Browser сам проверяет доступность — берём только живые
      .filter((s) => s.lastcheckok === 1)
      .map(mapStation)
      .filter((s): s is Station => s !== null)
      // Совсем без битрейта обычно битые
      .filter((s) => s.bitrate === 0 || s.bitrate >= 32);

    return NextResponse.json({
      stations,
      total: stations.length,
      country,
      tag,
      query: q,
    });
  } catch (error) {
    console.error("Radio error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить станции. Попробуйте позже.", stations: [] },
      { status: 502 }
    );
  }
}
