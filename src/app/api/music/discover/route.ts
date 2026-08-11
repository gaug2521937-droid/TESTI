import { NextRequest, NextResponse } from "next/server";
import {
  deezerChartArtists,
  deezerAlbums,
  deezerGenres,
  deezerEditorial,
  lyricsSuggest,
  MUSIC_APIS,
  API_COUNT,
} from "@/lib/musicApis";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Витрина «Обзор»: чарты, альбомы, жанры и подборки редакции.
 * Тянет данные из пяти каталожных эндпоинтов сразу.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  try {
    const [chartArtists, albums, genres, editorial, suggest] = await Promise.all([
      deezerChartArtists(14),
      deezerAlbums(q || "2025", 14),
      deezerGenres(),
      deezerEditorial(),
      q ? lyricsSuggest(q) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      chartArtists,
      albums,
      genres: genres.slice(0, 18),
      editorial: editorial.slice(0, 12),
      suggest,
      apiCount: API_COUNT,
      apis: MUSIC_APIS,
    });
  } catch (error) {
    console.error("Discover error:", error);
    return NextResponse.json(
      { chartArtists: [], albums: [], genres: [], editorial: [], suggest: [], apiCount: API_COUNT },
      { status: 200 }
    );
  }
}
