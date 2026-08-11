import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Проверка владения плейлистом
async function ownedPlaylist(id: number) {
  const user = await getCurrentUser();
  const guestKey = await getGuestKey();
  const where = user
    ? and(eq(playlists.id, id), eq(playlists.userId, user.id))
    : and(eq(playlists.id, id), eq(playlists.guestKey, guestKey));
  const [row] = await db.select().from(playlists).where(where).limit(1);
  return row ?? null;
}

// Треки плейлиста
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pid = Number(id);
    if (isNaN(pid)) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const [pl] = await db.select().from(playlists).where(eq(playlists.id, pid)).limit(1);
    if (!pl) return NextResponse.json({ error: "Плейлист не найден" }, { status: 404 });

    const owned = await ownedPlaylist(pid);
    if (!pl.isPublic && !owned) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const tracks = await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, pid))
      .orderBy(asc(playlistTracks.position), asc(playlistTracks.id));

    return NextResponse.json({ playlist: pl, tracks, owned: Boolean(owned) });
  } catch (error) {
    console.error("Playlist tracks error:", error);
    return NextResponse.json({ error: "Ошибка при загрузке треков" }, { status: 500 });
  }
}

// Добавить трек
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pid = Number(id);
    if (isNaN(pid)) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const pl = await ownedPlaylist(pid);
    if (!pl) return NextResponse.json({ error: "Плейлист не найден" }, { status: 404 });

    const t = await request.json();
    if (!t.id || !t.title || !t.streamUrl) {
      return NextResponse.json({ error: "Некорректные данные трека" }, { status: 400 });
    }

    // Не дублируем
    const [dup] = await db
      .select({ id: playlistTracks.id })
      .from(playlistTracks)
      .where(and(eq(playlistTracks.playlistId, pid), eq(playlistTracks.trackId, String(t.id))))
      .limit(1);

    if (dup) {
      return NextResponse.json({ success: true, duplicate: true, message: "Трек уже в плейлисте" });
    }

    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`coalesce(max(${playlistTracks.position}), -1)::int` })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, pid));

    const [added] = await db
      .insert(playlistTracks)
      .values({
        playlistId: pid,
        trackId: String(t.id),
        source: t.source === "audius" ? "audius" : "itunes",
        title: String(t.title).slice(0, 300),
        artist: String(t.artist || "").slice(0, 300),
        album: String(t.album || "").slice(0, 300) || null,
        artwork: t.artworkLarge || t.artwork || null,
        streamUrl: String(t.streamUrl),
        duration: Number(t.duration) || 0,
        genre: String(t.genre || "").slice(0, 100) || null,
        isFull: Boolean(t.isFull),
        position: maxPos + 1,
      })
      .returning();

    return NextResponse.json({ success: true, track: added });
  } catch (error) {
    console.error("Add track error:", error);
    return NextResponse.json({ error: "Ошибка при добавлении трека" }, { status: 500 });
  }
}

// Удалить трек из плейлиста
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pid = Number(id);
    const rowId = Number(request.nextUrl.searchParams.get("trackRowId"));
    if (isNaN(pid) || isNaN(rowId)) {
      return NextResponse.json({ error: "Неверные параметры" }, { status: 400 });
    }

    const pl = await ownedPlaylist(pid);
    if (!pl) return NextResponse.json({ error: "Плейлист не найден" }, { status: 404 });

    await db
      .delete(playlistTracks)
      .where(and(eq(playlistTracks.id, rowId), eq(playlistTracks.playlistId, pid)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove track error:", error);
    return NextResponse.json({ error: "Ошибка при удалении трека" }, { status: 500 });
  }
}
