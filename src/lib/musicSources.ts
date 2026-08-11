/**
 * Источники музыки — ТОЛЬКО ПОЛНЫЕ ТРЕКИ.
 *
 * Deezer и Apple убраны: по лицензии они отдают ровно 30 секунд,
 * полных файлов в их API не существует физически.
 *
 * Что осталось — всё играет целиком, от первой до последней секунды:
 *   • Audius            — независимые артисты, миллионы треков
 *   • Internet Archive  — 2.7 млн записей: netlabels, живые концерты,
 *                         public domain, винтажные пластинки 78rpm
 *   • ccMixter          — Creative Commons ремиксы и оригиналы
 */

export interface ApiTrack {
  id: string;
  source: "audius" | "archive" | "ccmixter" | "deezer" | "itunes" | "ytmusic";
  title: string;
  artist: string;
  album: string;
  artwork: string;
  artworkLarge: string;
  streamUrl: string;
  duration: number;
  genre: string;
  year: string;
  externalUrl: string;
  isFull: boolean;
  plays?: number;
  /** Прямой id ролика YouTube — плеер грузит его без поиска */
  youtubeId?: string;
}

const APP = "GASHPROJECT";
const TIMEOUT = 12000;

/* ═══════════════ AUDIUS ═══════════════ */
interface AudiusTrack {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  release_date?: string;
  play_count?: number;
  permalink?: string;
  artwork?: Record<string, string> | null;
  user?: { name?: string; handle?: string };
}

export async function searchAudius(query: string, limit: number): Promise<ApiTrack[]> {
  try {
    const url = query
      ? `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}&limit=${limit}`
      : `https://api.audius.co/v1/tracks/trending?app_name=${APP}&limit=${limit}`;

    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AudiusTrack[] };

    return (data.data || []).filter((t) => t.id && t.title).map(mapAudius);
  } catch {
    return [];
  }
}

/** Жанры Audius — официальный список площадки */
export const AUDIUS_GENRES = [
  { key: "", label: "🔥 Всё подряд" },
  { key: "Hip-Hop/Rap", label: "🎤 Хип-хоп" },
  { key: "Electronic", label: "🎛 Электроника" },
  { key: "Rock", label: "🎸 Рок" },
  { key: "Pop", label: "🎹 Поп" },
  { key: "Jazz", label: "🎷 Джаз" },
  { key: "Ambient", label: "🧘 Ambient" },
  { key: "Dubstep", label: "💥 Dubstep" },
  { key: "House", label: "🏠 House" },
  { key: "Techno", label: "⚡ Techno" },
  { key: "Trap", label: "😈 Trap" },
  { key: "Drum & Bass", label: "🥁 DnB" },
  { key: "R&B/Soul", label: "💜 R&B" },
  { key: "Lo-Fi", label: "🎧 Lo-Fi" },
  { key: "Metal", label: "🤘 Metal" },
  { key: "Reggae", label: "🌴 Reggae" },
  { key: "Classical", label: "🎻 Классика" },
  { key: "Country", label: "🤠 Country" },
  { key: "Punk", label: "🖤 Punk" },
  { key: "Funk", label: "🕺 Funk" },
];

/** Андеграунд — то, что ещё не попало в общий тренд */
export async function undergroundAudius(limit: number): Promise<ApiTrack[]> {
  try {
    const res = await fetch(
      `https://api.audius.co/v1/tracks/trending/underground?app_name=${APP}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AudiusTrack[] };
    return (data.data || []).filter((t) => t.id && t.title).map(mapAudius);
  } catch {
    return [];
  }
}

/** Треки конкретного артиста Audius */
export async function audiusArtistTracks(handle: string, limit: number): Promise<ApiTrack[]> {
  try {
    const u = await fetch(
      `https://api.audius.co/v1/users/handle/${encodeURIComponent(handle)}?app_name=${APP}`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!u.ok) return [];
    const ud = (await u.json()) as { data?: { id?: string } };
    const id = ud.data?.id;
    if (!id) return [];

    const r = await fetch(
      `https://api.audius.co/v1/users/${id}/tracks?app_name=${APP}&limit=${limit}&sort=plays`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!r.ok) return [];
    const d = (await r.json()) as { data?: AudiusTrack[] };
    return (d.data || []).filter((t) => t.id && t.title).map(mapAudius);
  } catch {
    return [];
  }
}

/** Общее преобразование трека Audius */
function mapAudius(t: AudiusTrack): ApiTrack {
  const a = t.artwork || {};
  return {
    id: `audius:${t.id}`,
    source: "audius",
    title: t.title!,
    artist: t.user?.name || t.user?.handle || "Независимый артист",
    album: t.mood || t.genre || "Audius",
    artwork: a["150x150"] || a["480x480"] || a["1000x1000"] || "",
    artworkLarge: a["1000x1000"] || a["480x480"] || a["150x150"] || "",
    streamUrl: `/api/music/stream?src=audius&id=${encodeURIComponent(t.id!)}`,
    duration: t.duration || 0,
    genre: t.genre || "",
    year: t.release_date ? String(t.release_date).slice(0, 4) : "",
    externalUrl: t.permalink ? `https://audius.co${t.permalink}` : "https://audius.co",
    isFull: true,
    plays: t.play_count || 0,
  };
}

/** Популярное с Audius по жанру — для стартовой ленты */
export async function trendingAudius(genre: string, limit: number): Promise<ApiTrack[]> {
  try {
    const g = genre ? `&genre=${encodeURIComponent(genre)}` : "";
    const res = await fetch(
      `https://api.audius.co/v1/tracks/trending?app_name=${APP}&limit=${limit}${g}`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AudiusTrack[] };
    return (data.data || []).filter((t) => t.id && t.title).map(mapAudius);
  } catch {
    return [];
  }
}

/* ═══════════════ INTERNET ARCHIVE ═══════════════ */
interface IaDoc {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  year?: string;
  date?: string;
  subject?: string | string[];
  downloads?: number;
}

const first = (v: string | string[] | undefined, fb = ""): string => {
  if (!v) return fb;
  return Array.isArray(v) ? v[0] ?? fb : v;
};

/** Музыкальные коллекции — без подкастов, лекций и аудиокниг */
const IA_MUSIC = `collection:(audio_music OR netlabels OR etree OR ccmixter OR jamendo OR audio_foreign)`;

export async function searchArchive(query: string, limit: number): Promise<ApiTrack[]> {
  try {
    const q = query
      ? `(title:(${query}) OR creator:(${query})) AND ${IA_MUSIC} AND mediatype:(audio) AND format:(MP3)`
      : `${IA_MUSIC} AND mediatype:(audio) AND format:(MP3)`;

    const searchUrl =
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
      `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&fl%5B%5D=date` +
      `&fl%5B%5D=subject&fl%5B%5D=downloads` +
      `&rows=${Math.min(limit, 14)}&page=1&output=json&sort%5B%5D=downloads+desc`;

    const res = await fetch(searchUrl, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return [];
    const data = (await res.json()) as { response?: { docs?: IaDoc[] } };
    const docs = (data.response?.docs || []).filter((d) => d.identifier);
    if (docs.length === 0) return [];

    const items: (ApiTrack | null)[] = await Promise.all(
      docs.slice(0, Math.min(limit, 12)).map(async (doc): Promise<ApiTrack | null> => {
        try {
          const meta = await fetch(`https://archive.org/metadata/${doc.identifier}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(9000),
          });
          if (!meta.ok) return null;

          const m = (await meta.json()) as {
            files?: Array<{ name: string; title?: string; length?: string; format?: string; size?: string }>;
          };

          // Берём самый короткий mp3 — обычно это песня, а не сборник
          const mp3s = (m.files || []).filter(
            (f) => f.name?.toLowerCase().endsWith(".mp3") && !f.name.startsWith("_")
          );
          if (mp3s.length === 0) return null;

          const parseLen = (l?: string) => {
            if (!l) return 0;
            if (l.includes(":")) {
              const p = l.split(":").map(Number);
              return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
            }
            return Math.round(parseFloat(l)) || 0;
          };

          // Предпочитаем треки от 60 сек до 12 минут
          const scored = mp3s
            .map((f) => ({ f, d: parseLen(f.length) }))
            .sort((a, b) => {
              const good = (d: number) => (d >= 60 && d <= 720 ? 0 : 1);
              return good(a.d) - good(b.d) || a.d - b.d;
            });

          const pick = scored[0];
          const artist = first(doc.creator, "Internet Archive");
          const title = pick.f.title || first(doc.title, doc.identifier!);
          const cover = `https://archive.org/services/img/${doc.identifier}`;

          return {
            id: `archive:${doc.identifier}:${pick.f.name}`,
            source: "archive" as const,
            title: String(title).slice(0, 120),
            artist: String(artist).slice(0, 100),
            album: first(doc.title, ""),
            artwork: cover,
            artworkLarge: cover,
            streamUrl: `/api/music/stream?src=archive&id=${encodeURIComponent(
              doc.identifier!
            )}&file=${encodeURIComponent(pick.f.name)}`,
            duration: pick.d,
            genre: first(doc.subject, "").slice(0, 40),
            year: doc.year || (doc.date ? String(doc.date).slice(0, 4) : ""),
            externalUrl: `https://archive.org/details/${doc.identifier}`,
            isFull: true,
            plays: doc.downloads || 0,
          };
        } catch {
          return null;
        }
      })
    );

    return items.filter((t): t is ApiTrack => t !== null);
  } catch {
    return [];
  }
}

/* ═══════════════ ccMIXTER ═══════════════ */
interface CcTrack {
  upload_id?: number | string;
  upload_name?: string;
  user_name?: string;
  user_real_name?: string;
  upload_date_format?: string;
  license_name?: string;
  upload_tags?: string;
  files?: Array<{ download_url?: string; file_format_info?: { length?: string } }>;
}

export async function searchCcMixter(query: string, limit: number): Promise<ApiTrack[]> {
  try {
    const base = "https://ccmixter.org/api/query?f=json&limit=" + Math.min(limit, 20);
    // Параметр searchp ломает выдачу — используем простой search
    const url = query
      ? `${base}&search=${encodeURIComponent(query)}`
      : `${base}&sinced=2015-01-01&sort=rank`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 GASHPROJECT/1.0", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as CcTrack[];
    if (!Array.isArray(data)) return [];

    return data
      .map((t): ApiTrack | null => {
        const mp3 = (t.files || []).find((f) =>
          String(f.download_url || "").toLowerCase().endsWith(".mp3")
        );
        if (!mp3?.download_url || !t.upload_name) return null;

        // Длительность в формате "3:45"
        let dur = 0;
        const len = mp3.file_format_info?.length;
        if (len && len.includes(":")) {
          const p = len.split(":").map(Number);
          dur = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
        }

        const artist = t.user_real_name || t.user_name || "ccMixter";

        return {
          id: `ccmixter:${t.upload_id}`,
          source: "ccmixter" as const,
          title: String(t.upload_name).slice(0, 120),
          artist: String(artist).slice(0, 100),
          album: t.license_name || "Creative Commons",
          artwork: "",
          artworkLarge: "",
          streamUrl: `/api/music/stream?src=ccmixter&url=${encodeURIComponent(mp3.download_url)}`,
          duration: dur,
          genre: (t.upload_tags || "").split(",")[0]?.trim().slice(0, 30) || "",
          year: t.upload_date_format ? String(t.upload_date_format).slice(-4) : "",
          externalUrl: `https://ccmixter.org/files/${t.user_name}/${t.upload_id}`,
          isFull: true,
        };
      })
      .filter((t): t is ApiTrack => t !== null);
  } catch {
    return [];
  }
}

/* ═══════════════ Дедупликация ═══════════════ */
export function dedupe(tracks: ApiTrack[]): ApiTrack[] {
  const seen = new Set<string>();
  const out: ApiTrack[] = [];
  for (const t of tracks) {
    const key = `${t.title.toLowerCase().replace(/[^a-zа-я0-9]/gi, "")}|${t.artist
      .toLowerCase()
      .replace(/[^a-zа-я0-9]/gi, "")}`;
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/* ═══════════════ Ранжирование ═══════════════ */
export function rank(tracks: ApiTrack[], query: string): ApiTrack[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9$]/gi, "");
  const q = norm(query);

  // Явный мусор из пользовательских загрузок
  const JUNK = /whatsapp|voice\s?message|audio\s?\d{4}-\d{2}|запись\s?\d|test\s?track|untitled|аудиозапись/i;

  return tracks
    .map((t) => {
      let s = 0;
      if (q) {
        const a = norm(t.artist);
        const ti = norm(t.title);
        if (a === q) s += 100;
        else if (a.startsWith(q)) s += 75;
        else if (a.includes(q)) s += 50;
        if (ti.includes(q)) s += 30;
        if (q.includes(a) && a.length > 2) s += 25;

        // Артист не совпал, но имя есть в названии — это чужая заливка
        if (!a.includes(q) && !q.includes(a) && ti.includes(q)) s -= 30;
      }

      // Отбрасываем очевидный мусор в самый конец
      if (JUNK.test(t.title) || JUNK.test(t.artist)) s -= 120;
      // YouTube Music — главный источник: чистые метаданные,
      // трек играет целиком и точно тот, что нужен
      if (t.source === "ytmusic") s += 55;
      if (t.source === "deezer") s += 18;
      if (t.source === "itunes") s += 14;
      if (t.source === "audius") s += 10;
      if (t.source === "ccmixter") s += 6;
      // Слишком длинные записи — обычно сборники, не песни
      if (t.duration > 900) s -= 30;
      if (t.duration > 0 && t.duration < 30) s -= 15;
      // Популярность
      if (t.plays) s += Math.min(12, Math.log10(t.plays + 1) * 3);
      return { t, s };
    })
    .sort((x, y) => y.s - x.s)
    .map((x) => x.t);
}


/* ═══════════════ DEEZER — мировой каталог ═══════════════ */
/**
 * Deezer знает всех: Eminem, 1kla$, CZAR, УННВ и любого другого.
 * Сам он отдаёт только 30-секундное превью — это лицензионное
 * ограничение. Поэтому isFull=false, и плеер проигрывает такие
 * треки ЦЕЛИКОМ через встроенный движок YouTube.
 */
interface DzTrack {
  id?: number;
  title?: string;
  title_short?: string;
  duration?: number;
  preview?: string;
  link?: string;
  rank?: number;
  artist?: { id?: number; name?: string; picture_medium?: string };
  album?: { title?: string; cover_medium?: string; cover_xl?: string };
}

export async function searchDeezer(query: string, limit: number): Promise<ApiTrack[]> {
  try {
    const url = query
      ? `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&order=RANKING`
      : `https://api.deezer.com/chart/0/tracks?limit=${limit}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: DzTrack[] };

    return (data.data || [])
      .filter((t) => t.id && t.title)
      .map((t) => ({
        id: `deezer:${t.id}`,
        source: "deezer" as const,
        title: t.title_short || t.title || "",
        artist: t.artist?.name || "Неизвестный исполнитель",
        album: t.album?.title || "",
        artwork: t.album?.cover_medium || t.artist?.picture_medium || "",
        artworkLarge: t.album?.cover_xl || t.album?.cover_medium || "",
        // Превью нужно как запасной вариант, если YouTube недоступен
        streamUrl: t.preview ? `/api/music/stream?src=deezer&url=${encodeURIComponent(t.preview)}` : "",
        duration: t.duration || 0,
        genre: "",
        year: "",
        externalUrl: t.link || "https://deezer.com",
        isFull: false,
        plays: t.rank || 0,
      }));
  } catch {
    return [];
  }
}

/* ═══════════════ APPLE — дополнение каталога ═══════════════ */
interface ItItem {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  trackViewUrl?: string;
}

export async function searchItunes(query: string, limit: number): Promise<ApiTrack[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query || "top hits")}&entity=song&media=music&limit=${limit}`,
      { headers: { "User-Agent": "GASHPROJECT/8.0" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) }
    );
    if (!res.ok) return [];
    const data = JSON.parse(await res.text()) as { results?: ItItem[] };
    const up = (u: string | undefined, n: number) => (u ? u.replace(/\/\d+x\d+bb\./, `/${n}x${n}bb.`) : "");

    return (data.results || [])
      .filter((t) => t.trackId && t.trackName)
      .map((t) => ({
        id: `itunes:${t.trackId}`,
        source: "itunes" as const,
        title: t.trackName!,
        artist: t.artistName || "Неизвестный исполнитель",
        album: t.collectionName || "",
        artwork: up(t.artworkUrl100, 200),
        artworkLarge: up(t.artworkUrl100, 600),
        streamUrl: t.previewUrl ? `/api/music/stream?src=itunes&url=${encodeURIComponent(t.previewUrl)}` : "",
        duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : 0,
        genre: t.primaryGenreName || "",
        year: t.releaseDate ? t.releaseDate.slice(0, 4) : "",
        externalUrl: t.trackViewUrl || "",
        isFull: false,
      }));
  } catch {
    return [];
  }
}
