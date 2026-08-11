import { NextResponse } from "next/server";
import { db } from "@/db";
import { casinoHistory } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    let history;
    if (user) {
      // Показываем историю авторизованного пользователя
      history = await db
        .select()
        .from(casinoHistory)
        .where(eq(casinoHistory.userId, user.id))
        .orderBy(desc(casinoHistory.createdAt))
        .limit(50);
    } else {
      // Показываем последние 20 ставок без привязки к пользователю
      history = await db
        .select()
        .from(casinoHistory)
        .orderBy(desc(casinoHistory.createdAt))
        .limit(20);
    }

    return NextResponse.json({ history, isAuthenticated: !!user });
  } catch (error) {
    console.error("Casino history error:", error);
    return NextResponse.json(
      { error: "Ошибка при загрузке истории" },
      { status: 500 }
    );
  }
}
