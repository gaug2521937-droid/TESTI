"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Station {
  id: string;
  name: string;
  url: string;
  directUrl: string;
  favicon: string;
  country: string;
  countryCode: string;
  tags: string[];
  codec: string;
  bitrate: number;
  votes: number;
  language: string;
  homepage: string;
}

const COUNTRIES = [
  { code: "RU", label: "🇷🇺 Россия" },
  { code: "ALL", label: "🌍 Весь мир" },
  { code: "BY", label: "🇧🇾 Беларусь" },
  { code: "KZ", label: "🇰🇿 Казахстан" },
  { code: "UA", label: "🇺🇦 Украина" },
  { code: "US", label: "🇺🇸 США" },
  { code: "DE", label: "🇩🇪 Германия" },
  { code: "GB", label: "🇬🇧 Британия" },
];

const TAGS = [
  { t: "", l: "🔥 Популярное" },
  { t: "pop", l: "🎤 Поп" },
  { t: "rock", l: "🎸 Рок" },
  { t: "rap", l: "🎧 Рэп" },
  { t: "dance", l: "🕺 Танцы" },
  { t: "electronic", l: "🎛 Электроника" },
  { t: "jazz", l: "🎷 Джаз" },
  { t: "chillout", l: "🧘 Chillout" },
  { t: "news", l: "📰 Новости" },
  { t: "classical", l: "🎻 Классика" },
];

function color(n: string) {
  const c = ["#6c5ce7", "#00e0a4", "#ff7043", "#00d2ff", "#ffc542", "#e84393"];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

export default function RadioPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [country, setCountry] = useState("RU");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");

  const [current, setCurrent] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavs, setShowFavs] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const failedRef = useRef(0);
  const listRef = useRef<Station[]>([]);
  const currentRef = useRef<Station | null>(null);

  /** Автопереход к следующей станции, если текущая молчит */
  const skipNext = () => {
    const list = listRef.current;
    const cur = currentRef.current;
    if (list.length === 0) return;
    const idx = cur ? list.findIndex((x) => x.id === cur.id) : -1;
    const next = list[(idx + 1) % list.length];
    if (next && next.id !== cur?.id) playRef.current(next);
  };
  const playRef = useRef<(s: Station) => void>(() => {});

  // Избранное в localStorage
  useEffect(() => {
    const s = localStorage.getItem("gash_radio_favs");
    if (s) setFavs(JSON.parse(s));
  }, []);
  useEffect(() => {
    localStorage.setItem("gash_radio_favs", JSON.stringify(favs));
  }, [favs]);

  // Аудио
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.volume = 0.8;
    audioRef.current = a;

    const onPlay = () => { setPlaying(true); setBuffering(false); setError(""); };
    const onPause = () => setPlaying(false);
    const onWait = () => setBuffering(true);
    const onErr = () => {
      setBuffering(false);
      setPlaying(false);
      // Не ругаемся, а сразу пробуем следующую живую станцию
      // Раньше сайт сам перескакивал по 4 станциям подряд — это сбивало.
      // Теперь просто честно сообщаем и ждём решения пользователя.
      setError("Станция не отвечает. Нажмите «Следующая» или выберите другую.");
    };

    a.addEventListener("playing", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWait);
    a.addEventListener("error", onErr);

    return () => {
      a.pause();
      a.removeEventListener("playing", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWait);
      a.removeEventListener("error", onErr);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ country, limit: "48" });
      if (search.trim()) params.set("q", search.trim());
      else if (tag) params.set("tag", tag);

      const r = await fetch(`/api/radio?${params}`);
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Ошибка загрузки");
        setStations([]);
        return;
      }
      setStations(d.stations || []);
    } catch {
      setError("Не удалось загрузить станции");
    } finally {
      setLoading(false);
    }
  }, [country, tag, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => { listRef.current = stations; }, [stations]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { playRef.current = play; });

  const play = (s: Station) => {
    const a = audioRef.current;
    if (!a) return;
    failedRef.current = 0;

    if (current?.id === s.id) {
      if (a.paused) void a.play().catch(() => setError("Не удалось запустить"));
      else a.pause();
      return;
    }

    setError("");
    setBuffering(true);
    setCurrent(s);
    a.src = s.url;
    a.volume = volume;
    a.load();
    void a.play().catch(() => {
      setBuffering(false);
      setError("Не удалось запустить поток. Попробуйте другую станцию.");
    });
  };

  const stop = () => {
    audioRef.current?.pause();
    setCurrent(null);
    setPlaying(false);
  };

  const toggleFav = (id: string) =>
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const shown = showFavs ? stations.filter((s) => favs.includes(s.id)) : stations;

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="page-head animate-fade-in">
        <div className="status-pill ok">
          <span className="live-dot" />
          Более 50 000 станций · прямой эфир
        </div>
        <h1><span className="gradient-text">Радио</span></h1>
        <p>Живые радиостанции со всего мира — включайте и слушайте прямо сейчас</p>
      </div>

      {/* Сейчас играет */}
      {current && (
        <div
          className="gash-card gash-card-static p-4 mb-5 animate-rise"
          style={{ borderColor: "rgba(108,92,231,0.4)" }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-shrink-0">
              {current.favicon ? (
                <img src={current.favicon} alt="" className="w-14 h-14 rounded-xl object-cover bg-white/5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${color(current.name)}25` }}>📻</div>
              )}
              {playing && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#00e0a4] border-2 border-[#15151c] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-0.5">
                {buffering ? "Подключение…" : playing ? "В эфире" : "Пауза"}
              </p>
              <p className="text-[15px] font-extrabold text-white truncate">{current.name}</p>
              <p className="text-[12px] text-[#8a8a99] truncate">
                {current.country} · {current.codec} {current.bitrate > 0 && `${current.bitrate} кбит/с`}
              </p>
            </div>

            {/* Эквалайзер */}
            {playing && (
              <div className="eq !h-6 hidden sm:flex">
                <span /><span /><span /><span /><span />
              </div>
            )}

            <button onClick={() => play(current)} className="play-fab">
              {buffering ? (
                <span className="gash-loader !w-5 !h-5 !border-2 !border-white/25 !border-t-white" />
              ) : playing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
              )}
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm">🔊</span>
              <input type="range" min={0} max={1} step={0.01} value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="range-slider !w-24"
                style={{ background: `linear-gradient(90deg,#6c5ce7 ${volume * 100}%, rgba(255,255,255,0.12) ${volume * 100}%)` }} />
              <button onClick={stop} className="icon-btn hover:!text-[#ff5470]">✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div className="gash-card gash-card-static gash-card-glow p-2.5 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Найти станцию по названию…"
          className="gash-input !border-transparent !bg-transparent focus:!bg-white/[0.03]" />
      </div>

      {/* Страны */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
        {COUNTRIES.map((c) => (
          <button key={c.code} onClick={() => { setCountry(c.code); setSearch(""); }}
            className={`artist-chip ${country === c.code ? "on" : ""}`}>{c.label}</button>
        ))}
      </div>

      {/* Жанры */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {TAGS.map((t) => (
          <button key={t.l} onClick={() => { setTag(t.t); setSearch(""); }}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-all ${
              tag === t.t && !search
                ? "bg-gradient-to-r from-[#6c5ce7] to-[#5340c9] text-white border-transparent"
                : "bg-white/[0.04] text-[#a0a0b0] border-white/[0.07] hover:bg-white/[0.08] hover:text-white"
            }`}>{t.l}</button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-[13px] text-[#8a8a99]">
          Найдено станций: <b className="text-[#c8c8d8]">{shown.length}</b>
        </p>
        {favs.length > 0 && (
          <button onClick={() => setShowFavs((v) => !v)}
            className={`gash-btn-ghost ${showFavs ? "!text-[#ffc542]" : ""}`}>
            ⭐ Избранное ({favs.length})
          </button>
        )}
      </div>

      {error && (
        <div className="gash-alert gash-alert-danger mb-4 justify-between">
          <span>⚠️ {error}</span>
          <button onClick={skipNext} className="gash-btn-ghost !py-1.5 !px-3 flex-shrink-0">
            ⏭ Следующая
          </button>
        </div>
      )}

      {/* Сетка станций */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton h-[92px]" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="gash-card gash-card-static empty-state">
          <div className="icon">📻</div>
          <p className="title">Станций не найдено</p>
          <p className="hint">Попробуйте другую страну или жанр</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((s, i) => {
            const active = current?.id === s.id;
            return (
              <div key={s.id} onClick={() => play(s)}
                style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
                className={`gash-card p-4 cursor-pointer animate-fade-in ${
                  active ? "!border-[#6c5ce7] !shadow-[0_0_30px_-12px_rgba(108,92,231,0.9)]" : ""
                }`}>
                <div className="flex items-start gap-3">
                  {s.favicon ? (
                    <img src={s.favicon} alt="" className="w-11 h-11 rounded-xl object-cover bg-white/5 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.background = color(s.name) + "25"; }} />
                  ) : (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${color(s.name)}25` }}>📻</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13.5px] font-bold truncate ${active ? "text-[#b3a9ff]" : "text-[#e8e8f0]"}`}>
                        {s.name}
                      </p>
                      <button onClick={(e) => { e.stopPropagation(); toggleFav(s.id); }}
                        className="text-[13px] flex-shrink-0 transition-transform hover:scale-125">
                        {favs.includes(s.id) ? "⭐" : "☆"}
                      </button>
                    </div>
                    <p className="text-[11.5px] text-[#7a7a8a] truncate mt-0.5">
                      {s.country || "—"} {s.bitrate > 0 && `· ${s.bitrate}k`}
                    </p>
                    {s.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {s.tags.slice(0, 2).map((t) => (
                          <span key={t} className="gash-badge gash-badge-neutral !text-[9.5px] !px-1.5 !py-0">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {active && playing && (
                    <div className="eq !h-4 flex-shrink-0"><span /><span /><span /></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
