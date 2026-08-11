import { NextRequest, NextResponse } from "next/server";
import {
  searchAudius,
  trendingAudius,
  undergroundAudius,
  searchArchive,
  searchCcMixter,
  dedupe,
  rank,
  AUDIUS_GENRES,
  type ApiTrack,
} from "@/lib/musicSources";
import { searchYtMusic, searchYtVideos } from "@/lib/youtubeMusic";

export const dynamic = "force-dynamic";

/**
 * Поиск музыки. Все источники отдают ПОЛНЫЕ треки —
 * никаких 30-секундных обрезков.
 * source: all | audius | archive | ccmixter
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const query = (p.get("q") || "").trim();
  const source = p.get("source") || "all";
  const genre = (p.get("genre") || "").trim();
  const limit = Math.min(Math.max(Number(p.get("limit") || 40), 1), 60);

  try {
    let audius: ApiTrack[] = [];
    let archive: ApiTrack[] = [];
    let ccmixter: ApiTrack[] = [];
    let ytm: ApiTrack[] = [];

    if (source === "audius") {
      audius = query ? await searchAudius(query, limit) : await trendingAudius(genre, limit);
    } else if (source === "archive") {
      archive = await searchArchive(query, limit);
    } else if (source === "ccmixter") {
      ccmixter = await searchCcMixter(query, limit);
    } else if (source === "underground") {
      audius = await undergroundAudius(limit);
    } else if (source === "youtube") {
      ytm = await searchYtMusic(query, limit);
    } else if (source === "clips") {
      ytm = await searchYtVideos(query, limit);
    } else {
      // Только источники, которые реально играют:
      // YouTube Music целиком + прямые потоки
      [ytm, audius, archive, ccmixter] = await Promise.all([
        query ? searchYtMusic(query, Math.ceil(limit * 0.8)) : Promise.resolve([]),
        query ? searchAudius(query, Math.ceil(limit * 0.35)) : trendingAudius(genre, Math.ceil(limit * 0.7)),
        searchArchive(query, Math.ceil(limit * 0.25)),
        searchCcMixter(query, Math.ceil(limit * 0.25)),
      ]);
    }

    /**
     * Каждый источник ранжируем отдельно, затем сшиваем в явном порядке.
     * YouTube Music идёт первым: у него верные метаданные и трек
     * играет целиком. Так порядок предсказуем и не зависит от того,
     * насколько щедро другой источник проставил популярность.
     */
    const byRelevance = (list: ApiTrack[]) => rank(list, query);

    const groups = [
      byRelevance(ytm),
      byRelevance(audius),
      byRelevance(archive),
      byRelevance(ccmixter),
    ];

    // Чередуем по кругу, но с двойным весом у YouTube Music
    const merged: ApiTrack[] = [];
    const maxLen = Math.max(...groups.map((g) => g.length), 0);
    for (let i = 0; i < maxLen; i++) {
      if (groups[0][i * 2]) merged.push(groups[0][i * 2]);
      if (groups[0][i * 2 + 1]) merged.push(groups[0][i * 2 + 1]);
      for (let g = 1; g < groups.length; g++) {
        if (groups[g][i]) merged.push(groups[g][i]);
      }
    }

    const tracks = dedupe(merged).slice(0, limit);

    return NextResponse.json({
      tracks,
      total: tracks.length,
      // Всё играет целиком
      // Прямой поток
      fullCount: tracks.filter((t) => t.isFull).length,
      // Каталог — играет целиком через YouTube
      viaYoutube: tracks.filter((t) => !t.isFull).length,
      sources: {
        ytmusic: ytm.length,
        audius: audius.length,
        archive: archive.length,
        ccmixter: ccmixter.length,
      },
      query,
      source,
      genres: AUDIUS_GENRES,
    });
  } catch (error) {
    console.error("Music search error:", error);
    return NextResponse.json(
      { error: "Ошибка при поиске музыки. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
