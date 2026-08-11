import { NextRequest, NextResponse } from "next/server";
import { cobaltExtract, pipedExtract, youtubeId, type VideoFormat } from "@/lib/videoSources";
import { vkVideoGet, parseVkVideoUrl, isVkConfigured } from "@/lib/vk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ═══════════ TikTok ═══════════ */
async function handleTikTok(url: string) {
  let target = url;

  // Разворачиваем короткие ссылки
  if (/vm\.tiktok\.com|vt\.tiktok\.com/i.test(url)) {
    try {
      const r = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" },
      });
      if (r.url) target = r.url;
    } catch {
      /* оставляем исходную */
    }
  }

  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(target)}&hd=1`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Сервис TikTok временно недоступен" }, { status: 502 });
  }

  const data = await res.json();
  if (data.code !== 0 || !data.data) {
    return NextResponse.json(
      { error: "Видео не найдено. Скопируйте ссылку заново из приложения." },
      { status: 404 }
    );
  }

  const v = data.data;
  const formats: VideoFormat[] = [];
  if (v.hdplay) formats.push({ label: "HD без водяного знака", quality: "HD", url: v.hdplay, type: "video", ext: "mp4" });
  if (v.play) formats.push({ label: "Обычное качество", quality: "SD", url: v.play, type: "video", ext: "mp4" });
  if (v.wmplay) formats.push({ label: "С водяным знаком", quality: "SD", url: v.wmplay, type: "video", ext: "mp4" });
  if (v.music) formats.push({ label: "Только звук", quality: "audio", url: v.music, type: "audio", ext: "mp3" });

  if (formats.length === 0) {
    return NextResponse.json({ error: "Не удалось получить файл" }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    platform: "tiktok",
    title: v.title || "Видео TikTok",
    author: v.author?.nickname || v.author?.unique_id || "Автор",
    cover: v.origin_cover || v.cover || "",
    duration: v.duration || 0,
    formats,
    stats: {
      plays: v.play_count || 0,
      likes: v.digg_count || 0,
      comments: v.comment_count || 0,
      shares: v.share_count || 0,
    },
  });
}

/* ═══════════ YouTube ═══════════ */
async function handleYouTube(url: string) {
  const id = youtubeId(url);
  if (!id) {
    return NextResponse.json({ error: "Не удалось распознать ссылку YouTube" }, { status: 400 });
  }
  const clean = `https://www.youtube.com/watch?v=${id}`;

  // Метаданные
  let title = "Видео YouTube";
  let author = "Автор";
  let cover = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  let duration = 0;

  try {
    const m = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(clean)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (m.ok) {
      const md = await m.json();
      title = md.title || title;
      author = md.author_name || author;
      if (md.thumbnail_url) cover = md.thumbnail_url;
    }
  } catch {
    /* значения по умолчанию */
  }

  const formats: VideoFormat[] = [];

  // Cobalt — сразу готовый файл в нужном качестве
  const wanted = [
    { q: "1080", label: "Видео Full HD 1080p" },
    { q: "720", label: "Видео HD 720p" },
    { q: "360", label: "Видео 360p (лёгкий)" },
  ];

  const cobaltResults = await Promise.all(
    wanted.map(async (w) => ({ w, r: await cobaltExtract(clean, w.q, false) }))
  );

  const seen = new Set<string>();
  for (const { w, r } of cobaltResults) {
    if (r?.url && !seen.has(r.url)) {
      seen.add(r.url);
      formats.push({ label: w.label, quality: `${w.q}p`, url: r.url, type: "video", ext: "mp4" });
    }
  }

  // Аудиодорожка отдельным файлом
  const audio = await cobaltExtract(clean, "1080", true);
  if (audio?.url) {
    formats.push({ label: "Только звук MP3", quality: "audio", url: audio.url, type: "audio", ext: "mp3" });
  }

  // Если Cobalt молчит — пробуем Piped
  if (formats.length === 0) {
    const piped = await pipedExtract(id);
    if (piped) {
      title = piped.title || title;
      author = piped.uploader || author;
      duration = piped.duration;
      if (piped.thumbnail) cover = piped.thumbnail;
      formats.push(...piped.formats);
    }
  }

  return NextResponse.json({
    success: true,
    platform: "youtube",
    title,
    author,
    cover,
    duration,
    videoId: id,
    watchUrl: clean,
    formats,
    note:
      formats.length === 0
        ? "Все зеркала загрузки сейчас перегружены. Попробуйте через минуту."
        : null,
  });
}

/* ═══════════ VK Video ═══════════ */
async function handleVk(url: string) {
  if (!isVkConfigured()) {
    return NextResponse.json({ error: "VK-токен не настроен" }, { status: 503 });
  }

  const parsed = parseVkVideoUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: "Не удалось разобрать ссылку VK" }, { status: 400 });
  }

  const v = await vkVideoGet(parsed.ownerId, parsed.videoId);
  if (!v) {
    return NextResponse.json(
      { error: "Видео недоступно — возможно, оно приватное или удалено" },
      { status: 404 }
    );
  }

  const formats: VideoFormat[] = v.files.map((f) => ({
    label: `Видео ${f.quality}`,
    quality: f.quality,
    url: f.url,
    type: "video" as const,
    ext: "mp4",
  }));

  return NextResponse.json({
    success: true,
    platform: "vk",
    title: v.title || "Видео VK",
    author: v.author || "VK",
    cover: v.thumb,
    duration: v.duration,
    formats,
    // Встраиваемый плеер VK — работает всегда, даже без mp4-файлов
    embedUrl: v.player || null,
    watchUrl: `https://vk.com/video${v.ownerId}_${v.videoId}`,
    stats: { plays: v.views, likes: v.likes, comments: 0, shares: 0 },
    note: formats.length === 0
      ? "Прямые файлы недоступны. Смотрите видео через встроенный плеер VK ниже."
      : null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = String(body.url || "").trim();

    if (!raw) return NextResponse.json({ error: "Введите ссылку на видео" }, { status: 400 });
    if (!/^https?:\/\//i.test(raw)) {
      return NextResponse.json({ error: "Ссылка должна начинаться с http:// или https://" }, { status: 400 });
    }

    if (/tiktok\.com|vm\.tiktok|vt\.tiktok|douyin\.com/i.test(raw)) return await handleTikTok(raw);
    if (/youtube\.com|youtu\.be/i.test(raw)) return await handleYouTube(raw);
    if (/vk\.com|vkvideo\.ru|vk\.ru/i.test(raw)) return await handleVk(raw);

    return NextResponse.json(
      { error: "Поддерживаются ссылки YouTube, TikTok и VK" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Video error:", error);
    return NextResponse.json({ error: "Не удалось обработать видео" }, { status: 500 });
  }
}
