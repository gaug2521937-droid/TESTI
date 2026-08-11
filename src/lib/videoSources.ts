/**
 * Извлечение прямых ссылок на файлы видео.
 * Работает через публичные зеркала Cobalt и Piped — без ключей.
 */

export interface VideoFormat {
  label: string;
  quality: string;
  url: string;
  type: "video" | "audio";
  ext: string;
  size?: number;
}

/** Зеркала Cobalt — основной способ, отдаёт готовый MP4 */
const COBALT_HOSTS = [
  "https://dwnld.nichind.dev",
  "https://cobalt-api.kwiatekmiki.com",
  "https://api.cobalt.tools",
  "https://co.eepy.today",
  "https://cobalt-api.ayo.tf",
];

/** Зеркала Piped — запасной способ, даёт список потоков */
const PIPED_HOSTS = [
  "https://api.piped.private.coffee",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.drgns.space",
];

interface CobaltReply {
  status?: string;
  url?: string;
  filename?: string;
  picker?: Array<{ url?: string; type?: string }>;
  error?: { code?: string };
}

/** Один запрос к Cobalt */
async function cobaltOnce(
  host: string,
  url: string,
  quality: string,
  audioOnly: boolean
): Promise<{ url: string; filename?: string } | null> {
  try {
    const res = await fetch(`${host}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "GASHPROJECT/6.0",
      },
      body: JSON.stringify({
        url,
        videoQuality: quality,
        downloadMode: audioOnly ? "audio" : "auto",
        audioFormat: "mp3",
        filenameStyle: "basic",
        youtubeVideoCodec: "h264",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(22000),
    });

    if (!res.ok) return null;
    const d = (await res.json()) as CobaltReply;

    if (d.status === "tunnel" || d.status === "redirect" || d.status === "stream") {
      return d.url ? { url: d.url, filename: d.filename } : null;
    }
    if (d.status === "picker" && d.picker?.[0]?.url) {
      return { url: d.picker[0].url };
    }
    return null;
  } catch {
    return null;
  }
}

/** Перебираем зеркала, пока какое-нибудь не ответит */
export async function cobaltExtract(
  url: string,
  quality = "1080",
  audioOnly = false
): Promise<{ url: string; filename?: string } | null> {
  for (const host of COBALT_HOSTS) {
    const r = await cobaltOnce(host, url, quality, audioOnly);
    if (r) return r;
  }
  return null;
}

interface PipedStream {
  url?: string;
  quality?: string;
  format?: string;
  mimeType?: string;
  videoOnly?: boolean;
  contentLength?: number;
  bitrate?: number;
}

interface PipedReply {
  title?: string;
  uploader?: string;
  duration?: number;
  thumbnailUrl?: string;
  videoStreams?: PipedStream[];
  audioStreams?: PipedStream[];
}

/** Метаданные и потоки через Piped */
export async function pipedExtract(videoId: string): Promise<{
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
  formats: VideoFormat[];
} | null> {
  for (const host of PIPED_HOSTS) {
    try {
      const res = await fetch(`${host}/streams/${videoId}`, {
        headers: { Accept: "application/json", "User-Agent": "GASHPROJECT/6.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(14000),
      });
      if (!res.ok) continue;

      const d = (await res.json()) as PipedReply;
      const formats: VideoFormat[] = [];

      // Видео со звуком
      for (const s of d.videoStreams ?? []) {
        if (s.videoOnly || !s.url) continue;
        if (!/mp4|webm/i.test(s.format ?? "")) continue;
        formats.push({
          label: `Видео ${s.quality ?? ""}`.trim(),
          quality: s.quality ?? "auto",
          url: s.url,
          type: "video",
          ext: /webm/i.test(s.format ?? "") ? "webm" : "mp4",
          size: s.contentLength,
        });
      }

      // Аудиодорожки
      const audio = (d.audioStreams ?? [])
        .filter((s) => s.url)
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      if (audio[0]?.url) {
        formats.push({
          label: "Только звук",
          quality: audio[0].quality ?? "audio",
          url: audio[0].url,
          type: "audio",
          ext: /webm|opus/i.test(audio[0].format ?? "") ? "webm" : "m4a",
          size: audio[0].contentLength,
        });
      }

      if (formats.length === 0) continue;

      return {
        title: d.title ?? "Видео",
        uploader: d.uploader ?? "",
        duration: d.duration ?? 0,
        thumbnail: d.thumbnailUrl ?? "",
        formats,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** ID видео из любой формы ссылки YouTube */
export function youtubeId(url: string): string | null {
  const pats = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of pats) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
