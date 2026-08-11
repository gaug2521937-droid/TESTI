import { NextRequest, NextResponse } from "next/server";
import { searchAudius, searchCcMixter, dedupe, type ApiTrack } from "@/lib/musicSources";

export const dynamic = "force-dynamic";

/**
 * Похожие исполнители + их треки.
 * Используем Deezer /artist/{id}/related — связи там точные и без ключей.
 */

export interface SimilarArtist {
  id: string;
  name: string;
  picture: string;
  fans: number;
  albums: number;
}

interface DzArtist {
  id?: number;
  name?: string;
  picture_medium?: string;
  picture_big?: string;
  nb_fan?: number;
  nb_album?: number;
}

export async function GET(request: NextRequest) {
  const artist = (request.nextUrl.searchParams.get("artist") || "").trim();
  const withTracks = request.nextUrl.searchParams.get("tracks") === "1";

  if (!artist) {
    return NextResponse.json({ error: "Укажите исполнителя" }, { status: 400 });
  }

  try {
    // 1. Находим артиста
    const findRes = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=10`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!findRes.ok) throw new Error("deezer search failed");

    const findData = (await findRes.json()) as { data?: DzArtist[] };
    const candidates = (findData.data || []).filter((a) => a.id && a.name);

    // Выбираем настоящего артиста, а не двойника вроде "Emine'm":
    // точное совпадение имени, при равенстве — тот, у кого больше фанатов.
    const norm = (x: string) => x.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
    const q = norm(artist);

    const found =
      candidates
        .map((a) => {
          const n = norm(a.name!);
          let score = 0;
          if (n === q) score += 100;
          else if (n.startsWith(q)) score += 60;
          else if (n.includes(q)) score += 30;
          // Популярность как дополнительный вес
          score += Math.min(20, Math.log10((a.nb_fan ?? 0) + 1) * 3);
          return { a, score };
        })
        .sort((x, y) => y.score - x.score)[0]?.a ?? candidates[0];

    if (!found?.id) {
      return NextResponse.json({ artists: [], tracks: [], found: false, query: artist });
    }

    const origin = {
      id: String(found.id),
      name: found.name ?? artist,
      picture: found.picture_big || found.picture_medium || "",
      fans: found.nb_fan ?? 0,
      albums: found.nb_album ?? 0,
    };

    // 2. Похожие
    const relRes = await fetch(`https://api.deezer.com/artist/${found.id}/related?limit=12`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    let artists: SimilarArtist[] = [];
    if (relRes.ok) {
      const relData = (await relRes.json()) as { data?: DzArtist[] };
      artists = (relData.data || [])
        .filter((a) => a.id && a.name)
        .map((a) => ({
          id: String(a.id),
          name: a.name!,
          picture: a.picture_big || a.picture_medium || "",
          fans: a.nb_fan ?? 0,
          albums: a.nb_album ?? 0,
        }));
    }

    // 3. По желанию — треки похожих артистов
    let tracks: ApiTrack[] = [];
    if (withTracks && artists.length > 0) {
      const names = artists.slice(0, 5).map((a) => a.name);
      const batches = await Promise.all([
        ...names.map((n) => searchAudius(n, 5)),
        searchCcMixter(origin.name, 5),
      ]);
      tracks = dedupe(batches.flat() as ApiTrack[]).slice(0, 30);
    }

    return NextResponse.json({
      found: true,
      origin,
      artists,
      tracks,
      query: artist,
    });
  } catch (error) {
    console.error("Similar error:", error);
    return NextResponse.json(
      { error: "Не удалось найти похожих исполнителей", artists: [], tracks: [] },
      { status: 502 }
    );
  }
}
