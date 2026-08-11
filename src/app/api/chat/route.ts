import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

// Получить последние 50 сообщений
export async function GET() {
  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);

    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Chat fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке сообщений" },
      { status: 500 }
    );
  }
}

// Отправить сообщение
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, username: providedUsername } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Введите сообщение" },
        { status: 400 }
      );
    }

    if (message.trim().length > 1000) {
      return NextResponse.json(
        { error: "Сообщение слишком длинное (макс. 1000 символов)" },
        { status: 400 }
      );
    }

    // Определяем имя пользователя
    let username = "Аноним";
    const user = await getCurrentUser();
    if (user) {
      username = user.displayName || user.username;
    } else if (providedUsername && typeof providedUsername === "string" && providedUsername.trim().length > 0) {
      username = providedUsername.trim().slice(0, 50);
    }

    // Сохраняем сообщение
    const [msg] = await db
      .insert(chatMessages)
      .values({
        userId: user?.id ?? null,
        username,
        avatarUrl: user?.avatarUrl ?? null,
        message: message.trim(),
      })
      .returning();

    return NextResponse.json({ success: true, message: msg });
  } catch (error) {
    console.error("Chat send error:", error);
    return NextResponse.json(
      { error: "Ошибка при отправке сообщения" },
      { status: 500 }
    );
  }
}
