"use client";

import { useState, useEffect, useCallback } from "react";

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image: string | null;
  source: string;
  sourceName: string;
  color: string;
}

interface Source {
  key: string;
  name: string;
  color: string;
  icon: string;
  cat: string;
}

function ago(d: string) {
  const t = new Date(d).getTime();
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [active, setActive] = useState("all");
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (src: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/news?source=${src}${cat ? `&cat=${encodeURIComponent(cat)}` : ""}`);
      const d = await r.json();
      if (d.sources?.length) setSources(d.sources);
      if (d.categories?.length) setCats(d.categories);
      if (!r.ok) {
        setError(d.error || "Ошибка загрузки");
        return;
      }
      setItems(d.items || []);
    } catch {
      setError("Не удалось загрузить новости");
    } finally {
      setLoading(false);
    }
  }, [cat]);

  useEffect(() => { void load(active); }, [active, cat, load]);

  const shown = search.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const lead = shown[0];
  const rest = shown.slice(1);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="page-head animate-fade-in">
        <div className="status-pill ok">
          <span className="live-dot" />
          14 изданий · обновляется постоянно
        </div>
        <h1><span className="gradient-text">Новости</span></h1>
        <p>Свежая лента из 14 открытых источников: новости, технологии, бизнес, спорт и культура</p>
      </div>

      {/* Категории */}
      {cats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
          <button onClick={() => setCat("")} className={`artist-chip ${!cat ? "on" : ""}`}>
            Все темы
          </button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`artist-chip ${cat === c ? "on" : ""}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Источники */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        <button
          onClick={() => setActive("all")}
          className={`artist-chip ${active === "all" ? "on" : ""}`}
        >
          🌐 Все источники
        </button>
        {sources.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className="px-4 py-2 rounded-full text-[12.5px] font-bold whitespace-nowrap border transition-all"
            style={
              active === s.key
                ? { background: `${s.color}22`, color: s.color, borderColor: `${s.color}60` }
                : { background: "rgba(255,255,255,0.035)", color: "#a8a8bd", borderColor: "rgba(255,255,255,0.07)" }
            }
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Поиск по заголовкам…"
        className="gash-input !py-2.5 !text-[13px] mb-5"
      />

      {error && <div className="gash-alert gash-alert-danger mb-5">⚠️ {error}</div>}

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-[280px]" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[190px]" />)}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="gash-card gash-card-static empty-state">
          <div className="icon">📰</div>
          <p className="title">Новостей не найдено</p>
          <p className="hint">Попробуйте другой источник или запрос</p>
        </div>
      ) : (
        <>
          {/* Главная новость */}
          {lead && (
            <a
              href={lead.link}
              target="_blank"
              rel="noopener noreferrer"
              className="gash-card block mb-4 overflow-hidden no-underline group animate-rise"
            >
              <div className="grid md:grid-cols-2">
                {lead.image ? (
                  <div className="relative h-52 md:h-full min-h-[220px] overflow-hidden">
                    <img
                      src={lead.image}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#111118] via-transparent to-transparent" />
                  </div>
                ) : (
                  <div className="h-52 md:h-full min-h-[220px] flex items-center justify-center text-5xl opacity-25">
                    📰
                  </div>
                )}

                <div className="p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="gash-badge !text-[10px]"
                      style={{ background: `${lead.color}18`, color: lead.color, borderColor: `${lead.color}38` }}
                    >
                      {lead.sourceName}
                    </span>
                    <span className="text-[11px] text-[#5a5a70]">{ago(lead.pubDate)}</span>
                  </div>
                  <h2 className="text-[20px] md:text-[24px] font-black text-white leading-tight mb-3 group-hover:text-[#a68fff] transition-colors">
                    {lead.title}
                  </h2>
                  {lead.description && (
                    <p className="text-[13.5px] text-[#8a8a9e] leading-relaxed line-clamp-2">{lead.description}</p>
                  )}
                </div>
              </div>
            </a>
          )}

          {/* Остальные */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rest.map((n, i) => (
              <a
                key={`${n.link}-${i}`}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="gash-card overflow-hidden no-underline group flex flex-col animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 14) * 0.035}s` }}
              >
                {n.image && (
                  <div className="h-36 overflow-hidden flex-shrink-0">
                    <img
                      src={n.image}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-md"
                      style={{ background: `${n.color}18`, color: n.color }}
                    >
                      {n.sourceName}
                    </span>
                    <span className="text-[10.5px] text-[#5a5a70]">{ago(n.pubDate)}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-[#e4e4ee] leading-snug line-clamp-3 group-hover:text-[#a68fff] transition-colors flex-1">
                    {n.title}
                  </h3>
                </div>
              </a>
            ))}
          </div>

          <p className="text-center text-[12px] text-[#5a5a70] mt-6">
            Показано {shown.length} новостей · нажмите, чтобы открыть оригинал
          </p>
        </>
      )}
    </div>
  );
}
