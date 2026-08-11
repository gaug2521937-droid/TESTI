/**
 * Интеграция с VK API.
 *
 * Важно про музыку: методы audio.* закрыты для сторонних приложений
 * с 2016 года и отвечают «Unknown method passed» — это подтвердилось
 * и на нашем токене. Обходить это через токены официальных клиентов
 * мы не будем, поэтому VK используется для видео, клипов и сообществ.
 */

const TOKEN = process.env.VK_TOKEN || "";
const VERSION = process.env.VK_API_VERSION || "5.199";

export function isVkConfigured(): boolean {
  return TOKEN.length > 0;
}

interface VkError {
  error_code: number;
  error_msg: string;
}

/** Единая точка вызова VK API с понятными ошибками */
async function call<T>(method: string, params: Record<string, string | number>): Promise<T | null> {
  if (!TOKEN) return null;

  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    access_token: TOKEN,
    v: VERSION,
  });

  try {
    const res = await fetch(`https://api.vk.com/method/${method}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { response?: T; error?: VkError };
    if (data.error) {
      console.error(`VK ${method}:`, data.error.error_msg);
      return null;
    }
    return data.response ?? null;
  } catch {
    return null;
  }
}

/* ═══════════════ ВИДЕО ═══════════════ */

export interface VkVideo {
  id: string;
  ownerId: number;
  videoId: number;
  title: string;
  description: string;
  duration: number;
  views: number;
  likes: number;
  date: number;
  thumb: string;
  player: string;
  /** Прямые ссылки на файлы по качеству */
  files: { quality: string; url: string; height: number }[];
  author: string;
}

interface RawVideo {
  id?: number;
  owner_id?: number;
  title?: string;
  description?: string;
  duration?: number;
  views?: number;
  date?: number;
  player?: string;
  likes?: { count?: number };
  image?: Array<{ url?: string; width?: number }>;
  files?: Record<string, string>;
}

const QUALITY_ORDER: Record<string, number> = {
  mp4_144: 144, mp4_240: 240, mp4_360: 360,
  mp4_480: 480, mp4_720: 720, mp4_1080: 1080,
};

function mapVideo(v: RawVideo, authors: Map<number, string>): VkVideo | null {
  if (!v.id || v.owner_id === undefined) return null;

  // Лучшая по ширине обложка
  const images = (v.image ?? []).filter((i) => i.url);
  const thumb = images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? "";

  const files = Object.entries(v.files ?? {})
    .filter(([k, url]) => k.startsWith("mp4_") && url)
    .map(([k, url]) => ({
      quality: k.replace("mp4_", "") + "p",
      url,
      height: QUALITY_ORDER[k] ?? 0,
    }))
    .sort((a, b) => b.height - a.height);

  return {
    id: `${v.owner_id}_${v.id}`,
    ownerId: v.owner_id,
    videoId: v.id,
    title: (v.title ?? "Без названия").slice(0, 200),
    description: (v.description ?? "").slice(0, 400),
    duration: v.duration ?? 0,
    views: v.views ?? 0,
    likes: v.likes?.count ?? 0,
    date: v.date ?? 0,
    thumb,
    player: v.player ?? "",
    files,
    author: authors.get(v.owner_id) ?? "",
  };
}

/** Поиск видео и клипов */
export async function vkVideoSearch(
  query: string,
  opts: { count?: number; sort?: number; hd?: boolean; longer?: number; shorter?: number } = {}
): Promise<VkVideo[]> {
  const res = await call<{ count: number; items: RawVideo[]; profiles?: Array<{ id: number; first_name: string; last_name: string }>; groups?: Array<{ id: number; name: string }> }>(
    "video.search",
    {
      q: query,
      count: opts.count ?? 20,
      sort: opts.sort ?? 2, // 2 — по релевантности
      hd: opts.hd ? 1 : 0,
      adult: 0,
      extended: 1,
      ...(opts.longer ? { longer: opts.longer } : {}),
      ...(opts.shorter ? { shorter: opts.shorter } : {}),
    }
  );
  if (!res) return [];

  // Собираем имена авторов
  const authors = new Map<number, string>();
  for (const p of res.profiles ?? []) authors.set(p.id, `${p.first_name} ${p.last_name}`.trim());
  for (const g of res.groups ?? []) authors.set(-g.id, g.name);

  return (res.items ?? [])
    .map((v) => mapVideo(v, authors))
    .filter((v): v is VkVideo => v !== null && v.files.length > 0);
}

/** Видео по прямой ссылке вида vk.com/video-123_456 */
export async function vkVideoGet(ownerId: number, videoId: number): Promise<VkVideo | null> {
  const res = await call<{
    items: RawVideo[];
    profiles?: Array<{ id: number; first_name: string; last_name: string }>;
    groups?: Array<{ id: number; name: string }>;
  }>("video.get", { videos: `${ownerId}_${videoId}`, extended: 1 });

  if (!res?.items?.[0]) return null;

  const authors = new Map<number, string>();
  for (const p of res.profiles ?? []) authors.set(p.id, `${p.first_name} ${p.last_name}`.trim());
  for (const g of res.groups ?? []) authors.set(-g.id, g.name);

  const mapped = mapVideo(res.items[0], authors);

  // video.get часто возвращает пустой files. Пробуем достать реальные
  // mp4-ссылки через video.search: сначала по названию, потом по автору.
  if (!mapped || mapped.files.length === 0) {
    const title = (res.items[0].title ?? "").trim();
    const rawAuthor = res.items[0] as unknown as { title?: string; description?: string };
    const queries = [
      title,
      title ? title.split(" ").slice(0, 5).join(" ") : "",
      (rawAuthor.description ?? "").slice(0, 40),
    ].filter((q) => q.length > 3);

    for (const q of queries) {
      const found = await vkVideoSearch(q, { count: 20 });
      const exact = found.find(
        (v) => v.videoId === videoId && v.ownerId === ownerId && v.files.length > 0
      );
      if (exact) return exact;
    }

    // Если совсем ничего не нашли по метаданным — возвращаем что есть,
    // фронт покажет плеер VK как iframe
    if (mapped) return mapped;
  }

  return mapped;
}

/** Разбор ссылки VK на видео */
export function parseVkVideoUrl(url: string): { ownerId: number; videoId: number } | null {
  const m = url.match(/video(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

/* ═══════════════ СООБЩЕСТВА ═══════════════ */

export interface VkGroup {
  id: number;
  name: string;
  screenName: string;
  photo: string;
  members: number;
  description: string;
  verified: boolean;
}

/** Поиск музыкальных пабликов и сообществ */
export async function vkGroupSearch(query: string, count = 12): Promise<VkGroup[]> {
  const res = await call<{ count: number; items: Array<{ id: number; name: string; screen_name?: string; photo_200?: string; members_count?: number; description?: string; verified?: number }> }>(
    "groups.search",
    { q: query, count, sort: 0, type: "page,group" }
  );
  if (!res) return [];

  return (res.items ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    screenName: g.screen_name ?? String(g.id),
    photo: g.photo_200 ?? "",
    members: g.members_count ?? 0,
    description: (g.description ?? "").slice(0, 200),
    verified: g.verified === 1,
  }));
}

/* ═══════════════ ЛЕНТА ═══════════════ */

export interface VkPost {
  id: string;
  text: string;
  date: number;
  likes: number;
  reposts: number;
  views: number;
  authorName: string;
  authorPhoto: string;
  photos: string[];
  link: string;
}

/** Поиск записей по всей сети — например, о новых релизах */
export async function vkNewsSearch(query: string, count = 20): Promise<VkPost[]> {
  const res = await call<{
    items: Array<{
      id?: number;
      owner_id?: number;
      from_id?: number;
      text?: string;
      date?: number;
      likes?: { count?: number };
      reposts?: { count?: number };
      views?: { count?: number };
      attachments?: Array<{ type?: string; photo?: { sizes?: Array<{ url?: string; width?: number }> } }>;
    }>;
    profiles?: Array<{ id: number; first_name: string; last_name: string; photo_100?: string }>;
    groups?: Array<{ id: number; name: string; photo_100?: string }>;
  }>("newsfeed.search", { q: query, count, extended: 1 });

  if (!res) return [];

  const names = new Map<number, { name: string; photo: string }>();
  for (const p of res.profiles ?? []) {
    names.set(p.id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_100 ?? "" });
  }
  for (const g of res.groups ?? []) {
    names.set(-g.id, { name: g.name, photo: g.photo_100 ?? "" });
  }

  return (res.items ?? [])
    .filter((p) => (p.text ?? "").trim().length > 10)
    .map((p) => {
      const author = names.get(p.from_id ?? p.owner_id ?? 0);
      const photos = (p.attachments ?? [])
        .filter((a) => a.type === "photo")
        .map((a) => {
          const sizes = (a.photo?.sizes ?? []).filter((s) => s.url);
          return sizes.sort((x, y) => (y.width ?? 0) - (x.width ?? 0))[0]?.url ?? "";
        })
        .filter(Boolean)
        .slice(0, 4);

      return {
        id: `${p.owner_id}_${p.id}`,
        text: (p.text ?? "").slice(0, 800),
        date: p.date ?? 0,
        likes: p.likes?.count ?? 0,
        reposts: p.reposts?.count ?? 0,
        views: p.views?.count ?? 0,
        authorName: author?.name ?? "VK",
        authorPhoto: author?.photo ?? "",
        photos,
        link: `https://vk.com/wall${p.owner_id}_${p.id}`,
      };
    });
}

/** Проверка токена */
export async function vkWhoAmI(): Promise<{ id: number; name: string } | null> {
  const res = await call<Array<{ id: number; first_name: string; last_name: string }>>("users.get", {});
  const u = res?.[0];
  return u ? { id: u.id, name: `${u.first_name} ${u.last_name}`.trim() } : null;
}


/* ═══════════════ МУЗЫКАЛЬНЫЕ РАЗДЕЛЫ ═══════════════ */

/** Стена сообщества — свежие релизы и новости из пабликов */
export async function vkWallGet(ownerId: number, count = 15): Promise<VkPost[]> {
  const res = await call<{
    items: Array<{
      id?: number; owner_id?: number; from_id?: number; text?: string; date?: number;
      likes?: { count?: number }; reposts?: { count?: number }; views?: { count?: number };
      attachments?: Array<{ type?: string; photo?: { sizes?: Array<{ url?: string; width?: number }> } }>;
    }>;
    groups?: Array<{ id: number; name: string; photo_100?: string }>;
  }>("wall.get", { owner_id: ownerId, count, extended: 1 });

  if (!res) return [];
  const names = new Map<number, { name: string; photo: string }>();
  for (const g of res.groups ?? []) names.set(-g.id, { name: g.name, photo: g.photo_100 ?? "" });

  return (res.items ?? [])
    .filter((p) => (p.text ?? "").trim().length > 5)
    .map((p) => {
      const a = names.get(p.from_id ?? p.owner_id ?? 0);
      const photos = (p.attachments ?? [])
        .filter((x) => x.type === "photo")
        .map((x) => {
          const sz = (x.photo?.sizes ?? []).filter((z) => z.url);
          return sz.sort((m, n) => (n.width ?? 0) - (m.width ?? 0))[0]?.url ?? "";
        })
        .filter(Boolean).slice(0, 4);

      return {
        id: `${p.owner_id}_${p.id}`,
        text: (p.text ?? "").slice(0, 800),
        date: p.date ?? 0,
        likes: p.likes?.count ?? 0,
        reposts: p.reposts?.count ?? 0,
        views: p.views?.count ?? 0,
        authorName: a?.name ?? "VK",
        authorPhoto: a?.photo ?? "",
        photos,
        link: `https://vk.com/wall${p.owner_id}_${p.id}`,
      };
    });
}

/** Подсказки поиска — что сейчас ищут в VK */
export async function vkHints(q: string, limit = 8): Promise<{ type: string; name: string; photo: string; id: string }[]> {
  const res = await call<{ items: Array<{ type?: string; group?: { id?: number; name?: string; photo_100?: string }; profile?: { id?: number; first_name?: string; last_name?: string; photo_100?: string } }> }>(
    "search.getHints",
    { q, limit }
  );
  if (!res) return [];
  return (res.items ?? [])
    .map((i) => {
      if (i.group?.name) {
        return { type: "group", name: i.group.name, photo: i.group.photo_100 ?? "", id: String(-(i.group.id ?? 0)) };
      }
      if (i.profile?.first_name) {
        return {
          type: "user",
          name: `${i.profile.first_name} ${i.profile.last_name ?? ""}`.trim(),
          photo: i.profile.photo_100 ?? "",
          id: String(i.profile.id ?? 0),
        };
      }
      return null;
    })
    .filter((x): x is { type: string; name: string; photo: string; id: string } => x !== null);
}

/** Клипы артиста: официальные видео, отсортированные по популярности */
export async function vkArtistClips(artist: string, count = 12): Promise<VkVideo[]> {
  const [official, live] = await Promise.all([
    vkVideoSearch(`${artist} official video`, { count: Math.ceil(count * 0.7), sort: 2 }),
    vkVideoSearch(`${artist} клип`, { count: Math.ceil(count * 0.6), sort: 1 }),
  ]);

  const seen = new Set<string>();
  return [...official, ...live]
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, count);
}


/* ═══════════════ РИЛС (короткие видео) ═══════════════ */
/**
 * Собственно VK Clips API закрыт. Но video.search умеет фильтровать
 * по длине — используем это. shorter=61 даёт видео до 60 секунд,
 * что и есть формат рилс/клипов.
 */
export async function vkReels(query = "", count = 24): Promise<VkVideo[]> {
  const queries = query
    ? [query]
    : ["клип", "мем", "прикол", "танцы", "музыка", "юмор"];

  // shorter=180 — короткие видео до 3 минут (формат клипов/рилс).
  // Более жёсткий фильтр (61) отсекает почти всё, т.к. video.search
  // выдаёт мало явно коротких роликов
  const batches = await Promise.all(
    queries.map((q) =>
      vkVideoSearch(q, { count: Math.ceil(count / queries.length) + 5, sort: 2, shorter: 180 })
    )
  );

  const seen = new Set<string>();
  return batches
    .flat()
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      // Отсекаем совсем короткие остатки от рекламы
      return v.duration >= 5 && v.duration <= 180;
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, count);
}

/** Обычные видео с флагом HD */
export async function vkVideos(query: string, count = 24): Promise<VkVideo[]> {
  return vkVideoSearch(query, { count, sort: 2, hd: true, longer: 60 });
}
