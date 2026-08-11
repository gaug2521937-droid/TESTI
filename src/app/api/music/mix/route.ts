import { NextResponse } from "next/server";
import { db } from "@/db";
import { listeningHistory } from "@/db/schema";
import { desc, eq, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { searchAudius, searchArchive, searchCcMixter, dedupe, type ApiTrack } from "@/lib/musicSources";
import { searchYtMusic } from "@/lib/youtubeMusic";
import { getOrCreateStats } from "@/lib/levels";
import { playlistTracks, playlists } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Стартовые артисты, если история пуста */
const SEED_RAP = ["УННВ", "1kla$", "CZAR", "Баста", "Гуф", "Скриптонит", "Miyagi"];

/**
 * Персональный микс.
 * Логика: берём топ артистов из истории → ищем их треки и похожих
 * исполнителей через Deezer related → выкидываем уже прослушанное.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    let topArtists: string[] = [];
    let heard = new Set<string>();
    let basedOn: { artist: string; plays: number }[] = [];
    let sources: string[] = [];

    // Артисты, выбранные при первом входе — с высоким весом
    const stats = await getOrCreateStats();
    const preferred = (stats?.preferredArtists ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (preferred.length > 0) sources.push("выбранные при входе");

    // Артисты из собственных плейлистов
    let fromPlaylists: string[] = [];
    if (user || guestKey) {
      const ownerWhere = user
        ? eq(playlists.userId, user.id)
        : and(eq(playlists.guestKey, guestKey), isNull(playlists.userId));
      const pl = await db
        .select({
          artist: playlistTracks.artist,
          plays: sql<number>`count(*)::int`,
        })
        .from(playlistTracks)
        .innerJoin(playlists, eq(playlists.id, playlistTracks.playlistId))
        .where(ownerWhere)
        .groupBy(playlistTracks.artist)
        .orderBy(desc(sql`count(*)`))
        .limit(5);
      fromPlaylists = pl.map((x) => x.artist).filter(Boolean);
      if (fromPlaylists.length > 0) sources.push("плейлисты");
    }

    if (user || guestKey) {
      const who = user
        ? eq(listeningHistory.userId, user.id)
        : eq(listeningHistory.guestKey, guestKey);

      const rows = await db
        .select({
          artist: listeningHistory.artist,
          plays: sql<number>`count(*)::int`,
        })
        .from(listeningHistory)
        .where(and(who, sql`${listeningHistory.artist} <> ''`))
        .groupBy(listeningHistory.artist)
        .orderBy(desc(sql`count(*)`))
        .limit(6);

      basedOn = rows;
      // Объединяем три источника, история приоритетнее — у неё больше веса
      const combined = new Map<string, number>();
      for (const r of rows) combined.set(r.artist, (combined.get(r.artist) ?? 0) + r.plays * 3);
      for (const a of preferred) combined.set(a, (combined.get(a) ?? 0) + 5);
      for (const a of fromPlaylists) combined.set(a, (combined.get(a) ?? 0) + 2);
      topArtists = [...combined.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a).slice(0, 6);
      if (rows.length > 0) sources.push("прослушано");

      const played = await db
        .select({ trackId: listeningHistory.trackId })
        .from(listeningHistory)
        .where(who)
        .limit(400);
      heard = new Set(played.map((p) => p.trackId));
    }

    // Даже без истории микс персональный, если выбраны артисты
    if (topArtists.length === 0 && preferred.length > 0) {
      topArtists = preferred.slice(0, 6);
      basedOn = preferred.map((a) => ({ artist: a, plays: 0 }));
    }
    if (topArtists.length === 0 && fromPlaylists.length > 0) {
      topArtists = fromPlaylists.slice(0, 6);
    }

    const isPersonal = topArtists.length > 0;
    const queries = isPersonal ? topArtists.slice(0, 5) : SEED_RAP.slice(0, 5);

    // Ищем треки каждого артиста — YouTube даёт настоящие песни, а не каверы
    const batches = await Promise.all(
      queries.flatMap((q) => [searchYtMusic(q, 6), searchAudius(q, 4)])
    );

    // Плюс свежее из архивов, чтобы микс не повторялся
    let similar: ApiTrack[] = [];
    if (isPersonal) {
      const extra = await Promise.all(topArtists.slice(0, 2).map((a) => searchArchive(a, 6)));
      similar = extra.flat();
    }

    // Перемешиваем источники, чтобы микс был разнообразным
    const pool = dedupe([...batches.flat(), ...similar]);
    const fresh = pool.filter((t) => !heard.has(t.id));
    const source = fresh.length >= 20 ? fresh : pool;

    // Тасуем детерминированно-случайно
    const mix = [...source];
    for (let i = mix.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mix[i], mix[j]] = [mix[j], mix[i]];
    }

    // Полные треки поднимаем повыше
    // Все треки полные — сортируем по релевантности вкусу

    return NextResponse.json({
      tracks: mix.slice(0, 40),
      personal: isPersonal,
      basedOn,
      seedArtists: queries,
      sources,
      fullCount: mix.slice(0, 40).length,
    });
  } catch (error) {
    console.error("Mix error:", error);
    return NextResponse.json({ error: "Не удалось собрать микс" }, { status: 500 });
  }
}
