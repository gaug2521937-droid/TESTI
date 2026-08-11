"use client";

import { useEffect, useRef } from "react";

/**
 * Движок полного воспроизведения через официальный IFrame Player API YouTube.
 *
 * Важно: плеер должен иметь РЕАЛЬНЫЕ размеры, иначе YouTube отказывается
 * стартовать (политика против скрытого автоплея). Поэтому увозим его
 * за пределы экрана, а не схлопываем в 1×1 пиксель.
 */

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  loadPlaylist(opts: { list: string; listType: string; index?: number }): void;
  loadVideoById(id: string): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, cfg: Record<string, unknown>) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeHandle {
  load(query: string): void;
  loadById(videoId: string): void;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  setVolume(v: number): void;
  getTime(): number;
  getDuration(): number;
}

let apiPromise: Promise<boolean> | null = null;

function loadApi(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.YT?.Player) return Promise.resolve(true);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<boolean>((resolve) => {
    // Если YouTube недоступен — не подвешиваем плеер навсегда
    const timer = setTimeout(() => resolve(false), 8000);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      prev?.();
      resolve(true);
    };

    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(s);
  });

  return apiPromise;
}

/**
 * Держим единственный YT-плеер на весь SPA — иначе при переходе
 * между вкладками iframe уносится в мусор и звук обрывается.
 */
const globalYT = globalThis as typeof globalThis & {
  __gashYtHost?: HTMLDivElement;
  __gashYtPlayer?: YTPlayer;
  __gashYtHandle?: YouTubeHandle;
  __gashYtCallbacks?: {
    onStateChange?: (s: "playing" | "paused" | "ended" | "buffering") => void;
  };
};

export function YouTubeEngine({
  onReady,
  onStateChange,
  onUnavailable,
}: {
  onReady: (handle: YouTubeHandle) => void;
  onStateChange: (state: "playing" | "paused" | "ended" | "buffering") => void;
  onUnavailable: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const queuedRef = useRef<string | null>(null);

  // Всегда актуальный колбэк — не привязан к старому замыканию
  useEffect(() => {
    globalYT.__gashYtCallbacks = { onStateChange };
  }, [onStateChange]);

  useEffect(() => {
    let disposed = false;

    // Плеер уже создан — переиспользуем его
    if (globalYT.__gashYtHandle && globalYT.__gashYtHost) {
      if (mountRef.current && globalYT.__gashYtHost.parentNode !== mountRef.current) {
        mountRef.current.appendChild(globalYT.__gashYtHost);
      }
      onReady(globalYT.__gashYtHandle);
      return () => { disposed = true; };
    }

    void loadApi().then((ok) => {
      if (disposed) return;
      if (!ok || !mountRef.current || !window.YT) {
        onUnavailable();
        return;
      }

      // Создаём отдельный контейнер, который никогда не размонтируется
      const host = document.createElement("div");
      mountRef.current.appendChild(host);
      globalYT.__gashYtHost = host;

      try {
        const player = new window.YT.Player(host, {
          height: "180",
          width: "320",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 0,
          },
          events: {
            onReady: () => {
              // hooked via globalYT above

              const handle: YouTubeHandle = {
                load(query) {
                  try {
                    player.loadPlaylist({ list: query, listType: "search", index: 0 });
                  } catch {
                    queuedRef.current = query;
                  }
                },
                loadById(id) {
                  try {
                    player.loadVideoById(id);
                  } catch {
                    queuedRef.current = id;
                  }
                },
                play: () => { try { player.playVideo(); } catch {} },
                pause: () => { try { player.pauseVideo(); } catch {} },
                seek: (s) => { try { player.seekTo(s, true); } catch {} },
                setVolume: (v) => {
                  try {
                    player.setVolume(Math.round(v * 100));
                    if (v === 0) player.mute();
                    else player.unMute();
                  } catch {}
                },
                getTime: () => { try { return player.getCurrentTime() || 0; } catch { return 0; } },
                getDuration: () => { try { return player.getDuration() || 0; } catch { return 0; } },
              };

              globalYT.__gashYtPlayer = player;
              globalYT.__gashYtHandle = handle;

              if (queuedRef.current) {
                handle.load(queuedRef.current);
                queuedRef.current = null;
              }
              onReady(handle);
            },
            onError: () => onStateChange("ended"),
            onStateChange: (e: { data: number }) => {
              const S = window.YT?.PlayerState;
              if (!S) return;
              // Всегда актуальный колбэк из globalYT — переживает навигацию
              const cb = globalYT.__gashYtCallbacks?.onStateChange;
              if (!cb) return;
              if (e.data === S.PLAYING) cb("playing");
              else if (e.data === S.PAUSED) cb("paused");
              else if (e.data === S.ENDED) cb("ended");
              else if (e.data === S.BUFFERING) cb("buffering");
            },
          },
        });
      } catch {
        onUnavailable();
      }
    });

    return () => {
      disposed = true;
      // Не разрушаем плеер: он живёт глобально и продолжит играть
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Реальный размер, но за пределами экрана — YouTube считает плеер видимым.
  // Сам плеер живёт в globalYT.__gashYtHost и переносится в этот контейнер
  // при перемонтировании, не теряя ни звука, ни состояния.
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        width: 320,
        height: 180,
        pointerEvents: "none",
      }}
    >
      <div ref={mountRef} />
    </div>
  );
}
