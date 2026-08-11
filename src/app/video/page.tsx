"use client";

import { useState } from "react";
import { VkClips } from "@/components/video/VkClips";

interface Fmt {
  label: string;
  quality: string;
  url: string;
  type: "video" | "audio";
  ext: string;
  size?: number;
}

interface VideoResult {
  success: boolean;
  platform: string;
  title: string;
  author: string;
  cover: string;
  downloadUrl?: string | null;
  videoId?: string;
  embedUrl?: string;
  watchUrl?: string;
  duration?: number;
  formats?: Fmt[];
  note?: string | null;
  stats?: { plays: number; likes: number; comments: number; shares: number };
}

export default function VideoPage() {
  const [tab, setTab] = useState<"link" | "vk">("link");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VideoResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/video/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при обработке видео");
        return;
      }
      setResult(data);
    } catch {
      setError("Не удалось обработать видео. Проверьте подключение к интернету.");
    } finally {
      setLoading(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      setError("Браузер не разрешил доступ к буферу обмена");
    }
  };

  const nf = (n: number) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
  };

  const isTikTok = result?.platform === "tiktok";

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      {/* Заголовок */}
      <div className="page-head animate-fade-in">
        <div className="status-pill">
          ⚡ Без водяных знаков · мгновенно
        </div>
        <h1>
          <span className="gradient-text">Видео</span>
        </h1>
        <p className="text-[#9a9aa8] max-w-lg mx-auto">
          YouTube, TikTok и VK. Плюс раздел «Рилс VK» для коротких видео.
        </p>
      </div>

      {/* Вкладки */}
      <div className="tab-bar grid-cols-2 mb-5">
        {([
          { k: "link", l: "По ссылке", i: "🔗" },
          { k: "vk", l: "Поиск клипов VK", i: "🎬" },
        ] as const).map((x) => (
          <button key={x.k} onClick={() => setTab(x.k)} className={`tab-item ${tab === x.k ? "on" : ""}`}>
            <span>{x.i}</span> {x.l}
          </button>
        ))}
      </div>

      {tab === "vk" && <VkClips />}

      {/* Форма */}
      {tab === "link" && (
      <form onSubmit={handleSubmit} className="mb-6 animate-fade-in">
        <div className="gash-card gash-card-static gash-card-glow p-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6a6a7a] pointer-events-none">
                🔗
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Ссылка YouTube, TikTok или VK…"
                className="gash-input !pl-11 !pr-20 !border-transparent !bg-transparent focus:!bg-white/[0.03]"
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-bold text-[#8577f0] hover:text-[#a99bff] px-2 py-1 rounded-md hover:bg-[#6c5ce7]/12 transition-colors"
              >
                Вставить
              </button>
            </div>
            <button type="submit" disabled={loading || !url.trim()} className="gash-btn">
              {loading ? <span className="gash-loader !w-4 !h-4 !border-2" /> : "📥 Скачать"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 px-1 flex-wrap">
          <span className="gash-badge gash-badge-neutral">🎵 TikTok · MP4 и MP3</span>
          <span className="gash-badge gash-badge-neutral">▶️ YouTube · 1080p, 720p, MP3</span>
          <span className="gash-badge gash-badge-neutral">🔵 VK · до 1080p</span>
        </div>
      </form>
      )}

      {tab === "link" && error && <div className="gash-alert gash-alert-danger mb-6">⚠️ {error}</div>}

      {/* Загрузка */}
      {tab === "link" && loading && (
        <div className="gash-card gash-card-static p-14 flex flex-col items-center gap-4">
          <div className="gash-loader" />
          <p className="text-[13.5px] text-[#8a8a99]">Извлекаем данные видео…</p>
        </div>
      )}

      {/* Результат */}
      {tab === "link" && result && !loading && (
        <div className="gash-card gash-card-static overflow-hidden animate-rise">
          {result.cover && (
            <div className="relative h-52 md:h-64">
              <img src={result.cover} alt={result.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a22] via-[#1a1a22]/30 to-transparent" />
              <div className="absolute top-4 left-4">
                <span
                  className="gash-badge backdrop-blur-md"
                  style={{
                    background: isTikTok ? "rgba(232,67,147,0.22)" : "rgba(255,71,87,0.22)",
                    color: isTikTok ? "#ff8cc8" : "#ff8a95",
                    borderColor: isTikTok ? "rgba(232,67,147,0.45)" : "rgba(255,71,87,0.45)",
                  }}
                >
                  {isTikTok ? "🎵 TikTok" : "▶️ YouTube"}
                </span>
              </div>
            </div>
          )}

          <div className="p-6">
            <h2 className="text-lg font-extrabold text-white mb-1.5 leading-snug">{result.title}</h2>
            <p className="text-[13.5px] text-[#8a8a99] mb-5 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#6c5ce7]/20 flex items-center justify-center text-[10px]">
                👤
              </span>
              {result.author}
            </p>

            {result.stats && (
              <div className="grid grid-cols-4 gap-2.5 mb-6">
                {[
                  { l: "Просмотры", v: result.stats.plays, i: "👁", c: "#a99bff" },
                  { l: "Лайки", v: result.stats.likes, i: "❤️", c: "#ff5470" },
                  { l: "Комменты", v: result.stats.comments, i: "💬", c: "#00d2ff" },
                  { l: "Репосты", v: result.stats.shares, i: "🔁", c: "#00e0a4" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                  >
                    <div className="text-base mb-1">{s.i}</div>
                    <div className="text-[14px] font-extrabold tabular-nums" style={{ color: s.c }}>
                      {nf(s.v)}
                    </div>
                    <div className="text-[10px] text-[#6a6a7a] mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              {result.downloadUrl && (
                <>
                  <a
                    href={result.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="gash-btn gash-btn-success no-underline"
                  >
                    📥 Скачать MP4
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.downloadUrl!)}
                    className="gash-btn-outline"
                  >
                    📋 Копировать ссылку
                  </button>
                </>
              )}
              {result.watchUrl && (
                <a
                  href={result.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gash-btn no-underline"
                >
                  ▶️ Открыть на YouTube
                </a>
              )}
            </div>

            {/* Встроенный проигрыватель */}
            {result.downloadUrl && (
              <div className="mt-6 rounded-2xl overflow-hidden border border-white/[0.07] bg-black">
                <video
                  src={result.downloadUrl}
                  controls
                  playsInline
                  poster={result.cover}
                  className="w-full max-h-[460px]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Инструкции */}
      {tab === "link" && !result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {[
            {
              icon: "🎵",
              title: "TikTok",
              color: "#e84393",
              steps: [
                "Откройте видео в приложении TikTok",
                "Нажмите «Поделиться» → «Копировать ссылку»",
                "Вставьте ссылку в поле выше",
                "Скачайте MP4 без водяного знака",
              ],
            },
            {
              icon: "▶️",
              title: "YouTube",
              color: "#ff4757",
              steps: [
                "Откройте нужное видео на YouTube",
                "Скопируйте ссылку из адресной строки",
                "Вставьте её в поле выше",
                "Выберите качество и скачайте",
              ],
            },
          ].map((card) => (
            <div key={card.title} className="gash-card p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="icon-tile"
                  style={{ background: `${card.color}18`, color: card.color }}
                >
                  {card.icon}
                </div>
                <h3 className="text-base font-extrabold text-[#e8e8f0]">{card.title}</h3>
              </div>
              <ol className="space-y-2.5">
                {card.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#8a8a99]">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10.5px] font-extrabold flex-shrink-0 mt-0.5"
                      style={{ background: `${card.color}1c`, color: card.color }}
                    >
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
