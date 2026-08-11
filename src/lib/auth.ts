import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

export interface SessionUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  phone: string | null;
  authProvider: string;
  createdAt: Date;
}

// Текущий пользователь по cookie-сессии
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return null;

    const result = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        phone: users.phone,
        authProvider: users.authProvider,
        createdAt: users.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return result[0] ?? null;
  } catch {
    return null;
  }
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });
  return token;
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// Стабильный ключ для гостей — чтобы плейлисты гостя не смешивались с чужими
export async function getGuestKey(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get("guest_key")?.value ?? "";
}

export function newGuestKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Настройки cookie сессии
export const SESSION_COOKIE = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60,
  path: "/",
};
