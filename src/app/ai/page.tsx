"use client";

import { useState, useEffect, useCallback } from "react";

interface AiImage {
  id: number;
  prompt: string;
  url: string;
  style: string | null;
  width: number;
  height: number;
  createdAt: string;
}

interface Style {
  key: string;
  label: string;
  emoji: string;
}

const SIZES = [
  { k: "square", l: "Квадрат", ratio: "1:1", icon: "⬜" },
  { k: "wide", l: "Широкий", ratio: "16:9", icon: "▭" },
  { k: "tall", l: "Вертикальный", ratio: "9:16", icon: "▯" },
];

const IDEAS = [
  "неоновый город под дождём ночью",
  "космонавт играет на гитаре на Луне",
  "кот в солнечных очках на пляже",
  "древний храм в джунглях на закате",
  "робот-музыкант в студии звукозаписи",
  "дракон над заснеженными горами",
  "ретро-машина на пустой трассе",
  "подводный город с башнями из кораллов",
];

export default function AiPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("none");
  const [size, setSize] = useState("square");
  const [styles, setStyles] = useState<Style[]>([]);
  const [images, setImages] = useState<AiImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [current, setCurrent] = useState<AiImage | null>(null);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<AiImage | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/image");
      const d = await r.json();
      setImages(d.images || []);
      if (d.styles?.length) setStyles(d.styles);
    } catch {
      /* тихо */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const generate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (prompt.trim().length < 2) return;
    setBusy(true);
    setError("");
    setCurrent(null);

    try {
      const r = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style, size }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Не удалось создать");
        return;
      }
      setCurrent(d.image);
      setLoadingImg(true);
      void load();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setImages((p) => p.filter((x) => x.id !== id));
    if (current?.id === id) setCurrent(null);
    await fetch(`/api/ai/image?id=${id}`, { method: "DELETE" });
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      {/* Просмотр во весь экран */}
      {lightbox && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade"
          onClick={() => setLightbox(null)}>
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.prompt} className="w-full rounded-2xl" />
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <p className="text-[13px] text-[#c8c8d8] flex-1 min-w-[200px]">{lightbox.prompt}</p>
              <div className="flex gap-2">
                <a href={lightbox.url} download target="_blank" rel="noopener noreferrer"
                  className="gash-btn no-underline !py-2 !text-[13px]">📥 Скачать</a>
                <button onClick={() => setLightbox(null)} className="gash-btn-ghost">Закрыть</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-head animate-fade-in">
        <div className="status-pill ok">
          <span className="live-dot" />
          Нейросеть Flux · бесплатно и без ключей
        </div>
        <h1><span className="gradient-text">AI-картинки</span></h1>
        <p>Опишите словами, что нарисовать — нейросеть создаст изображение за несколько секунд</p>
      </div>

      {/* Форма */}
      <form onSubmit={generate} className="gash-card gash-card-static gash-card-glow p-5 mb-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Например: ракета взлетает над ночным городом, неоновые огни…"
          maxLength={500}
          rows={3}
          className="gash-textarea mb-2"
        />
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span className="text-[11px] text-[#5a5a6a]">{prompt.length}/500</span>
          <div className="flex gap-1.5 flex-wrap">
            {IDEAS.slice(0, 3).map((i) => (
              <button key={i} type="button" onClick={() => setPrompt(i)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.05] text-[#8a8a99] hover:bg-white/[0.1] hover:text-white transition-all">
                {i.slice(0, 22)}…
              </button>
            ))}
            <button type="button" onClick={() => setPrompt(IDEAS[Math.floor(Math.random() * IDEAS.length)])}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#6c5ce7]/15 text-[#a99bff] hover:bg-[#6c5ce7]/25 transition-all">
              🎲 Случайно
            </button>
          </div>
        </div>

        {/* Стили */}
        <p className="section-title">Стиль</p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-4">
          {styles.map((s) => (
            <button key={s.key} type="button" onClick={() => setStyle(s.key)}
              className={`artist-chip ${style === s.key ? "on" : ""}`}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {/* Размер */}
        <p className="section-title">Формат</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {SIZES.map((s) => (
            <button key={s.k} type="button" onClick={() => setSize(s.k)}
              className={`py-3 rounded-xl border font-bold text-[12.5px] transition-all ${
                size === s.k
                  ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white border-transparent tab-active-glow"
                  : "bg-white/[0.04] text-[#8a8a99] border-white/[0.08] hover:bg-white/[0.08]"
              }`}>
              <span className="block text-base mb-0.5">{s.icon}</span>
              {s.l}
              <span className="block text-[10px] opacity-70">{s.ratio}</span>
            </button>
          ))}
        </div>

        {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

        <button type="submit" disabled={busy || prompt.trim().length < 2} className="gash-btn w-full !py-4 !text-base">
          {busy ? "Отправляем запрос…" : "✨ Создать картинку"}
        </button>
      </form>

      {/* Результат */}
      {current && (
        <div className="gash-card gash-card-static p-4 mb-5 animate-rise">
          <div className="relative rounded-2xl overflow-hidden bg-[#101017] flex items-center justify-center"
            style={{ minHeight: 260 }}>
            {loadingImg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <div className="gash-loader" />
                <p className="text-[12.5px] text-[#8a8a99]">Нейросеть рисует… это займёт до 20 секунд</p>
              </div>
            )}
            <img
              src={current.url}
              alt={current.prompt}
              onLoad={() => setLoadingImg(false)}
              onError={() => { setLoadingImg(false); setError("Не удалось загрузить картинку, попробуйте ещё раз"); }}
              className="w-full max-h-[520px] object-contain cursor-zoom-in"
              onClick={() => setLightbox(current)}
              style={{ opacity: loadingImg ? 0 : 1, transition: "opacity 0.4s ease" }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <p className="text-[13px] text-[#a8a8b8] flex-1 min-w-[180px]">{current.prompt}</p>
            <div className="flex gap-2">
              <a href={current.url} download target="_blank" rel="noopener noreferrer"
                className="gash-btn !py-2 !text-[13px] no-underline">📥 Скачать</a>
              <button onClick={() => void generate()} className="gash-btn-ghost">🔄 Ещё вариант</button>
            </div>
          </div>
        </div>
      )}

      {/* Галерея */}
      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-extrabold text-[#e8e8f0]">🖼 Мои картинки ({images.length})</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={img.id} className="gash-card overflow-hidden group animate-fade-in"
                style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}>
                <div className="relative aspect-square bg-[#101017]">
                  <img src={img.url} alt={img.prompt} loading="lazy"
                    onClick={() => setLightbox(img)}
                    className="w-full h-full object-cover cursor-zoom-in" />
                  <button onClick={() => void remove(img.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-[#ff8098] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[13px]">
                    🗑
                  </button>
                </div>
                <p className="text-[11px] text-[#8a8a99] p-2.5 line-clamp-2 leading-snug">{img.prompt}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {images.length === 0 && !current && (
        <div className="gash-card gash-card-static empty-state">
          <div className="icon">🎨</div>
          <p className="title">Картинок пока нет</p>
          <p className="hint">Опишите идею выше и нажмите «Создать»</p>
        </div>
      )}
    </div>
  );
}
