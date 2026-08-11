import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { directMessages, users } from "@/db/schema";
import { eq, and, or, desc, asc, sql, ne, ilike } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { publish, touch, isOnline } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Требуется вход в аккаунт" }, { status: 401 });
    }
    touch(me.id);

    const p = request.nextUrl.searchParams;
    const search = p.get("search");
    const withUser = p.get("with");

    /* --- Поиск собеседников --- */
    if (search !== null) {
      const q = search.trim();
      const found = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          authProvider: users.authProvider,
          lastSeenAt: users.lastSeenAt,
        })
        .from(users)
        .where(
          q.length > 0
            ? and(
                ne(users.id, me.id),
                or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`))
              )
            : ne(users.id, me.id)
        )
        .orderBy(desc(users.lastSeenAt))
        .limit(25);

      return NextResponse.json({
        users: found.map((u) => ({ ...u, online: isOnline(u.id) })),
      });
    }

    /* --- Переписка --- */
    if (withUser) {
      const otherId = Number(withUser);
      if (isNaN(otherId)) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

      const [other] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          lastSeenAt: users.lastSeenAt,
        })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1);

      if (!other) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

      const thread = await db
        .select()
        .from(directMessages)
        .where(
          or(
            and(eq(directMessages.senderId, me.id), eq(directMessages.recipientId, otherId)),
            and(eq(directMessages.senderId, otherId), eq(directMessages.recipientId, me.id))
          )
        )
        .orderBy(asc(directMessages.createdAt))
        .limit(300);

      // Помечаем прочитанными и уведомляем отправителя
      const updated = await db
        .update(directMessages)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(directMessages.senderId, otherId),
            eq(directMessages.recipientId, me.id),
            sql`${directMessages.readAt} is null`
          )
        )
        .returning({ id: directMessages.id });

      if (updated.length > 0) publish(otherId, { type: "read", byUserId: me.id });

      return NextResponse.json({
        messages: thread,
        peer: { ...other, online: isOnline(other.id) },
        meId: me.id,

      });
    }

    /* --- Список диалогов --- */
    const rows = await db.execute(sql`
      with partners as (
        select case when sender_id = ${me.id} then recipient_id else sender_id end as pid,
               max(id) as last_id
        from direct_messages
        where sender_id = ${me.id} or recipient_id = ${me.id}
        group by pid
      )
      select
        u.id, u.username, u.display_name as "displayName",
        u.avatar_url as "avatarUrl", u.last_seen_at as "lastSeenAt",
        dm.text as "lastText", dm.created_at as "lastAt",
        dm.sender_id as "lastSenderId",
        (select count(*)::int from direct_messages d
          where d.sender_id = u.id and d.recipient_id = ${me.id} and d.read_at is null
        ) as "unread"
      from partners p
      join users u on u.id = p.pid
      join direct_messages dm on dm.id = p.last_id
      order by dm.created_at desc
      limit 60
    `);

    const conversations = (rows.rows as Record<string, unknown>[]).map((c) => ({
      ...c,
      online: isOnline(Number(c.id)),
    }));

    return NextResponse.json({
      conversations,
      meId: me.id,

    });
  } catch (error) {
    console.error("Messages error:", error);
    return NextResponse.json({ error: "Ошибка при загрузке сообщений" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Требуется вход в аккаунт" }, { status: 401 });
    touch(me.id);

    const body = await request.json();

    /* --- Индикатор набора текста --- */
    if (body.action === "typing") {
      const to = Number(body.recipientId);
      if (to && !isNaN(to)) {
        publish(to, {
          type: "typing",
          fromUserId: me.id,
          fromName: me.displayName || me.username,
        });
      }
      return NextResponse.json({ ok: true });
    }

    const recipientId = Number(body.recipientId);
    const text = String(body.text || "").trim();

    if (!recipientId || isNaN(recipientId))
      return NextResponse.json({ error: "Не указан получатель" }, { status: 400 });
    if (recipientId === me.id)
      return NextResponse.json({ error: "Нельзя писать самому себе" }, { status: 400 });
    if (text.length === 0) return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
    if (text.length > 2000)
      return NextResponse.json({ error: "Сообщение слишком длинное (макс. 2000)" }, { status: 400 });

    const [recipient] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    if (!recipient) return NextResponse.json({ error: "Получатель не найден" }, { status: 404 });

    const [msg] = await db
      .insert(directMessages)
      .values({
        senderId: me.id,
        recipientId,
        text,
      })
      .returning();

    // Мгновенная доставка обеим сторонам через SSE
    publish(recipientId, { type: "dm", message: msg });
    publish(me.id, { type: "dm", message: msg });

    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, me.id));

    return NextResponse.json({
      success: true,
      message: msg,
      recipientOnline: isOnline(recipientId),
    });
  } catch (error) {
    console.error("Send DM error:", error);
    return NextResponse.json({ error: "Ошибка при отправке сообщения" }, { status: 500 });
  }
}
