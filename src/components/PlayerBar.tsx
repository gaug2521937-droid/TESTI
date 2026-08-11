"use client";

import { usePlayer } from "./PlayerContext";
import { Visualizer } from "./Visualizer";
import { AddToPlaylist } from "./AddToPlaylist";

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
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
    queue,
    index,
    fullscreen,
    engine,
    toggle,
    next,
    prev,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    close,
    setFullscreen,
  } = usePlayer();

  if (!current || fullscreen) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <>
      <div className="h-[96px] sm:h-[88px]" />

      <div className="player-bar">
        {/* Полоса прогресса */}
        <div className="h-[3px] w-full bg-white/[0.08]">
          <div
            className="h-full transition-[width] duration-150"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #6c5ce7, #00d2ff)",
              boxShadow: "0 0 12px rgba(108,92,231,0.9)",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* Обложка + инфо (клик → полный экран) */}
            <button
              onClick={() => setFullscreen(true)}
              className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-[230px] lg:w-[280px] text-left group"
              title="Открыть полный экран"
            >
              <div className="relative flex-shrink-0">
                <img src={current.artworkLarge} alt="" className="player-art" />
                <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-white truncate leading-tight">
                  {current.title}
                </p>
                <p className="text-[12px] text-[#9a9aa8] truncate">{current.artist}</p>
                <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
                  <span
                    className="gash-badge !text-[9px] !px-1.5 !py-0 gash-badge-success"
                    title={engine === "youtube" ? "Полная версия через YouTube" : "Полный трек"}
                  >
                    {engine === "youtube" ? "▶ FULL" : "FULL"}
                  </span>
                  {queue.length > 1 && (
                    <span className="text-[10px] text-[#6a6a7a]">
                      {index + 1}/{queue.length}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Мини-визуализатор */}
            <div className="hidden xl:block w-[110px] flex-shrink-0 opacity-80">
              <Visualizer bars={22} height={34} variant="mirror" />
            </div>

            {/* Управление */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={toggleShuffle}
                  className={`icon-btn hidden sm:flex ${shuffle ? "on" : ""}`}
                  title="Перемешать"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" />
                  </svg>
                </button>

                <button onClick={prev} className="icon-btn" title="Предыдущий">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 5h2v14H6zM19 5v14l-11-7z" />
                  </svg>
                </button>

                <button onClick={toggle} className="play-fab" title={isPlaying ? "Пауза" : "Играть"}>
                  {loadingTrack ? (
                    <span className="gash-loader !w-5 !h-5 !border-2 !border-white/25 !border-t-white" />
                  ) : isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1.2" />
                      <rect x="14" y="4" width="4" height="16" rx="1.2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4.5v15l13-7.5z" />
                    </svg>
                  )}
                </button>

                <button onClick={next} className="icon-btn" title="Следующий">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 5h2v14h-2zM5 5v14l11-7z" />
                  </svg>
                </button>

                <button
                  onClick={cycleRepeat}
                  className={`icon-btn hidden sm:flex relative ${repeat !== "off" ? "on" : ""}`}
                  title="Повтор"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
                  </svg>
                  {repeat === "one" && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#6c5ce7] text-white text-[8px] font-extrabold flex items-center justify-center">
                      1
                    </span>
                  )}
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2.5 w-full max-w-[420px]">
                <span className="text-[11px] text-[#8a8a99] tabular-nums w-9 text-right">
                  {fmt(progress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 30}
                  step={0.1}
                  value={progress}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="range-slider flex-1"
                  style={{
                    background: `linear-gradient(90deg, #6c5ce7 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
                  }}
                />
                <span className="text-[11px] text-[#8a8a99] tabular-nums w-9">{fmt(duration)}</span>
              </div>
            </div>

            {/* Правая часть */}
            <div className="hidden lg:flex items-center gap-1.5 w-[210px] justify-end">
              <AddToPlaylist track={current} variant="icon" />
              <button onClick={toggleMute} className="icon-btn" title="Звук">
                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                className="range-slider !w-[70px]"
                style={{
                  background: `linear-gradient(90deg, #6c5ce7 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) ${(muted ? 0 : volume) * 100}%)`,
                }}
              />
              <button
                onClick={() => setFullscreen(true)}
                className="icon-btn"
                title="Полный экран"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
              <button onClick={close} className="icon-btn hover:!text-[#ff5470]" title="Закрыть">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setFullscreen(true)}
              className="icon-btn lg:hidden"
              title="Полный экран"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>

          {/* Мобильный прогресс */}
          <div className="flex sm:hidden items-center gap-2 mt-1.5">
            <span className="text-[10px] text-[#8a8a99] tabular-nums w-8 text-right">
              {fmt(progress)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 30}
              step={0.1}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="range-slider flex-1"
              style={{
                background: `linear-gradient(90deg, #6c5ce7 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
              }}
            />
            <span className="text-[10px] text-[#8a8a99] tabular-nums w-8">{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
