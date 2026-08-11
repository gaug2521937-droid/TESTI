/**
 * Реестр музыкальных API. Все открытые, без платных ключей.
 *
 * Разделены по назначению:
 *   ПОТОК     — отдают звук, играют целиком
 *   КАТАЛОГ   — метаданные, обложки, чарты, рекомендации
 *   ТЕКСТЫ    — слова песен, в том числе с таймкодами
 *   СПРАВКА   — биографии артистов, дискографии
 */

export interface ApiEntry {
  id: string;
  name: string;
  group: "поток" | "каталог" | "тексты" | "справка" | "радио";
  base: string;
  note: string;
}

export const MUSIC_APIS: ApiEntry[] = [
  // ── Audius: 6 эндпоинтов, полные треки ──
  { id: "audius.search", name: "Audius · поиск треков", group: "поток", base: "api.audius.co/v1/tracks/search", note: "полные треки" },
  { id: "audius.trending", name: "Audius · тренды", group: "поток", base: "api.audius.co/v1/tracks/trending", note: "по жанрам" },
  { id: "audius.underground", name: "Audius · андеграунд", group: "поток", base: "api.audius.co/v1/tracks/trending/underground", note: "новые артисты" },
  { id: "audius.playlists", name: "Audius · плейлисты", group: "поток", base: "api.audius.co/v1/playlists/trending", note: "готовые подборки" },
  { id: "audius.users", name: "Audius · артисты", group: "поток", base: "api.audius.co/v1/users/search", note: "поиск исполнителей" },
  { id: "audius.usertracks", name: "Audius · треки артиста", group: "поток", base: "api.audius.co/v1/users/{id}/tracks", note: "дискография" },

  // ── Internet Archive: 3 ──
  { id: "archive.search", name: "Archive · поиск", group: "поток", base: "archive.org/advancedsearch.php", note: "2.7 млн записей" },
  { id: "archive.meta", name: "Archive · метаданные", group: "поток", base: "archive.org/metadata", note: "список файлов" },
  { id: "archive.stream", name: "Archive · поток", group: "поток", base: "archive.org/download", note: "прямая отдача mp3" },

  // ── ccMixter: 2 ──
  { id: "ccmixter.search", name: "ccMixter · поиск", group: "поток", base: "ccmixter.org/api/query", note: "Creative Commons" },
  { id: "ccmixter.top", name: "ccMixter · рейтинг", group: "поток", base: "ccmixter.org/api/query?sort=rank", note: "лучшее за годы" },

  // ── Deezer: 10 эндпоинтов каталога ──
  { id: "deezer.track", name: "Deezer · треки", group: "каталог", base: "api.deezer.com/search", note: "мировой каталог" },
  { id: "deezer.artist", name: "Deezer · артисты", group: "каталог", base: "api.deezer.com/search/artist", note: "поиск исполнителей" },
  { id: "deezer.album", name: "Deezer · альбомы", group: "каталог", base: "api.deezer.com/search/album", note: "релизы" },
  { id: "deezer.playlist", name: "Deezer · плейлисты", group: "каталог", base: "api.deezer.com/search/playlist", note: "подборки" },
  { id: "deezer.chart", name: "Deezer · чарт треков", group: "каталог", base: "api.deezer.com/chart/0/tracks", note: "топ недели" },
  { id: "deezer.chartartists", name: "Deezer · чарт артистов", group: "каталог", base: "api.deezer.com/chart/0/artists", note: "топ исполнителей" },
  { id: "deezer.top", name: "Deezer · хиты артиста", group: "каталог", base: "api.deezer.com/artist/{id}/top", note: "лучшее у артиста" },
  { id: "deezer.related", name: "Deezer · похожие", group: "каталог", base: "api.deezer.com/artist/{id}/related", note: "рекомендации" },
  { id: "deezer.genre", name: "Deezer · жанры", group: "каталог", base: "api.deezer.com/genre", note: "дерево жанров" },
  { id: "deezer.editorial", name: "Deezer · редакция", group: "каталог", base: "api.deezer.com/editorial", note: "выбор редакции" },

  // ── iTunes: 3 ──
  { id: "itunes.song", name: "Apple · треки", group: "каталог", base: "itunes.apple.com/search", note: "каталог Apple" },
  { id: "itunes.album", name: "Apple · альбомы", group: "каталог", base: "itunes.apple.com/search?entity=album", note: "релизы" },
  { id: "itunes.lookup", name: "Apple · дискография", group: "каталог", base: "itunes.apple.com/lookup", note: "альбомы артиста" },

  // ── Тексты: 4 ──
  { id: "lrclib.search", name: "LRCLIB · поиск текстов", group: "тексты", base: "lrclib.net/api/search", note: "с таймкодами" },
  { id: "lrclib.get", name: "LRCLIB · точный текст", group: "тексты", base: "lrclib.net/api/get", note: "синхронизация" },
  { id: "lyricsovh.get", name: "Lyrics.ovh · текст", group: "тексты", base: "api.lyrics.ovh/v1", note: "резервный источник" },
  { id: "lyricsovh.suggest", name: "Lyrics.ovh · подсказки", group: "тексты", base: "api.lyrics.ovh/suggest", note: "поиск по названию" },

  // ── Справка: 2 ──
  { id: "audiodb.artist", name: "TheAudioDB · артист", group: "справка", base: "theaudiodb.com/api/v1/json/2/search.php", note: "биография и фото" },
  { id: "discogs.search", name: "Discogs · релизы", group: "справка", base: "api.discogs.com/database/search", note: "издания и годы" },

  // ── Радио: 1 ──
  { id: "radiobrowser", name: "Radio Browser", group: "радио", base: "api.radio-browser.info", note: "50 000+ станций" },
];

export const API_COUNT = MUSIC_APIS.length;

const T = 11000;
const UA = { "User-Agent": "Mozilla/5.0 GASHPROJECT/7.0", Accept: "application/json" };

/** Безопасный JSON-запрос: не роняет страницу при отказе источника */
async function j<T = unknown>(url: string, timeout = T): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return null;
    const text = await r.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/* ═══════════════ КАТАЛОГ: артисты ═══════════════ */

export interface ArtistCard {
  id: string;
  name: string;
  picture: string;
  fans: number;
  albums: number;
  source: string;
}

/** Deezer · поиск артистов */
export async function deezerArtists(q: string, limit = 12): Promise<ArtistCard[]> {
  const d = await j<{ data?: Array<{ id?: number; name?: string; picture_big?: string; picture_medium?: string; nb_fan?: number; nb_album?: number }> }>(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=${limit}`
  );
  return (d?.data ?? [])
    .filter((a) => a.id && a.name)
    .map((a) => ({
      id: String(a.id),
      name: a.name!,
      picture: a.picture_big || a.picture_medium || "",
      fans: a.nb_fan ?? 0,
      albums: a.nb_album ?? 0,
      source: "deezer",
    }));
}

/** Deezer · чарт артистов */
export async function deezerChartArtists(limit = 12): Promise<ArtistCard[]> {
  const d = await j<{ data?: Array<{ id?: number; name?: string; picture_big?: string; nb_fan?: number }> }>(
    `https://api.deezer.com/chart/0/artists?limit=${limit}`
  );
  return (d?.data ?? [])
    .filter((a) => a.id && a.name)
    .map((a) => ({
      id: String(a.id),
      name: a.name!,
      picture: a.picture_big || "",
      fans: a.nb_fan ?? 0,
      albums: 0,
      source: "deezer",
    }));
}

/** Deezer · похожие артисты */
export async function deezerRelated(artistId: string, limit = 10): Promise<ArtistCard[]> {
  const d = await j<{ data?: Array<{ id?: number; name?: string; picture_big?: string; nb_fan?: number; nb_album?: number }> }>(
    `https://api.deezer.com/artist/${artistId}/related?limit=${limit}`
  );
  return (d?.data ?? [])
    .filter((a) => a.id && a.name)
    .map((a) => ({
      id: String(a.id),
      name: a.name!,
      picture: a.picture_big || "",
      fans: a.nb_fan ?? 0,
      albums: a.nb_album ?? 0,
      source: "deezer",
    }));
}

/* ═══════════════ КАТАЛОГ: альбомы ═══════════════ */

export interface AlbumCard {
  id: string;
  title: string;
  artist: string;
  cover: string;
  tracks: number;
  year: string;
  source: string;
}

/** Deezer · поиск альбомов */
export async function deezerAlbums(q: string, limit = 12): Promise<AlbumCard[]> {
  const d = await j<{ data?: Array<{ id?: number; title?: string; cover_big?: string; cover_medium?: string; nb_tracks?: number; release_date?: string; artist?: { name?: string } }> }>(
    `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=${limit}`
  );
  return (d?.data ?? [])
    .filter((a) => a.id && a.title)
    .map((a) => ({
      id: String(a.id),
      title: a.title!,
      artist: a.artist?.name ?? "",
      cover: a.cover_big || a.cover_medium || "",
      tracks: a.nb_tracks ?? 0,
      year: a.release_date ? a.release_date.slice(0, 4) : "",
      source: "deezer",
    }));
}

/** Apple · дискография артиста по его id */
export async function itunesDiscography(artistId: string, limit = 12): Promise<AlbumCard[]> {
  const d = await j<{ results?: Array<{ wrapperType?: string; collectionId?: number; collectionName?: string; artistName?: string; artworkUrl100?: string; trackCount?: number; releaseDate?: string }> }>(
    `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=${limit}`
  );
  return (d?.results ?? [])
    .filter((a) => a.wrapperType === "collection" && a.collectionId)
    .map((a) => ({
      id: String(a.collectionId),
      title: a.collectionName ?? "",
      artist: a.artistName ?? "",
      cover: (a.artworkUrl100 ?? "").replace(/\/\d+x\d+bb\./, "/600x600bb."),
      tracks: a.trackCount ?? 0,
      year: a.releaseDate ? a.releaseDate.slice(0, 4) : "",
      source: "itunes",
    }));
}

/* ═══════════════ КАТАЛОГ: жанры и редакция ═══════════════ */

export interface GenreCard {
  id: string;
  name: string;
  picture: string;
}

/** Deezer · дерево жанров */
export async function deezerGenres(): Promise<GenreCard[]> {
  const d = await j<{ data?: Array<{ id?: number; name?: string; picture_medium?: string }> }>(
    "https://api.deezer.com/genre"
  );
  return (d?.data ?? [])
    .filter((g) => g.id !== undefined && g.name && g.name !== "All")
    .map((g) => ({ id: String(g.id), name: g.name!, picture: g.picture_medium ?? "" }));
}

/** Deezer · выбор редакции */
export async function deezerEditorial(): Promise<GenreCard[]> {
  const d = await j<{ data?: Array<{ id?: number; name?: string; picture_medium?: string }> }>(
    "https://api.deezer.com/editorial"
  );
  return (d?.data ?? [])
    .filter((g) => g.id !== undefined && g.name)
    .map((g) => ({ id: String(g.id), name: g.name!, picture: g.picture_medium ?? "" }));
}

/* ═══════════════ СПРАВКА ═══════════════ */

export interface ArtistInfo {
  name: string;
  bio: string | null;
  formed: string | null;
  country: string | null;
  genre: string | null;
  thumb: string | null;
  banner: string | null;
  website: string | null;
  members: string | null;
}

/** TheAudioDB · биография и оформление */
export async function audioDbArtist(name: string): Promise<ArtistInfo | null> {
  const d = await j<{ artists?: Array<Record<string, string | null>> }>(
    `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`
  );
  const a = d?.artists?.[0];
  if (!a) return null;
  return {
    name: (a.strArtist as string) ?? name,
    bio: (a.strBiographyRU as string) || (a.strBiographyEN as string) || null,
    formed: (a.intFormedYear as string) || null,
    country: (a.strCountry as string) || null,
    genre: (a.strGenre as string) || null,
    thumb: (a.strArtistThumb as string) || null,
    banner: (a.strArtistFanart as string) || (a.strArtistBanner as string) || null,
    website: (a.strWebsite as string) || null,
    members: (a.intMembers as string) || null,
  };
}

export interface ReleaseCard {
  id: string;
  title: string;
  year: string;
  label: string;
  cover: string;
  format: string;
}

/** Discogs · издания артиста */
export async function discogsReleases(q: string, limit = 10): Promise<ReleaseCard[]> {
  const d = await j<{ results?: Array<{ id?: number; title?: string; year?: string; label?: string[]; thumb?: string; cover_image?: string; format?: string[] }> }>(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=${limit}`
  );
  return (d?.results ?? [])
    .filter((r) => r.id && r.title)
    .map((r) => ({
      id: String(r.id),
      title: r.title!,
      year: r.year ?? "",
      label: r.label?.[0] ?? "",
      cover: r.cover_image || r.thumb || "",
      format: r.format?.slice(0, 2).join(", ") ?? "",
    }));
}

/* ═══════════════ ТЕКСТЫ ═══════════════ */

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  plain: string | null;
  /** Строки с таймкодами — для точного караоке */
  synced: LyricsLine[] | null;
  source: string;
  trackName?: string;
  artistName?: string;
  duration?: number;
}

/** Разбор формата LRC в массив строк с временем */
export function parseLrc(lrc: string): LyricsLine[] {
  const out: LyricsLine[] = [];
  for (const raw of lrc.split("\n")) {
    const m = raw.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const frac = m[3] ? Number(m[3].padEnd(3, "0")) / 1000 : 0;
    out.push({ time: min * 60 + sec + frac, text: m[4].trim() });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** LRCLIB · точное совпадение с таймкодами */
export async function lrclibGet(
  artist: string,
  title: string,
  duration?: number
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  if (duration && duration > 0) params.set("duration", String(Math.round(duration)));

  const d = await j<{ plainLyrics?: string; syncedLyrics?: string; trackName?: string; artistName?: string; duration?: number }>(
    `https://lrclib.net/api/get?${params}`
  );
  if (!d) return null;

  const synced = d.syncedLyrics ? parseLrc(d.syncedLyrics) : null;
  if (!d.plainLyrics && (!synced || synced.length === 0)) return null;

  return {
    plain: d.plainLyrics ?? null,
    synced: synced && synced.length > 0 ? synced : null,
    source: "LRCLIB",
    trackName: d.trackName,
    artistName: d.artistName,
    duration: d.duration,
  };
}

/** LRCLIB · поиск, когда точное совпадение не нашлось */
export async function lrclibSearch(query: string): Promise<LyricsResult | null> {
  const d = await j<Array<{ plainLyrics?: string; syncedLyrics?: string; trackName?: string; artistName?: string; duration?: number }>>(
    `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
  );
  if (!Array.isArray(d) || d.length === 0) return null;

  // Предпочитаем запись с синхронизацией
  const best = d.find((x) => x.syncedLyrics) ?? d.find((x) => x.plainLyrics);
  if (!best) return null;

  const synced = best.syncedLyrics ? parseLrc(best.syncedLyrics) : null;
  return {
    plain: best.plainLyrics ?? null,
    synced: synced && synced.length > 0 ? synced : null,
    source: "LRCLIB",
    trackName: best.trackName,
    artistName: best.artistName,
    duration: best.duration,
  };
}

/** Lyrics.ovh · резервный источник без таймкодов */
export async function lyricsOvh(artist: string, title: string): Promise<LyricsResult | null> {
  const d = await j<{ lyrics?: string }>(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    9000
  );
  const text = (d?.lyrics ?? "").trim();
  if (text.length < 20) return null;
  return { plain: text, synced: null, source: "Lyrics.ovh" };
}

/** Lyrics.ovh · подсказки по названию */
export async function lyricsSuggest(q: string): Promise<{ title: string; artist: string; album: string; cover: string }[]> {
  const d = await j<{ data?: Array<{ title?: string; artist?: { name?: string }; album?: { title?: string; cover_medium?: string } }> }>(
    `https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`
  );
  return (d?.data ?? []).slice(0, 8).map((x) => ({
    title: x.title ?? "",
    artist: x.artist?.name ?? "",
    album: x.album?.title ?? "",
    cover: x.album?.cover_medium ?? "",
  }));
}
