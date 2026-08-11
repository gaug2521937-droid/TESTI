import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const noteId = parseInt(id);
    if (isNaN(noteId)) {
      return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
    }

    const user = await getCurrentUser();

    // Получаем заметку
    const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);

    if (!note) {
      return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
    }

    // Проверяем права: владелец по аккаунту либо по гостевому ключу
    const guestKey = await getGuestKey();
    const owns = user ? note.userId === user.id : Boolean(guestKey) && note.guestKey === guestKey;
    if (!owns) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    // Удаляем файл если есть
    if (note.filePath) {
      try {
        const fullPath = path.join(process.cwd(), "public", note.filePath);
        await unlink(fullPath);
      } catch {
        // Файл может уже не существовать
      }
    }

    await db.delete(notes).where(eq(notes.id, noteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Note delete error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении заметки" },
      { status: 500 }
    );
  }
}
