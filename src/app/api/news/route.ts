import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Новостная лента из открытых RSS — без ключей.
 * Парсер простой и устойчивый: работает и с CDATA, и с обычным текстом.
 */

export const FEEDS: Record<string, { name: string; url: string; color: string; icon: string; cat: string }> = {
  lenta:      { name: "Лента.ру",   url: "https://lenta.ru/rss/news",                    color: "#ff4d6d", icon: "📰", cat: "Общее" },
  ria:        { name: "РИА",        url: "https://ria.ru/export/rss2/archive/index.xml", color: "#22d3ee", icon: "🗞", cat: "Общее" },
  tass:       { name: "ТАСС",       url: "https://tass.ru/rss/v2.xml",                   color: "#7c5cff", icon: "📡", cat: "Общее" },
  rg:         { name: "Рос. газета",url: "https://rg.ru/xml/index.xml",                  color: "#34e5a0", icon: "🏛", cat: "Общее" },
  vedomosti:  { name: "Ведомости",  url: "https://www.vedomosti.ru/rss/news",            color: "#ffb340", icon: "💼", cat: "Бизнес" },
  meduza:     { name: "Meduza",     url: "https://meduza.io/rss/all",                    color: "#f043a0", icon: "🔍", cat: "Общее" },
  bbc:        { name: "BBC Russian",url: "https://feeds.bbci.co.uk/russian/rss.xml",     color: "#ff4d6d", icon: "🌍", cat: "Мир" },
  habr:       { name: "Хабр",       url: "https://habr.com/ru/rss/articles/?fl=ru",      color: "#34e5a0", icon: "💻", cat: "Технологии" },
  vc:         { name: "VC.ru",      url: "https://vc.ru/rss/all",                        color: "#a68fff", icon: "🚀", cat: "Технологии" },
  cnews:      { name: "CNews",      url: "https://www.cnews.ru/inc/rss/news.xml",        color: "#22d3ee", icon: "🖥", cat: "Технологии" },
  news3d:     { name: "3DNews",     url: "https://3dnews.ru/news/rss/",                  color: "#ffb340", icon: "⚙️", cat: "Технологии" },
  mailtech:   { name: "Hi-Tech",    url: "https://hi-tech.mail.ru/rss/all/",             color: "#7c5cff", icon: "📱", cat: "Технологии" },
  sport:      { name: "Чемпионат",  url: "https://www.championat.com/rss/news/",         color: "#34e5a0", icon: "⚽", cat: "Спорт" },
  kino:       { name: "Кино Mail",  url: "https://kino.mail.ru/rss/all/",                color: "#f043a0", icon: "🎬", cat: "Культура" },
};

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image: string | null;
  source: string;
  sourceName: string;
  color: string;
  cat: string;
}

/** Достаёт содержимое тега, учитывая CDATA */
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .trim();
}

/** Ищет картинку в enclosure, media:content или внутри описания */
function image(xml: string): string | null {
  const enc = xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enc) return enc[1];
  const media = xml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (media) return media[1];
  const thumb = xml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (thumb) return thumb[1];
  const img = xml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) return img[1];
  return null;
}

async function parseFeed(key: string): Promise<NewsItem[]> {
  const feed = FEEDS[key];
  if (!feed) return [];

  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GASHPROJECT/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.split(/<item[\s>]/i).slice(1);

    return items.slice(0, 18).map((raw) => {
      const chunk = "<item " + raw;
      return {
        title: tag(chunk, "title").slice(0, 220),
        link: tag(chunk, "link") || (chunk.match(/<link[^>]*>([^<]+)/)?.[1] ?? ""),
        description: tag(chunk, "description").slice(0, 400),
        pubDate: tag(chunk, "pubDate"),
        image: image(chunk),
        source: key,
        sourceName: feed.name,
        color: feed.color,
        cat: feed.cat,
      };
    }).filter((i) => i.title.length > 3);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source") || "all";
  const cat = request.nextUrl.searchParams.get("cat") || "";

  try {
    let keys = source === "all" ? Object.keys(FEEDS) : [source];
    if (cat) keys = keys.filter((k) => FEEDS[k]?.cat === cat);
    const batches = await Promise.all(keys.map(parseFeed));
    let items = batches.flat();

    // Сортируем по дате, свежее — выше
    items.sort((a, b) => {
      const ta = new Date(a.pubDate).getTime() || 0;
      const tb = new Date(b.pubDate).getTime() || 0;
      return tb - ta;
    });

    // Убираем дубликаты по заголовку
    const seen = new Set<string>();
    items = items.filter((i) => {
      const k = i.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return NextResponse.json({
      items: items.slice(0, 80),
      total: items.length,
      sources: Object.entries(FEEDS).map(([k, v]) => ({ key: k, ...v })),
      categories: Array.from(new Set(Object.values(FEEDS).map((f) => f.cat))),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("News error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить новости", items: [], sources: [] },
      { status: 502 }
    );
  }
}
