"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePlayer } from "./PlayerContext";
import { Visualizer } from "./Visualizer";
import { AddToPlaylist } from "./AddToPlaylist";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Полноэкранный экран воспроизведения в стиле iPhone «Сейчас играет» */
export function NowPlaying() {
  const {
    current,
    isPlaying,
    progress,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    loadingTrack,
    error,
    engine,
    fullscreen,
    queue,
    index,
    queueName,
    toggle,
    next,
    prev,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setFullscreen,
    sleepLeft,
    setSleep,
    jumpTo,
  } = usePlayer();

  const [tab, setTab] = useState<"art" | "lyrics" | "queue">("art");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsFound, setLyricsFound] = useState(true);
  const [synced, setSynced] = useState<{ time: number; text: string }[] | null>(null);
  const [lyricsSource, setLyricsSource] = useState("");
  const lyricsBoxRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  // Подгружаем текст при смене трека или открытии вкладки
  useEffect(() => {
    if (tab !== "lyrics" || !current) return;
    let alive = true;
    setLyricsLoading(true);
    setLyrics(null);
    fetch(
      `/api/music/lyrics?artist=${encodeURIComponent(current.artist)}` +
      `&title=${encodeURIComponent(current.title)}&duration=${Math.round(duration || current.duration || 0)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setLyrics(d.plain ?? null);
        setSynced(Array.isArray(d.synced) && d.synced.length > 0 ? d.synced : null);
        setLyricsSource(d.source ?? "");
        setLyricsFound(Boolean(d.found));
      })
      .catch(() => alive && setLyricsFound(false))
      .finally(() => alive && setLyricsLoading(false));
    return () => { alive = false; };
  }, [tab, current]);

  // Строки текста без пустых — по ним считаем «где мы сейчас»
  const lines = useMemo(() => (lyrics ? lyrics.split("\n") : []), [lyrics]);
  const singable = useMemo(
    () => lines.map((l, i) => ({ text: l, i })).filter((l) => l.text.trim().length > 0),
    [lines]
  );

  /**
   * Караоке без временных меток: сервис отдаёт голый текст без таймингов.
   * Поэтому распределяем строки равномерно по длительности трека —
   * с небольшим сдвигом на вступление, чтобы попадать точнее.
   */
  const activeIdx = useMemo(() => {
    // Точные таймкоды из LRCLIB — подсветка попадает секунда в секунду
    if (synced && synced.length > 0) {
      let idx = -1;
      for (let i = 0; i < synced.length; i++) {
        if (progress + 0.25 >= synced[i].time) idx = i;
        else break;
      }
      return idx;
    }
    // Резерв: распределяем строки равномерно по длительности
    if (duration <= 0 || singable.length === 0) return -1;
    const intro = Math.min(8, duration * 0.06);
    const body = Math.max(1, duration - intro - duration * 0.04);
    const pos = (progress - intro) / body;
    if (pos < 0) return -1;
    return Math.min(singable.length - 1, Math.floor(pos * singable.length));
  }, [progress, duration, singable.length, synced]);

  // Строки для показа: синхронизированные приоритетнее
  const displayLines = useMemo(
    () => (synced ? synced.map((l, i) => ({ text: l.text, i, time: l.time })) : singable.map((l) => ({ ...l, time: -1 }))),
    [synced, singable]
  );

  // Автопрокрутка к активной строке
  useEffect(() => {
    if (tab !== "lyrics" || activeIdx < 0) return;
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx, tab]);

  // Блокируем скролл страницы под оверлеем
  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  // Закрытие по Escape
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, setFullscreen, toggle]);

  if (!fullscreen || !current) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const remaining = Math.max(0, duration - progress);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col animate-fade">
      {/* Размытая обложка на фоне */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={current.artworkLarge}
          alt=""
          className="w-full h-full object-cover scale-125 blur-[70px] opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b10]/80 via-[#0b0b10]/88 to-[#0b0b10]/96" />
      </div>

      {/* Контент */}
      <div className="relative flex-1 flex flex-col max-w-lg w-full mx-auto px-6 py-5 overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <button
            onClick={() => setFullscreen(false)}
            className="icon-btn !w-10 !h-10"
            title="Свернуть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a99] font-bold">
              {queueName}
            </p>
            <p className="text-[11.5px] text-[#c8c8d8] font-semibold mt-0.5">
              {index + 1} из {queue.length}
            </p>
          </div>

          <div className="seg-group !p-0.5">
            <button
              onClick={() => setTab("art")}
              className={`seg-btn !px-2.5 !py-1.5 ${tab === "art" ? "active" : ""}`}
              title="Обложка"
            >
              💿
            </button>
            <button
              onClick={() => setTab("lyrics")}
              className={`seg-btn !px-2.5 !py-1.5 ${tab === "lyrics" ? "active" : ""}`}
              title="Текст песни"
            >
              📝
            </button>
            <button
              onClick={() => setTab("queue")}
              className={`seg-btn !px-2.5 !py-1.5 ${tab === "queue" ? "active" : ""}`}
              title="Очередь"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Обложка или очередь */}
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {tab === "art" ? (
            <div className="flex flex-col items-center">
              <div
                className={`relative w-full max-w-[300px] aspect-square rounded-[28px] overflow-hidden transition-all duration-500 ${
                  isPlaying ? "scale-100" : "scale-[0.86]"
                }`}
                style={{
                  boxShadow: isPlaying
                    ? "0 34px 70px -24px rgba(0,0,0,1), 0 0 70px -18px rgba(108,92,231,0.75)"
                    : "0 20px 44px -22px rgba(0,0,0,1)",
                }}
              >
                <img
                  src={current.artworkLarge}
                  alt={current.album}
                  className="w-full h-full object-cover"
                />
                {loadingTrack && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <div className="gash-loader" />
                  </div>
                )}
              </div>

              {/* Визуализатор — полоски прыгают под музыку */}
              <div className="w-full max-w-[320px] mt-5">
                <Visualizer bars={40} height={66} variant="bars" />
              </div>
            </div>
          ) : tab === "lyrics" ? (
            <div className="h-full overflow-y-auto pr-1">
              {lyricsLoading ? (
                <div className="space-y-2.5 pt-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="skeleton h-4" style={{ width: `${55 + Math.random() * 40}%` }} />
                  ))}
                </div>
              ) : lyrics || synced ? (
                <>
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#0b0b10]/80 backdrop-blur-sm py-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#7a7a8a]">
                      🎤 Караоке
                      {synced && <span className="text-[#34e5a0] ml-1">· точная синхронизация</span>}
                      {activeIdx >= 0 && ` · ${activeIdx + 1}/${displayLines.length}`}
                      {lyricsSource && <span className="text-[#4a4a5e] ml-1">· {lyricsSource}</span>}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(lyrics ?? displayLines.map((l) => l.text).join("\n"))}
                      className="text-[11px] font-bold text-[#a99bff] hover:text-white transition-colors"
                    >
                      Копировать
                    </button>
                  </div>
                  <div className="pb-16">
                    {displayLines.map((l, k) => {
                      const isActive = k === activeIdx;
                      const isPast = k < activeIdx;
                      return (
                        <p
                          key={k}
                          ref={isActive ? activeLineRef : null}
                          onClick={() => {
                            // Клик по строке — точная перемотка
                            if (l.time >= 0) {
                              seek(Math.max(0, l.time - 0.15));
                            } else if (duration > 0 && displayLines.length > 0) {
                              const intro = Math.min(8, duration * 0.06);
                              const body = Math.max(1, duration - intro - duration * 0.04);
                              seek(intro + (k / displayLines.length) * body);
                            }
                          }}
                          className={`cursor-pointer py-[5px] px-3 -mx-3 rounded-xl transition-all duration-500 ${
                            isActive
                              ? "text-white font-black text-[22px] tracking-tight"
                              : isPast
                              ? "text-[#4a4a5e] text-[14px] font-medium opacity-70"
                              : "text-[#9a9aa8] text-[15px] font-semibold hover:text-white hover:bg-white/[0.04]"
                          }`}
                          style={
                            isActive
                              ? {
                                  background: "linear-gradient(90deg, rgba(124,92,255,0.28), rgba(124,92,255,0.08) 60%, transparent 100%)",
                                  textShadow: "0 0 24px rgba(124,92,255,0.7), 0 2px 12px rgba(0,0,0,0.4)",
                                  lineHeight: 1.35,
                                  transform: "translateX(6px)",
                                  borderLeft: "3px solid #7c5cff",
                                }
                              : { lineHeight: 1.7 }
                          }
                        >
                          {l.text}
                        </p>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="text-4xl mb-3 opacity-50">🔍</div>
                  <p className="text-[14px] font-bold text-[#c8c8d8] mb-1">Текст не найден</p>
                  <p className="text-[12.5px] text-[#6a6a7a]">
                    {lyricsFound ? "Попробуйте другой трек" : "Для этой песни текста нет в базе"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-1.5 pr-1">
              {queue.map((t, i) => (
                <button
                  key={`${t.id}-${i}`}
                  onClick={() => jumpTo(i)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                    i === index
                      ? "bg-white/[0.14] border border-white/20"
                      : "hover:bg-white/[0.07] border border-transparent"
                  }`}
                >
                  <span className="w-5 text-center text-[11px] text-[#8a8a99] font-bold flex-shrink-0">
                    {i === index && isPlaying ? (
                      <span className="eq !h-3 justify-center">
                        <span /><span /><span />
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <img src={t.artwork} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold truncate ${i === index ? "text-white" : "text-[#d0d0dc]"}`}>
                      {t.title}
                    </p>
                    <p className="text-[11.5px] text-[#8a8a99] truncate">{t.artist}</p>
                  </div>

                </button>
              ))}
            </div>
          )}
        </div>

        {/* Инфо о треке */}
        <div className="flex-shrink-0 mt-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[21px] font-extrabold text-white truncate leading-tight">
                {current.title}
              </h2>
              <p className="text-[15px] text-[#a8a8b8] truncate mt-0.5">{current.artist}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="gash-badge !text-[10px] gash-badge-success">
                  {engine === "youtube" ? "🎬 Полная версия" : "🎧 Полный трек"}
                </span>
                {current.genre && (
                  <span className="gash-badge gash-badge-neutral !text-[10px]">{current.genre}</span>
                )}
              </div>
            </div>
            <AddToPlaylist track={current} variant="icon" />
          </div>

          {error && <div className="gash-alert gash-alert-danger mb-3 !py-2.5 !text-[12.5px]">⚠️ {error}</div>}

          {/* Прогресс */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="range-slider"
              style={{
                background: `linear-gradient(90deg, #fff ${pct}%, rgba(255,255,255,0.18) ${pct}%)`,
              }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-[#8a8a99] tabular-nums font-semibold">
                {fmt(progress)}
              </span>
              <span className="text-[11px] text-[#8a8a99] tabular-nums font-semibold">
                −{fmt(remaining)}
              </span>
            </div>
          </div>

          {/* Управление */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={toggleShuffle}
              className={`icon-btn !w-11 !h-11 ${shuffle ? "on" : ""}`}
              title="Перемешать"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" />
              </svg>
            </button>

            <button onClick={prev} className="icon-btn !w-12 !h-12 !text-white" title="Назад">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h2v14H6zM19 5v14l-11-7z" />
              </svg>
            </button>

            <button
              onClick={toggle}
              className="w-[72px] h-[72px] rounded-full bg-white text-[#12121a] flex items-center justify-center shadow-[0_12px_36px_-10px_rgba(255,255,255,0.55)] hover:scale-105 active:scale-95 transition-transform"
            >
              {loadingTrack ? (
                <span className="gash-loader !w-6 !h-6 !border-[3px] !border-black/15 !border-t-black" />
              ) : isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4.2" height="16" rx="1.4" />
                  <rect x="13.8" y="4" width="4.2" height="16" rx="1.4" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.5 4.5v15L20 12z" />
                </svg>
              )}
            </button>

            <button onClick={next} className="icon-btn !w-12 !h-12 !text-white" title="Вперёд">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 5h2v14h-2zM5 5v14l11-7z" />
              </svg>
            </button>

            <button
              onClick={cycleRepeat}
              className={`icon-btn !w-11 !h-11 relative ${repeat !== "off" ? "on" : ""}`}
              title="Повтор"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
              </svg>
              {repeat === "one" && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6c5ce7] text-white text-[9px] font-extrabold flex items-center justify-center">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Громкость */}
          <div className="flex items-center gap-3 pb-1">
            <button onClick={toggleMute} className="icon-btn !w-8 !h-8 flex-shrink-0">
              {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="range-slider flex-1"
              style={{
                background: `linear-gradient(90deg, rgba(255,255,255,0.85) ${
                  (muted ? 0 : volume) * 100
                }%, rgba(255,255,255,0.18) ${(muted ? 0 : volume) * 100}%)`,
              }}
            />
            {/* Таймер сна */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => {
                  const mins = [0, 5, 10, 15, 30, 45, 60];
                  const now = sleepLeft > 0 ? Math.ceil(sleepLeft / 60) : 0;
                  const idx = mins.indexOf(now);
                  const next = mins[(idx + 1) % mins.length];
                  setSleep(next || null);
                }}
                className={`icon-btn !w-8 !h-8 ${sleepLeft > 0 ? "on" : ""}`}
                title="Таймер сна"
              >
                {sleepLeft > 0 ? (
                  <span className="text-[10px] font-black tabular-nums">
                    {Math.ceil(sleepLeft / 60)}м
                  </span>
                ) : "🌙"}
              </button>
            </div>
            <a
              href={current.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn !w-8 !h-8 flex-shrink-0"
              title="Открыть источник"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" /><path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
