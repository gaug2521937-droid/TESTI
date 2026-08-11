import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { listeningHistory } from "@/db/schema";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { getCurrentUser, getGuestKey, newGuestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Условие «мои записи»: по аккаунту или по гостевому ключу */
async function scope() {
  const user = await getCurrentUser();
  const guestKey = await getGuestKey();
  return { user, guestKey };
}

/** GET — история и статистика вкусов */
export async function GET(request: NextRequest) {
  try {
    const { user, guestKey } = await scope();
    const mode = request.nextUrl.searchParams.get("mode") || "recent";

    if (!user && !guestKey) {
      return NextResponse.json({ history: [], topArtists: [], topGenres: [], total: 0 });
    }

    const who = user
      ? eq(listeningHistory.userId, user.id)
      : eq(listeningHistory.guestKey, guestKey);

    /* Топ артистов — основа рекомендаций */
    if (mode === "taste") {
      const topArtists = await db
        .select({
          artist: listeningHistory.artist,
          plays: sql<number>`count(*)::int`,
          seconds: sql<number>`coalesce(sum(${listeningHistory.playedSeconds}),0)::int`,
        })
        .from(listeningHistory)
        .where(who)
        .groupBy(listeningHistory.artist)
        .orderBy(desc(sql`count(*)`))
        .limit(12);

      const topGenres = await db
        .select({
          genre: listeningHistory.genre,
          plays: sql<number>`count(*)::int`,
        })
        .from(listeningHistory)
        .where(and(who, sql`${listeningHistory.genre} is not null and ${listeningHistory.genre} <> ''`))
        .groupBy(listeningHistory.genre)
        .orderBy(desc(sql`count(*)`))
        .limit(8);

      const [totals] = await db
        .select({
          total: sql<number>`count(*)::int`,
          seconds: sql<number>`coalesce(sum(${listeningHistory.playedSeconds}),0)::int`,
          artists: sql<number>`count(distinct ${listeningHistory.artist})::int`,
        })
        .from(listeningHistory)
        .where(who);

      return NextResponse.json({
        topArtists,
        topGenres,
        total: totals?.total ?? 0,
        seconds: totals?.seconds ?? 0,
        uniqueArtists: totals?.artists ?? 0,
      });
    }

    /* Недавно прослушанное (без повторов подряд) */
    const history = await db
      .select()
      .from(listeningHistory)
      .where(who)
      .orderBy(desc(listeningHistory.playedAt))
      .limit(60);

    const seen = new Set<string>();
    const unique = history.filter((h) => {
      if (seen.has(h.trackId)) return false;
      seen.add(h.trackId);
      return true;
    });

    return NextResponse.json({ history: unique.slice(0, 30), total: history.length });
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json({ error: "Ошибка истории" }, { status: 500 });
  }
}

/** POST — записать прослушивание */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const t = body.track;
    if (!t?.id || !t?.title) {
      return NextResponse.json({ error: "Нет данных трека" }, { status: 400 });
    }

    const user = await getCurrentUser();
    let guestKey = await getGuestKey();
    let setCookie = false;
    if (!user && !guestKey) {
      guestKey = newGuestKey();
      setCookie = true;
    }

    // Не дублируем один и тот же трек чаще раза в 2 минуты
    const who = user
      ? eq(listeningHistory.userId, user.id)
      : eq(listeningHistory.guestKey, guestKey);

    const [recent] = await db
      .select({ id: listeningHistory.id })
      .from(listeningHistory)
      .where(
        and(
          who,
          eq(listeningHistory.trackId, String(t.id)),
          gte(listeningHistory.playedAt, new Date(Date.now() - 2 * 60 * 1000))
        )
      )
      .limit(1);

    if (recent) {
      // Обновляем длительность прослушивания
      if (body.playedSeconds) {
        await db
          .update(listeningHistory)
          .set({ playedSeconds: Math.round(Number(body.playedSeconds)) })
          .where(eq(listeningHistory.id, recent.id));
      }
      const res = NextResponse.json({ success: true, updated: true });
      if (setCookie) {
        res.cookies.set("guest_key", guestKey, {
          httpOnly: true, sameSite: "lax", maxAge: 365 * 24 * 60 * 60, path: "/",
        });
      }
      return res;
    }

    await db.insert(listeningHistory).values({
      userId: user?.id ?? null,
      guestKey: user ? null : guestKey,
      trackId: String(t.id),
      source: String(t.source || "unknown").slice(0, 20),
      title: String(t.title).slice(0, 300),
      artist: String(t.artist || "").slice(0, 300),
      artwork: t.artworkLarge || t.artwork || null,
      streamUrl: t.streamUrl || null,
      duration: Number(t.duration) || 0,
      genre: String(t.genre || "").slice(0, 100) || null,
      playedSeconds: Math.round(Number(body.playedSeconds) || 0),
    });

    // Держим историю компактной
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(listeningHistory)
      .where(who);

    if (c > 600) {
      await db.execute(sql`
        delete from listening_history where id in (
          select id from listening_history
          where ${user ? sql`user_id = ${user.id}` : sql`guest_key = ${guestKey}`}
          order by played_at asc limit 200
        )
      `);
    }

    const res = NextResponse.json({ success: true });
    if (setCookie) {
      res.cookies.set("guest_key", guestKey, {
        httpOnly: true, sameSite: "lax", maxAge: 365 * 24 * 60 * 60, path: "/",
      });
    }
    return res;
  } catch (error) {
    console.error("History save error:", error);
    return NextResponse.json({ error: "Не удалось записать" }, { status: 500 });
  }
}

/** DELETE — очистить историю */
export async function DELETE() {
  try {
    const { user, guestKey } = await scope();
    if (!user && !guestKey) return NextResponse.json({ success: true });

    await db
      .delete(listeningHistory)
      .where(user ? eq(listeningHistory.userId, user.id) : eq(listeningHistory.guestKey, guestKey));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка очистки" }, { status: 500 });
  }
}
