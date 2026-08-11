"use client";

import { YouTubeEngine, type YouTubeHandle } from "./YouTubeEngine";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface Track {
  id: string;
  /** Прямой id ролика — плеер грузит его без поиска по названию */
  youtubeId?: string;
  source: "audius" | "archive" | "ccmixter" | "deezer" | "itunes" | "ytmusic";
  title: string;
  artist: string;
  album: string;
  artwork: string;
  artworkLarge: string;
  streamUrl: string;
  duration: number;
  genre: string;
  year: string;
  externalUrl: string;
  isFull: boolean;
  plays?: number;
}

interface PlayerState {
  queue: Track[];
  current: Track | null;
  index: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  loadingTrack: boolean;
  error: string;
  /** Каким движком играет текущий трек */
  engine: "audio" | "youtube";
  /** Играет ли трек целиком */
  playingFull: boolean;
  fullscreen: boolean;
  queueName: string;
  sleepLeft: number;
  setSleep: (minutes: number | null) => void;
  playTrack: (track: Track, queue?: Track[], queueName?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (v: number) => void;
  changeVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  close: () => void;
  setFullscreen: (v: boolean) => void;
  addToQueue: (t: Track) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  /** Частотные данные для визуализатора (0..255). Реальные или синтезированные. */
  getSpectrum: (bars: number) => number[];
}

const PlayerCtx = createContext<PlayerState | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer должен использоваться внутри PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const connectedRef = useRef(false);

  // Восстанавливаем состояние из globalThis — переживает пересоздание провайдера
  const globalPlayer = globalThis as typeof globalThis & {
    __gashQueue?: Track[];
    __gashQueueName?: string;
    __gashIndex?: number;
    __gashVolume?: number;
  };
  const [queue, setQueueRaw] = useState<Track[]>(() => globalPlayer.__gashQueue ?? []);
  const [queueName, setQueueNameRaw] = useState(() => globalPlayer.__gashQueueName ?? "Очередь");
  const [index, setIndexRaw] = useState(() => globalPlayer.__gashIndex ?? -1);

  // Обёртки, которые синхронизируют состояние с globalThis
  const setQueue = useCallback((q: Track[] | ((prev: Track[]) => Track[])) => {
    setQueueRaw((prev) => {
      const next = typeof q === "function" ? q(prev) : q;
      globalPlayer.__gashQueue = next;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setQueueName = useCallback((n: string) => {
    globalPlayer.__gashQueueName = n;
    setQueueNameRaw(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setIndex = useCallback((i: number | ((prev: number) => number)) => {
    setIndexRaw((prev) => {
      const next = typeof i === "function" ? i(prev) : i;
      globalPlayer.__gashIndex = next;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeRaw] = useState(() => globalPlayer.__gashVolume ?? 0.85);
  const [muted, setMuted] = useState(false);
  const setVolume = useCallback((v: number) => {
    globalPlayer.__gashVolume = v;
    setVolumeRaw(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "one" | "all">("off");
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [error, setError] = useState("");

  // YouTube-движок для треков, у которых есть только 30-сек превью
  const ytRef = useRef<YouTubeHandle | null>(null);
  const [ytReady, setYtReady] = useState(false);
  const ytOkRef = useRef(true);            // доступен ли YouTube вообще
  const pendingYtRef = useRef<Track | null>(null); // трек, ждущий готовности движка
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [engine, setEngine] = useState<"audio" | "youtube">("audio");
  const engineRef = useRef<"audio" | "youtube">("audio");
  useEffect(() => { engineRef.current = engine; }, [engine]);
  const playingRef = useRef(false);
  const nextRef = useRef<() => void>(() => {});
  const repeatRef = useRef<"off" | "one" | "all">("off");
  const [fullscreen, setFullscreen] = useState(false);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState(0);

  const current = index >= 0 && index < queue.length ? queue[index] : null;

  // --- Инициализация аудио (переживает пересоздания React) ---
  useEffect(() => {
    const g = globalThis as typeof globalThis & { __gashAudio?: HTMLAudioElement };
    const audio =
      g.__gashAudio ??
      (() => {
        const a = new Audio();
        a.preload = "auto";
        a.volume = 0.85;
        a.crossOrigin = "anonymous";
        g.__gashAudio = a;
        return a;
      })();
    audioRef.current = audio;

    // Восстанавливаем текущее состояние аудио, которое пережило навигацию
    if (!audio.paused) setIsPlaying(true);
    if (audio.duration) setDuration(audio.duration);
    if (audio.currentTime) setProgress(audio.currentTime);
    audio.volume = volume;

    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      setError("");
      void ctxRef.current?.resume();
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setLoadingTrack(true);
    const onPlaying = () => setLoadingTrack(false);
    const onCanPlay = () => setLoadingTrack(false);
    const onError = () => {
      setLoadingTrack(false);
      setIsPlaying(false);
      setError("Не удалось загрузить трек. Попробуйте другой.");
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    // Важно: не останавливаем и не закрываем AudioContext.
    // Провайдер живёт в корневом макете и не должен размонтироваться,
    // но при HMR или переходах React иногда пересоздаёт эффекты —
    // тогда звук прерывался. Оставляем аудио живым.
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // --- Подключаем анализатор при первом воспроизведении (нужен жест пользователя) ---
  const ensureAnalyser = useCallback(() => {
    if (connectedRef.current || !audioRef.current) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      const srcNode = ac.createMediaElementSource(audioRef.current);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      srcNode.connect(analyser);
      analyser.connect(ac.destination);
      ctxRef.current = ac;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      connectedRef.current = true;
    } catch {
      // Анализатор недоступен — визуализатор перейдёт в синтезированный режим
      connectedRef.current = true;
    }
  }, []);

  // --- Спектр для визуализатора ---
  const getSpectrum = useCallback(
    (bars: number): number[] => {
      const analyser = analyserRef.current;
      const buf = dataRef.current;

      if (analyser && buf) {
        analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
        const out: number[] = [];
        // Логарифмическая группировка — низкие частоты слева, как в реальных эквалайзерах
        const usable = Math.floor(buf.length * 0.72);
        for (let i = 0; i < bars; i++) {
          const start = Math.floor(Math.pow(i / bars, 1.6) * usable);
          const end = Math.max(start + 1, Math.floor(Math.pow((i + 1) / bars, 1.6) * usable));
          let sum = 0;
          for (let j = start; j < end && j < buf.length; j++) sum += buf[j];
          out.push(sum / Math.max(1, end - start));
        }
        // Если пришла тишина при играющем треке — синтезируем
        const total = out.reduce((a, b) => a + b, 0);
        if (total > 4) return out;
      }

      // Синтезированный спектр (плавные волны, реагирует на play/pause)
      const t = performance.now() / 1000;
      return Array.from({ length: bars }, (_, i) => {
        if (!isPlaying) return 6;
        const x = i / bars;
        const bass = Math.pow(1 - x, 1.8) * 150;
        const w =
          Math.sin(t * 5.1 + i * 0.42) * 0.5 +
          Math.sin(t * 2.7 + i * 0.9) * 0.32 +
          Math.sin(t * 8.3 + i * 0.17) * 0.18;
        return Math.max(6, Math.min(255, bass + 70 + w * 78));
      });
    },
    [isPlaying]
  );

  // --- Следующий трек ---
  const next = useCallback(() => {
    setIndex((prev) => {
      if (queue.length === 0) return prev;
      if (shuffle && queue.length > 1) {
        let r = prev;
        while (r === prev) r = Math.floor(Math.random() * queue.length);
        return r;
      }
      if (prev + 1 >= queue.length) return repeat === "all" ? 0 : prev;
      return prev + 1;
    });
  }, [queue.length, shuffle, repeat]);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);

  // Таймер сна: выключаем звук по истечении времени
  useEffect(() => {
    if (!sleepAt) { setSleepLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.round((sleepAt - Date.now()) / 1000));
      setSleepLeft(left);
      if (left === 0) {
        audioRef.current?.pause();
        ytRef.current?.pause();
        setSleepAt(null);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [sleepAt]);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // --- Окончание трека ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (repeat === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      }
      const isLast = index + 1 >= queue.length;
      if (isLast && repeat === "off" && !shuffle) {
        setIsPlaying(false);
        return;
      }
      next();
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [repeat, next, index, queue.length, shuffle]);

  // --- Запись прослушивания для микса и рекомендаций ---
  useEffect(() => {
    if (!current) return;
    const track = current;

    // Опыт за прослушивание
    void fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "track" }),
    }).catch(() => {});

    // Фиксируем факт запуска
    void fetch("/api/music/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track, playedSeconds: 0 }),
    }).catch(() => {});

    // При смене трека дописываем, сколько реально прослушали
    return () => {
      const played = Math.round(audioRef.current?.currentTime ?? 0);
      if (played < 3) return;
      void fetch("/api/music/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, playedSeconds: played }),
      }).catch(() => {});
    };
  }, [current]);

  // --- Загрузка трека: YouTube для полной версии, прямой поток как запасной ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);

    // Прямой поток (Audius / Archive) — играем сразу, он надёжен
    const playDirect = () => {
      ytRef.current?.pause();
      setEngine("audio");
      if (!current.streamUrl) {
        setLoadingTrack(false);
        setError("У этого трека нет источника звука");
        return;
      }
      const absolute = new URL(current.streamUrl, window.location.origin).href;
      if (audio.src !== absolute) {
        audio.src = absolute;
        audio.load();
      }
      audio.volume = volume;
      audio.muted = muted;
      void audio.play().catch(() => setLoadingTrack(false));
    };

    // Плавное затухание перед сменой трека — играет постепенно
    if (!audio.paused && audio.currentTime > 0) {
      const startVol = audio.volume;
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          if (audioRef.current) audioRef.current.volume = startVol * (1 - i / steps);
        }, i * 40);
      }
      setTimeout(() => {
        if (audioRef.current) audioRef.current.volume = startVol;
      }, 400);
    }

    setLoadingTrack(true);
    setError("");
    setProgress(0);
    setDuration(0);

    // Полные треки — напрямую. Остальные — через YouTube целиком.
    const needsYt = (!current.isFull || current.source === "ytmusic" || Boolean(current.youtubeId)) && ytOkRef.current;

    // Движок ещё не поднялся — запоминаем трек и ждём, а не включаем обрезок
    if (needsYt && !ytRef.current) {
      pendingYtRef.current = current;
      setEngine("youtube");
      audio.pause();
      // Если через 9 секунд движок так и не готов — играем прямой поток
      fallbackTimer.current = setTimeout(() => {
        if (!ytRef.current) {
          ytOkRef.current = false;
          pendingYtRef.current = null;
          playDirect();
        }
      }, 9000);
      return;
    }

    const wantYt = needsYt && Boolean(ytRef.current);

    if (wantYt) {
      audio.pause();
      setEngine("youtube");
      // Точный ролик, если он известен — иначе ищем по названию
      if (current.youtubeId) {
        ytRef.current!.loadById(current.youtubeId);
      } else {
        const query = `${current.artist} ${current.title}`
          .replace(/\s*[([].*?[)\]]\s*/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        ytRef.current!.load(query);
      }
      ytRef.current!.setVolume(muted ? 0 : volume);
      ytRef.current!.play();

      // Если за 6 секунд YouTube не заиграл — падаем на прямой поток
      fallbackTimer.current = setTimeout(() => {
        if (engineRef.current === "youtube" && !playingRef.current) {
          playDirect();
        }
      }, 6000);
    } else {
      playDirect();
    }

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title,
          artist: current.artist,
          album: current.album,
          artwork: [{ src: current.artworkLarge, sizes: "600x600", type: "image/jpeg" }],
        });
      } catch {}
    }

    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ytReady]);

  // --- Тики прогресса для YouTube ---
  useEffect(() => {
    if (engine !== "youtube") return;
    const t = setInterval(() => {
      const yt = ytRef.current;
      if (!yt) return;
      setProgress(yt.getTime());
      const d = yt.getDuration();
      if (d > 0) setDuration(d);
    }, 500);
    return () => clearInterval(t);
  }, [engine]);

  // --- Кнопки ОС / наушников ---
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler("play", () => void audioRef.current?.play());
      navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
    } catch {
      /* игнорируем */
    }
  }, [next]);

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[], name?: string) => {
      ensureAnalyser();
      const audio = audioRef.current;

      if (current && current.id === track.id && audio) {
        if (audio.paused) void audio.play().catch(() => {});
        else audio.pause();
        return;
      }

      const list = newQueue && newQueue.length > 0 ? newQueue : [track];
      const i = list.findIndex((t) => t.id === track.id);
      setQueue(list);
      setQueueName(name ?? "Очередь");
      setIndex(i >= 0 ? i : 0);
      setProgress(0);
    },
    [current, ensureAnalyser]
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (engineRef.current === "youtube") {
      const yt = ytRef.current;
      if (!yt) return;
      if (isPlaying) yt.pause();
      else yt.play();
      return;
    }
    ensureAnalyser();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, [current, ensureAnalyser, isPlaying]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setIndex((i) => (queue.length === 0 ? i : (i - 1 + queue.length) % queue.length));
  }, [queue.length]);

  const seek = useCallback((v: number) => {
    if (engineRef.current === "youtube") {
      ytRef.current?.seek(v);
      setProgress(v);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = v;
    setProgress(v);
  }, []);

  const changeVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    setVolume(v);
    setMuted(v === 0);
    if (audio) {
      audio.volume = v;
      audio.muted = v === 0;
    }
    ytRef.current?.setVolume(v);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      if (audioRef.current) audioRef.current.muted = nm;
      ytRef.current?.setVolume(nm ? 0 : volume);
      return nm;
    });
  }, [volume]);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    []
  );

  const close = useCallback(() => {
    ytRef.current?.pause();
    setEngine("audio");
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setQueue([]);
    setIndex(-1);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setFullscreen(false);
  }, []);

  const addToQueue = useCallback((t: Track) => {
    setQueue((q) => (q.some((x) => x.id === t.id) ? q : [...q, t]));
  }, []);

  const removeFromQueue = useCallback(
    (i: number) => {
      setQueue((q) => q.filter((_, idx) => idx !== i));
      if (i < index) setIndex((v) => v - 1);
    },
    [index]
  );

  const jumpTo = useCallback((i: number) => setIndex(i), []);

  return (
    <PlayerCtx.Provider
      value={{
        queue,
        queueName,
        current,
        index,
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
        playingFull: engine === "youtube" || Boolean(current?.isFull),
        fullscreen,
        playTrack,
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
        sleepLeft,
        setSleep: (min) => setSleepAt(min ? Date.now() + min * 60_000 : null),
        addToQueue,
        removeFromQueue,
        jumpTo,
        getSpectrum,
      }}
    >
      {children}

      {/* Скрытый движок YouTube — играет треки целиком */}
      <YouTubeEngine
        onReady={(h) => {
          ytRef.current = h;
          h.setVolume(muted ? 0 : volume);
          setYtReady(true);
          // Трек, кликнутый до готовности движка, запускаем сейчас
          const waiting = pendingYtRef.current;
          if (waiting) {
            pendingYtRef.current = null;
            if (waiting.youtubeId) {
              h.loadById(waiting.youtubeId);
            } else {
              const q = `${waiting.artist} ${waiting.title}`
                .replace(/\s*[([].*?[)\]]\s*/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              h.load(q);
            }
            h.play();
          }
        }}
        onUnavailable={() => {
          ytOkRef.current = false;
          setYtReady(true);
        }}
        onStateChange={(st) => {
          if (engineRef.current !== "youtube") return;
          if (st === "playing") {
            setIsPlaying(true);
            setLoadingTrack(false);
            setError("");
          } else if (st === "paused") {
            setIsPlaying(false);
          } else if (st === "buffering") {
            setLoadingTrack(true);
          } else if (st === "ended") {
            setIsPlaying(false);
            if (repeatRef.current === "one") ytRef.current?.seek(0);
            else nextRef.current();
          }
        }}
      />
    </PlayerCtx.Provider>
  );
}
