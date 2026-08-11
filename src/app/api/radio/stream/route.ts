import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Прокси радиопотока.
 *
 * Решает две проблемы:
 *  1. Половина станций вещает по http:// — браузер блокирует это на https-сайте
 *  2. Многие серверы отдают 403 без нормального User-Agent
 *
 * Дополнительно пробуем резервный адрес, если основной молчит.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function tryFetch(url: string, range: string | null) {
  return fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "audio/mpeg, audio/aac, audio/ogg, audio/*, */*",
      "Icy-MetaData": "1",
      ...(range ? { Range: range } : {}),
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("url");
  const alt = request.nextUrl.searchParams.get("alt");
  if (!src) return new Response("Не указан поток", { status: 400 });

  const candidates = [src, alt].filter(Boolean) as string[];
  const range = request.headers.get("range");

  for (const raw of candidates) {
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol)) continue;

    try {
      let upstream = await tryFetch(target.toString(), range);

      // Некоторые серверы не любят Range на живом эфире
      if (!upstream.ok && range) {
        upstream = await tryFetch(target.toString(), null);
      }

      // Плейлист .m3u/.pls — вытаскиваем первую реальную ссылку
      const ct = upstream.headers.get("content-type") || "";
      if (
        upstream.ok &&
        (ct.includes("mpegurl") || ct.includes("scpls") || /\.(m3u8?|pls)$/i.test(target.pathname))
      ) {
        const text = await upstream.text();
        const inner = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .map((l) => (l.startsWith("File") ? l.split("=")[1] : l))
          .find((l) => l && /^https?:\/\//i.test(l));
        if (inner) {
          upstream = await tryFetch(inner, null);
        }
      }

      if (!upstream.ok || !upstream.body) continue;

      const headers = new Headers();
      const type = upstream.headers.get("content-type") || "audio/mpeg";
      headers.set(
        "Content-Type",
        /audio|ogg|aac|mpeg/i.test(type) ? type : "audio/mpeg"
      );
      headers.set("Cache-Control", "no-store, no-transform");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-Accel-Buffering", "no");
      headers.set("Connection", "keep-alive");

      const icy = upstream.headers.get("icy-name");
      if (icy) headers.set("X-Station-Name", encodeURIComponent(icy));

      return new Response(upstream.body, { status: 200, headers });
    } catch {
      continue;
    }
  }

  return new Response("Станция не отвечает", { status: 504 });
}
