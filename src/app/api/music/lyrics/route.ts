import { NextRequest, NextResponse } from "next/server";
import { lrclibGet, lrclibSearch, lyricsOvh, type LyricsResult } from "@/lib/musicApis";

export const dynamic = "force-dynamic";

/**
 * Тексты песен из четырёх источников.
 * Приоритет у LRCLIB — он отдаёт строки с таймкодами,
 * что позволяет подсвечивать текущую строку точно, а не на глаз.
 */

const cache = new Map<string, { data: LyricsResult | null; ts: number }>();
const TTL = 30 * 60 * 1000;

/** Чистим название от мусора, мешающего совпадению */
function clean(s: string): string {
  return s
    .replace(/\s*[([{].*?[)\]}]\s*/g, " ")
    .replace(/\s*[-–—]\s*(topic|official.*|vevo|lyrics?|audio|video)\s*$/i, "")
    .replace(/\s*(feat\.?|ft\.?|prod\.?)\s.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstArtist(s: string): string {
  return s.split(/[,&×]|\sx\s|\sи\s|\sfeat/i)[0].trim();
}

/**
 * У некоторых источников артист лежит внутри названия:
 *   artist="Pure Thrill", title="Баста - Sansara"
 * Настоящий исполнитель здесь — Баста, а не канал заливщика.
 * Возвращаем такие перевёрнутые пары как дополнительные варианты.
 */
function swapped(artist: string, title: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const parts = title.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    const maybeArtist = parts[0].trim();
    const maybeTitle = parts.slice(1).join(" - ").trim();
    if (maybeArtist.length > 1 && maybeTitle.length > 1) {
      out.push([maybeArtist, maybeTitle]);
      out.push([artist, maybeTitle]);
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const artist = (p.get("artist") || "").trim();
  const title = (p.get("title") || "").trim();
  const duration = Number(p.get("duration") || 0);

  if (!artist || !title) {
    return NextResponse.json({ error: "Нужны artist и title" }, { status: 400 });
  }

  const key = `${artist}|${title}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return NextResponse.json({
      ...(hit.data ?? {}),
      found: Boolean(hit.data),
      cached: true,
    });
  }

  const a1 = artist.trim();
  const a2 = firstArtist(clean(a1));
  const t1 = title.trim();
  const t2 = clean(t1);

  // Варианты, где исполнитель спрятан в названии
  const swaps = swapped(a2, t2);

  // Порядок: точное совпадение с таймкодами → перевёртыши → поиск → резерв
  const attempts: Array<() => Promise<LyricsResult | null>> = [
    () => lrclibGet(a1, t1, duration),
    () => lrclibGet(a2, t2, duration),
    () => lrclibGet(a2, t2),
    ...swaps.map(([a, t]) => () => lrclibGet(a, t, duration)),
    ...swaps.map(([a, t]) => () => lrclibGet(a, t)),
    () => lrclibSearch(`${a2} ${t2}`),
    ...swaps.map(([a, t]) => () => lrclibSearch(`${a} ${t}`)),
    () => lrclibSearch(t2),
    () => lyricsOvh(a1, t2),
    () => lyricsOvh(a2, t2),
    ...swaps.map(([a, t]) => () => lyricsOvh(a, t)),
  ];

  /** Похоже ли найденное на то, что искали */
  const relevant = (r: LyricsResult): boolean => {
    if (!r.trackName) return true; // резервный источник не возвращает метаданные
    const norm = (x: string) => x.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
    const gotT = norm(r.trackName);
    const wantT = norm(t2);
    const gotA = norm(r.artistName ?? "");
    const wantA = norm(a2);
    const titleOk = gotT.includes(wantT) || wantT.includes(gotT);
    const artistOk = !gotA || !wantA || gotA.includes(wantA) || wantA.includes(gotA);
    return titleOk || artistOk;
  };

  for (const attempt of attempts) {
    const res = await attempt();
    if (res && (res.plain || res.synced) && relevant(res)) {
      cache.set(key, { data: res, ts: Date.now() });
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);

      return NextResponse.json({
        ...res,
        found: true,
        hasSync: Boolean(res.synced),
        lines: res.synced?.length ?? res.plain?.split("\n").length ?? 0,
      });
    }
  }

  cache.set(key, { data: null, ts: Date.now() });
  return NextResponse.json({
    found: false,
    plain: null,
    synced: null,
    message: "Текст этой песни не найден",
  });
}
