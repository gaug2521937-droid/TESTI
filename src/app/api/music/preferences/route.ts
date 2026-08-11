import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userStats, playlistTracks, playlists } from "@/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { getOrCreateStats } from "@/lib/levels";

export const dynamic = "force-dynamic";

/**
 * Первичные предпочтения: артисты, которых пользователь выбрал при входе.
 * Хранятся строкой через запятую в user_stats.
 * Используются миксом наряду с историей прослушиваний и плейлистами.
 */

export async function GET() {
  const stats = await getOrCreateStats();
  // Профиль ещё не создан — считаем гостем, но не заставляем проходить онбординг
  // на каждой перезагрузке; локальное значение будет храниться в браузере
  if (!stats) return NextResponse.json({ artists: [], onboarded: true, guest: true });

  const artists = (stats.preferredArtists as string | undefined ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  return NextResponse.json({
    artists,
    onboarded: Boolean((stats as { onboarded?: boolean }).onboarded),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const list = Array.isArray(body.artists) ? body.artists : [];
  const artists = list
    .map((s: unknown) => String(s).trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 20);

  const stats = await getOrCreateStats();
  if (!stats) return NextResponse.json({ error: "Нет профиля" }, { status: 400 });

  await db
    .update(userStats)
    .set({
      preferredArtists: artists.join(","),
      onboarded: true,
      updatedAt: new Date(),
    })
    .where(eq(userStats.id, stats.id));

  return NextResponse.json({ success: true, artists });
}

/**
 * Все артисты, которые пользователь так или иначе отметил как любимые:
 *  • выбранные при первом входе
 *  • из истории прослушиваний
 *  • из собственных плейлистов
 */
export async function PUT() {
  try {
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();
    const stats = await getOrCreateStats();
    if (!stats) return NextResponse.json({ artists: [] });

    const preferred = (stats.preferredArtists as string | undefined ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const owner = user
      ? eq(playlists.userId, user.id)
      : and(eq(playlists.guestKey, guestKey), isNull(playlists.userId));

    const fromPlaylists = await db
      .select({ artist: playlistTracks.artist, plays: sql<number>`count(*)::int` })
      .from(playlistTracks)
      .innerJoin(playlists, eq(playlists.id, playlistTracks.playlistId))
      .where(owner)
      .groupBy(playlistTracks.artist)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return NextResponse.json({
      preferred,
      playlistArtists: fromPlaylists.map((x) => x.artist).filter(Boolean),
    });
  } catch {
    return NextResponse.json({ preferred: [], playlistArtists: [] });
  }
}
