import { NextRequest, NextResponse } from "next/server";
import {
  vkVideoSearch,
  vkVideoGet,
  parseVkVideoUrl,
  vkGroupSearch,
  vkNewsSearch,
  vkArtistClips,
  vkHints,
  isVkConfigured,
} from "@/lib/vk";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

/**
 * VK: поиск клипов, сообществ и записей.
 * Аудио через VK недоступно — методы audio.* закрыты для сторонних
 * приложений, поэтому музыку берём из других источников.
 */
export async function GET(request: NextRequest) {
  if (!isVkConfigured()) {
    return NextResponse.json({ error: "VK-токен не настроен", configured: false }, { status: 503 });
  }

  const p = request.nextUrl.searchParams;
  const mode = p.get("mode") || "video";
  const q = (p.get("q") || "").trim();

  try {
    /* Клипы и видео */
    if (mode === "video") {
      if (!q) return NextResponse.json({ videos: [] });
      const videos = await vkVideoSearch(q, {
        count: Math.min(Number(p.get("count") || 24), 50),
        hd: p.get("hd") === "1",
        sort: Number(p.get("sort") || 2),
      });
      return NextResponse.json({ videos, total: videos.length, query: q });
    }

    /* Конкретное видео по ссылке */
    if (mode === "one") {
      const parsed = parseVkVideoUrl(p.get("url") || "");
      if (!parsed) return NextResponse.json({ error: "Не удалось разобрать ссылку" }, { status: 400 });
      const video = await vkVideoGet(parsed.ownerId, parsed.videoId);
      if (!video) return NextResponse.json({ error: "Видео недоступно или закрыто" }, { status: 404 });
      return NextResponse.json({ video });
    }

    /* Клипы конкретного артиста */
    if (mode === "artist") {
      if (!q) return NextResponse.json({ videos: [] });
      const videos = await vkArtistClips(q, Math.min(Number(p.get("count") || 12), 24));
      return NextResponse.json({ videos, total: videos.length, artist: q });
    }

    /* Подсказки поиска */
    if (mode === "hints") {
      const hints = await vkHints(q || "музыка", 8);
      return NextResponse.json({ hints });
    }

    /* Сообщества */
    if (mode === "groups") {
      const groups = await vkGroupSearch(q || "музыка", 14);
      return NextResponse.json({ groups });
    }

    /* Записи из ленты */
    if (mode === "posts") {
      const posts = await vkNewsSearch(q || "новый альбом", 20);
      return NextResponse.json({ posts });
    }

    return NextResponse.json({ error: "Неизвестный режим" }, { status: 400 });
  } catch (error) {
    console.error("VK error:", error);
    return NextResponse.json({ error: "Ошибка запроса к VK" }, { status: 502 });
  }
}
