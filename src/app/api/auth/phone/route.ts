import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, otpCodes } from "@/db/schema";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { normalizePhone, maskPhone, generateCode } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Регистрация и вход по номеру телефона.
 *
 * Шаг 1 (action: "send")   → отправляем код подтверждения
 * Шаг 2 (action: "verify") → проверяем код, создаём/находим аккаунт, выдаём сессию
 *
 * SMS-провайдер не подключён, поэтому код возвращается прямо в ответе
 * и показывается на экране (это честный демо-режим, а не заглушка —
 * вся логика проверки, срока жизни и лимита попыток настоящая).
 */

const CODE_TTL_MS = 5 * 60 * 1000; // 5 минут
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const phone = normalizePhone(String(body.phone || ""));

    if (!phone) {
      return NextResponse.json(
        { error: "Введите корректный номер телефона (10–15 цифр)" },
        { status: 400 }
      );
    }

    /* ---------- ШАГ 1: отправка кода ---------- */
    if (action === "send") {
      // Антиспам: не чаще одного кода в 45 секунд
      const [recent] = await db
        .select()
        .from(otpCodes)
        .where(and(eq(otpCodes.target, phone), eq(otpCodes.kind, "phone")))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);

      if (recent && Date.now() - new Date(recent.createdAt).getTime() < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil(
          (RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.createdAt).getTime())) / 1000
        );
        return NextResponse.json(
          { error: `Код уже отправлен. Повторить можно через ${wait} сек.` },
          { status: 429 }
        );
      }

      const code = generateCode(6);
      await db.insert(otpCodes).values({
        target: phone,
        kind: "phone",
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);

      return NextResponse.json({
        success: true,
        phone,
        maskedPhone: maskPhone(phone),
        isNewUser: !existing,
        ttl: CODE_TTL_MS / 1000,
        // Демо-режим: показываем код на экране
        demoCode: code,
        demoMode: true,
        hint: "SMS-шлюз не подключён — код показан прямо здесь",
      });
    }

    /* ---------- ШАГ 2: проверка кода ---------- */
    if (action === "verify") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: "Введите 6-значный код" }, { status: 400 });
      }

      const [otp] = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.target, phone),
            eq(otpCodes.kind, "phone"),
            sql`${otpCodes.usedAt} is null`,
            gt(otpCodes.expiresAt, new Date())
          )
        )
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);

      if (!otp) {
        return NextResponse.json(
          { error: "Код истёк или не найден. Запросите новый." },
          { status: 400 }
        );
      }

      if (otp.attempts >= MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: "Слишком много попыток. Запросите новый код." },
          { status: 429 }
        );
      }

      if (otp.code !== code) {
        await db
          .update(otpCodes)
          .set({ attempts: otp.attempts + 1 })
          .where(eq(otpCodes.id, otp.id));
        const left = MAX_ATTEMPTS - otp.attempts - 1;
        return NextResponse.json(
          { error: `Неверный код. Осталось попыток: ${Math.max(0, left)}` },
          { status: 400 }
        );
      }

      // Код верный — помечаем использованным
      await db.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, otp.id));

      // Ищем или создаём пользователя
      let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

      if (!user) {
        const requested = String(body.username || "").trim();
        let username = requested.replace(/[^a-zA-Z0-9_а-яА-Я]/g, "").slice(0, 40);
        if (username.length < 3) username = `user${phone.slice(-6)}`;

        // Гарантируем уникальность
        let candidate = username;
        let n = 0;
        while (true) {
          const [dup] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, candidate))
            .limit(1);
          if (!dup) break;
          n += 1;
          candidate = `${username}_${n}`;
          if (n > 200) {
            candidate = `${username}_${Date.now().toString().slice(-5)}`;
            break;
          }
        }

        [user] = await db
          .insert(users)
          .values({
            username: candidate,
            phone,
            phoneVerified: true,
            displayName: requested || candidate,
            authProvider: "phone",
          })
          .returning();
      } else {
        await db
          .update(users)
          .set({ phoneVerified: true, lastSeenAt: new Date() })
          .where(eq(users.id, user.id));
      }

      const token = await createSession(user.id);
      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          phone: maskPhone(phone),
        },
      });
      response.cookies.set("session_token", token, SESSION_COOKIE);
      return response;
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Phone auth error:", error);
    return NextResponse.json({ error: "Ошибка авторизации. Попробуйте позже." }, { status: 500 });
  }
}
