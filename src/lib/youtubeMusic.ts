import type { ApiTrack } from "./musicSources";

/**
 * Музыка из YouTube Music через открытые зеркала Piped.
 *
 * Почему это лучший источник:
 *  • артист и название разделены корректно (uploaderName / title),
 *    в отличие от Audius, где всё свалено в одну строку
 *  • есть любой исполнитель — от Эминема до УННВ
 *  • трек играет ЦЕЛИКОМ через официальный встроенный плеер YouTube
 */

const PIPED_HOSTS = [
  "https://api.piped.private.coffee",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.drgns.space",
];

interface PipedItem {
  type?: string;
  url?: string;
  title?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  duration?: number;
  thumbnail?: string;
  views?: number;
  uploaderVerified?: boolean;
}

/** Достаём id ролика из ссылки Piped */
function videoId(url: string): string {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : "";
}

/** Чистим название от служебных пометок */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[([]\s*(official|lyric|music|audio|video|hd|4k|mv|clip|премьера|клип)[^)\]]*[)\]]/gi, " ")
    .replace(/\s*[|｜]\s*(official|lyrics?|audio|video).*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Убираем " - Topic" у авто-каналов YouTube Music */
function cleanArtist(raw: string): string {
  return raw.replace(/\s*[-–—]\s*topic\s*$/i, "").replace(/\s*VEVO\s*$/i, "").trim();
}

function mapItem(i: PipedItem): ApiTrack | null {
  if (!i.url || !i.title) return null;
  const id = videoId(i.url);
  if (!id) return null;

  let artist = cleanArtist(i.uploaderName ?? "");
  let title = cleanTitle(i.title);

  // Иногда название приходит как "Артист - Трек" при пустом канале
  if (title.includes(" - ") && (!artist || artist.length < 2)) {
    const [a, ...rest] = title.split(" - ");
    artist = a.trim();
    title = rest.join(" - ").trim();
  }

  // Если канал повторяется в начале названия — убираем дубль
  if (artist && title.toLowerCase().startsWith(artist.toLowerCase() + " - ")) {
    title = title.slice(artist.length + 3).trim();
  }

  return {
    id: `ytm:${id}`,
    source: "ytmusic",
    title: title || i.title,
    artist: artist || "Неизвестный исполнитель",
    album: "",
    artwork: i.thumbnail ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    artworkLarge: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    // Поток не нужен: плеер сам поднимет ролик по videoId через движок YouTube
    streamUrl: "",
    duration: i.duration ?? 0,
    genre: "",
    year: "",
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    isFull: true,
    plays: i.views ?? 0,
    /** Прямая подсказка плееру, что грузить */
    youtubeId: id,
  };
}

async function pipedSearch(query: string, filter: string, limit: number): Promise<ApiTrack[]> {
  for (const host of PIPED_HOSTS) {
    try {
      const res = await fetch(
        `${host}/search?q=${encodeURIComponent(query)}&filter=${filter}`,
        {
          headers: { Accept: "application/json", "User-Agent": "GASHPROJECT/9.0" },
          cache: "no-store",
          signal: AbortSignal.timeout(13000),
        }
      );
      if (!res.ok) continue;

      const d = (await res.json()) as { items?: PipedItem[] };
      const items = (d.items ?? [])
        .filter((i) => i.type !== "channel" && i.type !== "playlist")
        .map(mapItem)
        .filter((t): t is ApiTrack => t !== null)
        // Отсекаем часовые сборники и слишком короткие обрывки
        .filter((t) => t.duration === 0 || (t.duration >= 40 && t.duration <= 1500));

      if (items.length > 0) return items.slice(0, limit);
    } catch {
      continue;
    }
  }
  return [];
}

/** Песни из каталога YouTube Music — самые чистые метаданные */
export async function searchYtMusic(query: string, limit = 20): Promise<ApiTrack[]> {
  if (!query.trim()) return [];
  const songs = await pipedSearch(query, "music_songs", limit);
  if (songs.length > 0) return songs;
  // Если музыкального каталога нет — берём обычные видео
  return pipedSearch(query, "videos", limit);
}

/** Клипы — обычно официальные видео артиста */
export async function searchYtVideos(query: string, limit = 16): Promise<ApiTrack[]> {
  if (!query.trim()) return [];
  return pipedSearch(query, "music_videos", limit);
}
