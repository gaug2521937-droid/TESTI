import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notes, noteLikes, users } from "@/db/schema";
import { desc, eq, sql, and, or, ilike } from "drizzle-orm";
import { getCurrentUser, getGuestKey, newGuestKey } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
  "video/mp4", "video/webm",
];

/**
 * GET ?feed=my      → мои посты
 * GET ?feed=public  → общая лента
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();
    const feed = request.nextUrl.searchParams.get("feed") || "my";
    const q = (request.nextUrl.searchParams.get("q") || "").trim();

    const base = {
      id: notes.id,
      userId: notes.userId,
      authorName: notes.authorName,
      title: notes.title,
      text: notes.text,
      filePath: notes.filePath,
      fileType: notes.fileType,
      isPublic: notes.isPublic,
      pinned: notes.pinned,
      tags: notes.tags,
      likes: notes.likes,
      views: notes.views,
      createdAt: notes.createdAt,
      username: users.username,
      avatarUrl: users.avatarUrl,
    };

    const mine = user
      ? eq(notes.userId, user.id)
      : guestKey
      ? eq(notes.guestKey, guestKey)
      : sql`false`;

    const where =
      feed === "public"
        ? q
          ? and(eq(notes.isPublic, true), or(ilike(notes.text, `%${q}%`), ilike(notes.title, `%${q}%`)))
          : eq(notes.isPublic, true)
        : q
        ? and(mine, or(ilike(notes.text, `%${q}%`), ilike(notes.title, `%${q}%`)))
        : mine;

    const rows = await db
      .select(base)
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(where)
      .orderBy(desc(notes.pinned), desc(notes.createdAt))
      .limit(80);

    // Что уже лайкнуто
    let likedIds: number[] = [];
    if (rows.length > 0 && (user || guestKey)) {
      const liked = await db
        .select({ noteId: noteLikes.noteId })
        .from(noteLikes)
        .where(user ? eq(noteLikes.userId, user.id) : eq(noteLikes.guestKey, guestKey));
      likedIds = liked.map((l) => l.noteId);
    }

    const posts = rows.map((r) => ({
      ...r,
      author: r.authorName || r.username || "Аноним",
      isMine: user ? r.userId === user.id : false,
      liked: likedIds.includes(r.id),
    }));

    return NextResponse.json({ posts, isAuthenticated: Boolean(user), feed });
  } catch (error) {
    console.error("Notes fetch error:", error);
    return NextResponse.json({ error: "Ошибка при загрузке постов" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    let guestKey = await getGuestKey();
    let setCookie = false;
    if (!user && !guestKey) {
      guestKey = newGuestKey();
      setCookie = true;
    }

    const formData = await request.formData();
    const title = (formData.get("title") as string | null)?.trim() || null;
    const text = (formData.get("text") as string | null)?.trim() || null;
    const tags = (formData.get("tags") as string | null)?.trim() || null;
    const authorName = (formData.get("authorName") as string | null)?.trim() || null;
    const isPublic = formData.get("isPublic") === "true";
    const file = formData.get("file") as File | null;

    if (!text && !file && !title) {
      return NextResponse.json({ error: "Напишите текст или прикрепите файл" }, { status: 400 });
    }

    let filePath: string | null = null;
    let fileType: string | null = null;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Поддерживаются изображения, аудио и видео" }, { status: 400 });
      }

      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      const ext = path.extname(file.name) || ".bin";
      const uniq = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
      await writeFile(path.join(dir, uniq), Buffer.from(await file.arrayBuffer()));

      filePath = `/uploads/${uniq}`;
      fileType = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/")
        ? "audio"
        : "video";
    }

    const [post] = await db
      .insert(notes)
      .values({
        userId: user?.id ?? null,
        guestKey: user ? null : guestKey,
        authorName: user ? user.displayName || user.username : authorName || "Аноним",
        title: title?.slice(0, 200) ?? null,
        text,
        filePath,
        fileType,
        tags: tags?.slice(0, 200) ?? null,
        isPublic,
      })
      .returning();

    const res = NextResponse.json({ success: true, post });
    if (setCookie) {
      res.cookies.set("guest_key", guestKey, {
        httpOnly: true, sameSite: "lax", maxAge: 365 * 24 * 60 * 60, path: "/",
      });
    }
    return res;
  } catch (error) {
    console.error("Note create error:", error);
    return NextResponse.json({ error: "Не удалось опубликовать" }, { status: 500 });
  }
}

/** Лайк и закрепление */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const action = String(body.action || "");
    if (!id) return NextResponse.json({ error: "Неверный ID" }, { status: 400 });

    const user = await getCurrentUser();
    const guestKey = await getGuestKey();

    if (action === "like") {
      const who = user ? eq(noteLikes.userId, user.id) : eq(noteLikes.guestKey, guestKey);
      const [existing] = await db
        .select({ id: noteLikes.id })
        .from(noteLikes)
        .where(and(eq(noteLikes.noteId, id), who))
        .limit(1);

      if (existing) {
        await db.delete(noteLikes).where(eq(noteLikes.id, existing.id));
        await db.update(notes).set({ likes: sql`greatest(${notes.likes} - 1, 0)` }).where(eq(notes.id, id));
        return NextResponse.json({ success: true, liked: false });
      }

      await db.insert(noteLikes).values({
        noteId: id,
        userId: user?.id ?? null,
        guestKey: user ? null : guestKey,
      });
      await db.update(notes).set({ likes: sql`${notes.likes} + 1` }).where(eq(notes.id, id));
      return NextResponse.json({ success: true, liked: true });
    }

    if (action === "pin" || action === "publish") {
      const owner = user ? eq(notes.userId, user.id) : eq(notes.guestKey, guestKey);
      const [note] = await db.select().from(notes).where(and(eq(notes.id, id), owner)).limit(1);
      if (!note) return NextResponse.json({ error: "Пост не найден" }, { status: 404 });

      const patch = action === "pin" ? { pinned: !note.pinned } : { isPublic: !note.isPublic };
      await db.update(notes).set({ ...patch, updatedAt: new Date() }).where(eq(notes.id, id));
      return NextResponse.json({ success: true, ...patch });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Note patch error:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
