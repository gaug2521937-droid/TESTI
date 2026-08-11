import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Прокси аудиопотока.
 * Зачем: браузер запрещает Web Audio API анализировать звук с чужого домена
 * без CORS. Проксируя поток через свой сервер, мы делаем его same-origin —
 * и визуализатор (полоски под музыку) начинает работать.
 * Поддерживает Range-запросы, чтобы работала перемотка.
 */

const ALLOWED_HOSTS = [
  "audius.co",
  "audius-content",
  "theblueprint.xyz",
  "figment.io",
  "creatorseed.com",
  "audius-creator",
  "audius.prod",
  "mp3.audius",
  "audio-ssl.itunes.apple.com",
  "audio.itunes.apple.com",
  "itunes.apple.com",
  "mzstatic.com",
  // Deezer CDN
  "dzcdn.net",
  "cdns-preview",
  "deezer.com",
  // Internet Archive
  "archive.org",
  "iaserver",
  "us.archive.org",
  // ccMixter
  "ccmixter.org",
  "tunetrack.net",
];

function hostAllowed(u: string) {
  try {
    const { hostname } = new URL(u);
    return ALLOWED_HOSTS.some((h) => hostname.includes(h));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const src = p.get("src");

  let upstream: string | null = null;

  if (src === "audius") {
    const id = p.get("id");
    if (!id) return new Response("Не указан ID трека", { status: 400 });
    upstream = `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream?app_name=GASHPROJECT`;
  } else if (src === "archive") {
    const id = p.get("id");
    const file = p.get("file");
    if (!id || !file) return new Response("Не указан файл", { status: 400 });
    upstream = `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(file)}`;
  } else if (src === "ccmixter" || src === "itunes" || src === "deezer") {
    const url = p.get("url");
    if (!url || !hostAllowed(url)) {
      return new Response("Недопустимый источник", { status: 400 });
    }
    upstream = url;
  } else {
    return new Response("Неизвестный источник", { status: 400 });
  }

  const range = request.headers.get("range");

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        ...(range ? { Range: range } : {}),
        // Без нормального UA и Referer ccMixter отдаёт 403
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: src === "ccmixter" ? "https://ccmixter.org/" : "https://archive.org/",
        Accept: "audio/*,*/*",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response("Не удалось получить аудиопоток", { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstreamRes.headers.get("content-type") || "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Access-Control-Allow-Origin", "*");

    const len = upstreamRes.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const cr = upstreamRes.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error("Stream proxy error:", error);
    return new Response("Ошибка потоковой передачи", { status: 500 });
  }
}
