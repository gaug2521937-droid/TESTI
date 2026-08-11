"use client";

import { useState, useCallback } from "react";

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

function dur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

const QUICK = ["Баста", "Miyagi", "УННВ", "новый клип 2026", "русский рэп", "живой концерт"];

/** Поиск клипов в VK Video с прямым скачиванием */
export function VkClips() {
  const [q, setQ] = useState("");
  const [videos, setVideos] = useState<VkVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState<VkVideo | null>(null);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const r = await fetch(`/api/vk/video?mode=video&q=${encodeURIComponent(term)}&count=24`);
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка поиска");
        setVideos([]);
        return;
      }
      setVideos(d.videos || []);
    } catch {
      setError("Не удалось выполнить поиск");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      {/* Модалка с плеером и загрузкой */}
      {open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 animate-fade">
          <div className="absolute inset-0 bg-black/88 backdrop-blur-md" onClick={() => setOpen(null)} />
          <div className="relative w-full max-w-3xl animate-rise">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-extrabold text-white line-clamp-2">{open.title}</p>
                <p className="text-[12.5px] text-[#8a8a9e] mt-0.5">
                  {open.author} · {nf(open.views)} просмотров · {dur(open.duration)}
                </p>
              </div>
              <button onClick={() => setOpen(null)} className="icon-btn !w-10 !h-10 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <video
              src={open.files[0]?.url}
              poster={open.thumb}
              controls
              autoPlay
              className="w-full max-h-[52vh] rounded-2xl bg-black border border-white/[0.1]"
            />

            <p className="section-title mt-4">Скачать</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {open.files.map((f) => (
                <a
                  key={f.quality}
                  href={`/api/video/file?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(
                    `${open.title.slice(0, 50)}_${f.quality}.mp4`
                  )}`}
                  className="gash-btn-outline justify-center no-underline !py-3 !text-[13px]"
                >
                  📥 {f.quality}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <form
        onSubmit={(e) => { e.preventDefault(); void search(q); }}
        className="gash-card gash-card-static gash-card-glow p-2.5 mb-3 flex gap-2.5"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Клип, концерт, исполнитель…"
          className="gash-input !border-transparent !bg-transparent focus:!bg-white/[0.03]"
        />
        <button type="submit" disabled={loading || !q.trim()} className="gash-btn">
          {loading ? <span className="gash-loader !w-4 !h-4 !border-2" /> : "Найти"}
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
        {QUICK.map((t) => (
          <button key={t} onClick={() => { setQ(t); void search(t); }} className="artist-chip">
            {t}
          </button>
        ))}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[196px]" />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="gash-card gash-card-static empty-state">
          <div className="icon">🎬</div>
          <p className="title">{searched ? "Ничего не найдено" : "Найдите клип"}</p>
          <p className="hint">
            {searched ? "Попробуйте другой запрос" : "Введите название или выберите подсказку выше"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-[#8a8a9e] mb-3">
            Найдено {videos.length} · нажмите, чтобы смотреть и скачать
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setOpen(v)}
                className="gash-card overflow-hidden text-left group animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 12) * 0.035}s` }}
              >
                <div className="relative aspect-video bg-black/40">
                  {v.thumb ? (
                    <img
                      src={v.thumb}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">🎬</div>
                  )}

                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#111">
                        <path d="M7 4.5v15l13-7.5z" />
                      </svg>
                    </span>
                  </div>

                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-[10.5px] font-bold text-white tabular-nums">
                    {dur(v.duration)}
                  </span>
                  {v.files[0] && (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#34e5a0]/22 border border-[#34e5a0]/40 text-[9.5px] font-extrabold text-[#5ff0c0]">
                      до {v.files[0].quality}
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-[13px] font-bold text-[#e4e4ee] line-clamp-2 leading-snug group-hover:text-[#a68fff] transition-colors">
                    {v.title}
                  </p>
                  <p className="text-[11px] text-[#5a5a70] mt-1.5 truncate">
                    {v.author} · 👁 {nf(v.views)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
