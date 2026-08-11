import { NextRequest, NextResponse } from "next/server";
import {
  deezerArtists,
  deezerRelated,
  deezerAlbums,
  itunesDiscography,
  audioDbArtist,
  discogsReleases,
} from "@/lib/musicApis";
import { searchAudius, searchArchive, dedupe, rank } from "@/lib/musicSources";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Страница артиста: собирает данные из шести источников —
 * профиль, биография, альбомы, издания, похожие исполнители
 * и слушабельные треки.
 */
export async function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get("name") || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Укажите исполнителя" }, { status: 400 });
  }

  try {
    // Находим артиста в Deezer — там лучшие метаданные
    const found = await deezerArtists(name, 8);

    const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9$]/gi, "");
    const q = norm(name);
    const best =
      found
        .map((a) => {
          const n = norm(a.name);
          let score = 0;
          if (n === q) score += 100;
          else if (n.startsWith(q)) score += 60;
          else if (n.includes(q)) score += 30;
          score += Math.min(20, Math.log10(a.fans + 1) * 3);
          return { a, score };
        })
        .sort((x, y) => y.score - x.score)[0]?.a ?? found[0];

    // Всё остальное параллельно
    const [bio, albums, related, releases, audius, archive] = await Promise.all([
      audioDbArtist(best?.name ?? name),
      best ? deezerAlbums(best.name, 12) : Promise.resolve([]),
      best ? deezerRelated(best.id, 10) : Promise.resolve([]),
      discogsReleases(best?.name ?? name, 8),
      searchAudius(best?.name ?? name, 12),
      searchArchive(best?.name ?? name, 6),
    ]);

    const tracks = rank(dedupe([...audius, ...archive]), best?.name ?? name).slice(0, 24);

    return NextResponse.json({
      found: Boolean(best),
      artist: best ?? null,
      bio,
      albums,
      related,
      releases,
      tracks,
      query: name,
      sourcesUsed: ["deezer", "theaudiodb", "discogs", "audius", "archive"],
    });
  } catch (error) {
    console.error("Artist error:", error);
    return NextResponse.json({ error: "Не удалось загрузить артиста" }, { status: 502 });
  }
}

/** Дискография Apple по id артиста */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const artistId = String(body.itunesArtistId || "");
    if (!artistId) return NextResponse.json({ albums: [] });
    const albums = await itunesDiscography(artistId, 16);
    return NextResponse.json({ albums });
  } catch {
    return NextResponse.json({ albums: [] });
  }
}
