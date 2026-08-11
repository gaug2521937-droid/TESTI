import { NextRequest, NextResponse } from "next/server";

/**
 * Гарантирует, что у каждого посетителя есть guest_key.
 *
 * Без этого история прослушиваний, плейлисты и статистика гостя терялись:
 * cookie ставилась только при первой записи, а параллельные запросы
 * успевали создать разные ключи — данные разъезжались.
 *
 * Важно: middleware работает в Edge-среде, поэтому используем Web Crypto,
 * а не модуль crypto из Node.
 */
function newKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get("guest_key")?.value) {
    response.cookies.set("guest_key", newKey(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|mp3|mp4)$).*)"],
};
