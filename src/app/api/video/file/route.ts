import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Прокси скачивания: отдаёт файл с заголовком attachment,
 * чтобы браузер сохранял видео, а не открывал его во вкладке.
 */
const ALLOWED = [
  // TikTok
  "tikwm.com", "tiktokcdn", "byteicdn", "muscdn", "bytecdn", "tiktokv.com",
  // Зеркала Cobalt (отдают готовый файл туннелем)
  "cobalt.tools", "kwiatekmiki.com", "nichind.dev", "eepy.today", "ayo.tf",
  "255x.ru", "c0b4lt.ru",
  // Piped и YouTube CDN
  "googlevideo.com", "youtube.com", "ytimg.com", "private.coffee",
  "adminforge.de", "kavin.rocks", "drgns.space", "odycdn.com",
  // VK Video CDN — файлы приходят с окко-хостов и vk-подсетей
  "vk.com", "vkuservideo.net", "vkvideo.ru", "userapi.com", "vk-cdn.net",
  "mycdn.me", "okcdn.ru", "vkvd", "video.vkuseraudio.net",
];

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("url");
  const name = request.nextUrl.searchParams.get("name") || "video.mp4";

  if (!src) return new Response("Не указан файл", { status: 400 });

  let host = "";
  try {
    host = new URL(src).hostname;
  } catch {
    return new Response("Некорректная ссылка", { status: 400 });
  }
  // Cobalt отдаёт туннель по IP-адресу — пропускаем такие ссылки,
  // если в пути есть характерный маркер /tunnel
  const isTunnel = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && src.includes("/tunnel");
  if (!isTunnel && !ALLOWED.some((h) => host.includes(h))) {
    return new Response("Источник не разрешён", { status: 403 });
  }

  try {
    const range = request.headers.get("range");
    const upstream = await fetch(src, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(180000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response("Не удалось скачать файл", { status: 502 });
    }

    const safe = name.replace(/[^\w\-. ]+/g, "_").slice(0, 80);
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    headers.set("Content-Disposition", `attachment; filename="${safe}"`);
    headers.set("Accept-Ranges", "bytes");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);

    return new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch {
    return new Response("Ошибка скачивания", { status: 500 });
  }
}
