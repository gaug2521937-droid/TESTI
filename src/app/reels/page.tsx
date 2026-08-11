"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface VkVideo {
  id: string;
  title: string;
  description: string;
  duration: number;
  views: number;
  likes: number;
  thumb: string;
  author: string;
  files: { quality: string; url: string; height: number }[];
}

function nf(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/**
 * Лента коротких видео из VK — вертикальная прокрутка,
 * автовоспроизведение текущего, скачивание и переход к следующему.
 */
export default function ReelsPage() {
  const [reels, setReels] = useState<VkVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setCurrent(0);
    try {
      const r = await fetch(`/api/vk/reels?mode=reels&q=${encodeURIComponent(q)}&count=30`);
      const d = await r.json();
      setReels(d.videos || []);
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  /**
   * Отслеживаем, какое видео сейчас в центре экрана — оно и играет.
   * Остальные ставим на паузу, чтобы не жрать сеть и звук.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setCurrent(idx);
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    el.querySelectorAll("[data-idx]").forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [reels]);

  const scroll = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(reels.length - 1, current + dir));
    const el = containerRef.current?.querySelector(`[data-idx="${next}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-6">
      <div className="page-head animate-fade-in">
        <div className="status-pill ok">
          <span className="live-dot" />
          Короткие видео из VK · вертикальная лента
        </div>
        <h1><span className="gradient-text">Рилс</span></h1>
        <p>Прокручивайте вниз для следующего видео. Звук включается по клику на иконку.</p>
      </div>

      {/* Поиск и подсказки */}
      <form
        onSubmit={(e) => { e.preventDefault(); void load(query); }}
        className="gash-card gash-card-static gash-card-glow p-2.5 mb-3 flex gap-2.5"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Тема, автор, интерес…"
          className="gash-input !border-transparent !bg-transparent focus:!bg-white/[0.03]"
        />
        <button type="submit" disabled={loading} className="gash-btn">
          {loading ? <span className="gash-loader !w-4 !h-4 !border-2" /> : "Найти"}
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
        {["мем", "прикол", "танцы", "музыка", "спорт", "готовка", "юмор"].map((t) => (
          <button
            key={t}
            onClick={() => { setQuery(t); void load(t); }}
            className="artist-chip"
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "9/16" }} />
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="gash-card gash-card-static empty-state">
          <div className="icon">🎬</div>
          <p className="title">Ничего не найдено</p>
          <p className="hint">Попробуйте другой запрос</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-5">
          {/* Активное видео */}
          <div
            ref={containerRef}
            className="h-[calc(100vh-260px)] overflow-y-auto snap-y snap-mandatory space-y-4 no-scrollbar rounded-2xl"
          >
            {reels.map((r, i) => {
              const isActive = i === current;
              return (
                <div
                  key={r.id}
                  data-idx={i}
                  className="snap-center relative rounded-2xl overflow-hidden bg-black"
                  style={{ aspectRatio: "9/16", minHeight: 500 }}
                >
                  {isActive ? (
                    <video
                      src={r.files[0]?.url}
                      poster={r.thumb}
                      autoPlay
                      muted={muted}
                      playsInline
                      loop
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img src={r.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                  )}

                  {/* Оверлей с текстом */}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                    <p className="text-[13.5px] font-extrabold text-white line-clamp-2 leading-snug">
                      {r.title}
                    </p>
                    <p className="text-[11.5px] text-white/70 mt-1">
                      {r.author} · 👁 {nf(r.views)}
                    </p>
                  </div>

                  {/* Кнопка звука */}
                  {isActive && (
                    <button
                      onClick={() => setMuted((m) => !m)}
                      className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white text-lg flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      {muted ? "🔇" : "🔊"}
                    </button>
                  )}

                  {/* Скачать */}
                  {isActive && r.files[0] && (
                    <a
                      href={`/api/video/file?url=${encodeURIComponent(r.files[0].url)}&name=${encodeURIComponent(r.title.slice(0, 40) + ".mp4")}`}
                      className="absolute top-3 left-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white text-lg flex items-center justify-center hover:bg-black/80 transition-colors no-underline"
                    >
                      📥
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Боковая панель с превью и управлением */}
          <div className="hidden lg:block space-y-3">
            <div className="gash-card gash-card-static p-4">
              <p className="text-[10.5px] uppercase tracking-wider font-black text-[#5a5a70] mb-2">
                Текущее видео
              </p>
              <p className="text-[15px] font-black text-white line-clamp-2 mb-3 leading-tight">
                {reels[current]?.title}
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] text-[#8a8a9e]">
                  {reels[current]?.author}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { l: "Просмотры", v: nf(reels[current]?.views ?? 0), c: "#a68fff" },
                  { l: "Лайки", v: nf(reels[current]?.likes ?? 0), c: "#ff4d6d" },
                  { l: "Длина", v: `${reels[current]?.duration ?? 0}с`, c: "#34e5a0" },
                ].map((s) => (
                  <div key={s.l} className="stat-tile !p-2.5">
                    <div className="v !text-[13px]" style={{ color: s.c }}>{s.v}</div>
                    <div className="l !text-[9px]">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Качества для скачивания */}
              <p className="section-title !mb-2">Скачать</p>
              <div className="grid grid-cols-2 gap-1.5">
                {reels[current]?.files.slice(0, 4).map((f) => (
                  <a
                    key={f.quality}
                    href={`/api/video/file?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(reels[current].title.slice(0, 40) + `_${f.quality}.mp4`)}`}
                    className="gash-btn-outline justify-center no-underline !py-2 !text-[12px]"
                  >
                    📥 {f.quality}
                  </a>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => scroll(-1)}
                disabled={current === 0}
                className="flex-1 gash-btn-ghost justify-center"
              >
                ↑ Пред.
              </button>
              <button
                onClick={() => scroll(1)}
                disabled={current === reels.length - 1}
                className="flex-1 gash-btn justify-center"
              >
                След. ↓
              </button>
            </div>

            <p className="text-[11px] text-[#5a5a70] text-center">
              {current + 1} из {reels.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
