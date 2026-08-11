import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { getCurrentUser, getGuestKey, newGuestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Список плейлистов текущего владельца (пользователь или гость)
export async function GET() {
  try {
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    const where = user
      ? eq(playlists.userId, user.id)
      : guestKey
      ? eq(playlists.guestKey, guestKey)
      : sql`false`;

    const rows = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        description: playlists.description,
        emoji: playlists.emoji,
        color: playlists.color,
        isPublic: playlists.isPublic,
        createdAt: playlists.createdAt,
        trackCount: sql<number>`(
          select count(*)::int from ${playlistTracks}
          where ${playlistTracks.playlistId} = ${playlists.id}
        )`,
        totalDuration: sql<number>`(
          select coalesce(sum(${playlistTracks.duration}), 0)::int from ${playlistTracks}
          where ${playlistTracks.playlistId} = ${playlists.id}
        )`,
        cover: sql<string | null>`(
          select ${playlistTracks.artwork} from ${playlistTracks}
          where ${playlistTracks.playlistId} = ${playlists.id}
          order by ${playlistTracks.position} asc limit 1
        )`,
      })
      .from(playlists)
      .where(where)
      .orderBy(desc(playlists.createdAt));

    return NextResponse.json({ playlists: rows, isAuthenticated: Boolean(user) });
  } catch (error) {
    console.error("Playlists fetch error:", error);
    return NextResponse.json({ error: "Ошибка при загрузке плейлистов" }, { status: 500 });
  }
}

// Создать плейлист
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (name.length < 1 || name.length > 120) {
      return NextResponse.json(
        { error: "Название должно быть от 1 до 120 символов" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    let guestKey = await getGuestKey();
    let setCookie = false;

    if (!user && !guestKey) {
      // Middleware поставит ключ на следующий запрос, но плейлист нужен сейчас
      guestKey = newGuestKey();
      setCookie = true;
    }
    if (!user && !guestKey) {
      return NextResponse.json({ error: "Не удалось создать сессию гостя" }, { status: 500 });
    }

    // Лимит, чтобы не засорять базу
    const existing = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(playlists)
      .where(user ? eq(playlists.userId, user.id) : eq(playlists.guestKey, guestKey));

    if ((existing[0]?.c ?? 0) >= 60) {
      return NextResponse.json({ error: "Достигнут лимит в 60 плейлистов" }, { status: 400 });
    }

    const [created] = await db
      .insert(playlists)
      .values({
        userId: user?.id ?? null,
        guestKey: user ? null : guestKey,
        name,
        description: String(body.description || "").slice(0, 400) || null,
        emoji: String(body.emoji || "🎵").slice(0, 12),
        color: String(body.color || "#6c5ce7").slice(0, 20),
        isPublic: body.isPublic !== false,
      })
      .returning();

    const response = NextResponse.json({ success: true, playlist: created });
    if (setCookie) {
      response.cookies.set("guest_key", guestKey, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    console.error("Playlist create error:", error);
    return NextResponse.json({ error: "Ошибка при создании плейлиста" }, { status: 500 });
  }
}

// Удалить плейлист
export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    const owner = user
      ? and(eq(playlists.id, id), eq(playlists.userId, user.id))
      : and(eq(playlists.id, id), eq(playlists.guestKey, guestKey));

    const deleted = await db.delete(playlists).where(owner).returning({ id: playlists.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Плейлист не найден" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Playlist delete error:", error);
    return NextResponse.json({ error: "Ошибка при удалении" }, { status: 500 });
  }
}
