"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePlayer, type Track } from "@/components/PlayerContext";
import { AddToPlaylist } from "@/components/AddToPlaylist";
import { Visualizer } from "@/components/Visualizer";
import { DiscoverTab } from "@/components/music/DiscoverTab";
import { ArtistTab } from "@/components/music/ArtistTab";
import { OnboardingModal } from "@/components/music/OnboardingModal";

/* Русский рэп — то, что слушает пользователь */
const RAP_RU = [
  "УННВ", "1kla$", "CZAR", "Наганн", "Баста", "Гуф", "Скриптонит",
  "Miyagi", "ЛСП", "Оксимирон", "Macan", "OG Buda", "Три дня дождя",
  "Kizaru", "Big Baby Tape", "Платина", "SODA LUV", "Слава КПСС",
  "Каспийский груз", "Ноганно", "Триагрутрика", "Ассаи", "Смоки Мо",
  "Крип-а-Крип", "Тати", "Рем Дигга", "ATL", "Триада", "Хаски", "Pharaoh",
];

const WORLD = [
  "Eminem", "Drake", "The Weeknd", "Travis Scott", "Kendrick Lamar",
  "50 Cent", "2Pac", "Notorious B.I.G.", "Kanye West", "Post Malone",
];

const GENRES = [
  { label: "🎤 Русский рэп", term: "русский рэп" },
  { label: "🔥 Тренды", term: "" },
  { label: "😈 Phonk", term: "phonk" },
  { label: "🎧 Lo-fi", term: "lofi" },
  { label: "🕺 Электроника", term: "electronic" },
  { label: "🌆 Synthwave", term: "synthwave" },
  { label: "🎸 Рок", term: "rock" },
  { label: "🏠 House", term: "house" },
];

const SRC: Record<string, { label: string; color: string; icon: string }> = {
  ytmusic: { label: "YouTube", color: "#ff4d6d", icon: "▶" },
  audius: { label: "Audius", color: "#34e5a0", icon: "🎧" },
  archive: { label: "Archive", color: "#ffb340", icon: "📼" },
  ccmixter: { label: "ccMixter", color: "#22d3ee", icon: "🎛" },
};

type Tab = "discover" | "search" | "artist" | "mix" | "history";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

interface HistItem {
  id: number;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  artwork: string | null;
  streamUrl: string | null;
  duration: number;
  genre: string | null;
  playedAt: string;
}

export default function MusicPage() {
  const [tab, setTab] = useState<Tab>("discover");
  const [artistName, setArtistName] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const [artistClip, setArtistClip] = useState<null | { title: string; author: string; thumb: string; files: {quality:string;url:string}[] }>(null);
  const [inlineClips, setInlineClips] = useState<Record<string, { thumb: string; files: {quality:string;url:string}[]; title: string; author: string } | null>>({});

  /** Клип артиста ищется в VK один раз на строку */
  const loadClip = async (artist: string, title: string) => {
    const key = `${artist}|${title}`;
    if (inlineClips[key] !== undefined) return;
    try {
      const r = await fetch(`/api/vk/video?mode=video&q=${encodeURIComponent(`${artist} ${title}`)}&count=1`);
      const d = await r.json();
      const v = d.videos?.[0];
      setInlineClips((prev) => ({ ...prev, [key]: v ? { thumb: v.thumb, files: v.files, title: v.title, author: v.author } : null }));
    } catch {
      setInlineClips((prev) => ({ ...prev, [key]: null }));
    }
  };
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heading, setHeading] = useState("Треки в тренде");
  const [source, setSource] = useState<"all" | "youtube" | "clips" | "audius" | "archive" | "underground">("all");
  const [stats, setStats] = useState({ full: 0, preview: 0 });
  const [activeChip, setActiveChip] = useState("");
  const [similar, setSimilar] = useState<{ id: string; name: string; picture: string; fans: number }[]>([]);
  const [similarOf, setSimilarOf] = useState("");
  const [queueToast, setQueueToast] = useState("");
  const [genres, setGenres] = useState<{ key: string; label: string }[]>([]);
  const [activeGenre2, setActiveGenre2] = useState("");

  // Микс и история
  const [mix, setMix] = useState<Track[]>([]);
  const [mixInfo, setMixInfo] = useState<{ personal: boolean; basedOn: { artist: string; plays: number }[] }>({
    personal: false,
    basedOn: [],
  });
  const [mixLoading, setMixLoading] = useState(false);
  const [history, setHistory] = useState<HistItem[]>([]);
  const [taste, setTaste] = useState<{
    topArtists: { artist: string; plays: number }[];
    total: number;
    seconds: number;
    uniqueArtists: number;
  }>({ topArtists: [], total: 0, seconds: 0, uniqueArtists: 0 });

  const { playTrack, current, isPlaying, toggle, setFullscreen, addToQueue } = usePlayer();

  const runSearch = useCallback(async (term: string, label: string, src: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(term)}&source=${src}&limit=40`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка поиска");
        setTracks([]);
        return;
      }
      setTracks(data.tracks || []);
      setStats({ full: data.fullCount || 0, preview: data.previewCount || 0 });
      setHeading(label);
    } catch {
      setError("Не удалось выполнить поиск");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMix = useCallback(async () => {
    setMixLoading(true);
    try {
      const r = await fetch("/api/music/mix");
      const d = await r.json();
      if (r.ok) {
        setMix(d.tracks || []);
        setMixInfo({ personal: d.personal, basedOn: d.basedOn || [] });
      }
    } catch {
      /* тихо */
    } finally {
      setMixLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const [h, t] = await Promise.all([
        fetch("/api/music/history").then((r) => r.json()),
        fetch("/api/music/history?mode=taste").then((r) => r.json()),
      ]);
      setHistory(h.history || []);
      setTaste({
        topArtists: t.topArtists || [],
        total: t.total || 0,
        seconds: t.seconds || 0,
        uniqueArtists: t.uniqueArtists || 0,
      });
    } catch {
      /* тихо */
    }
  }, []);

  useEffect(() => {
    void runSearch("русский рэп", "Русский рэп", "all");
    void loadHistory();
    // Онбординг — только один раз. Помечаем и на сервере, и в браузере,
    // чтобы модалка не всплывала при каждой перезагрузке страницы
    if (localStorage.getItem("gash_onboarded") === "1") return;
    fetch("/api/music/preferences")
      .then((r) => r.json())
      .then((d) => {
        if (d.onboarded) {
          localStorage.setItem("gash_onboarded", "1");
        } else {
          setShowOnboard(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "mix" && mix.length === 0) void loadMix();
    if (tab === "history") void loadHistory();
  }, [tab, mix.length, loadMix, loadHistory]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setActiveChip("");
    setTab("search");
    void runSearch(query.trim(), `Результаты: «${query.trim()}»`, source);
    void loadSimilar(query.trim());
  };

  const loadSimilar = useCallback(async (name: string) => {
    setSimilar([]);
    setSimilarOf("");
    try {
      const r = await fetch(`/api/music/similar?artist=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (r.ok && d.found) {
        setSimilar(d.artists || []);
        setSimilarOf(d.origin?.name || name);
      }
    } catch { /* тихо */ }
  }, []);

  const byGenre = useCallback(async (g: { key: string; label: string }) => {
    setActiveGenre2(g.key);
    setActiveChip("");
    setQuery("");
    setSimilar([]);
    setLoading(true);
    try {
      const r = await fetch(`/api/music/search?genre=${encodeURIComponent(g.key)}&source=audius&limit=40`);
      const d = await r.json();
      if (r.ok) {
        setTracks(d.tracks || []);
        setStats({ full: d.fullCount || 0, preview: 0 });
        setHeading(g.label.replace(/^\S+\s/, ""));
      }
    } catch { /* тихо */ } finally { setLoading(false); }
  }, []);

  /** Открыть карточку артиста */
  const openArtist = useCallback((n: string) => {
    setArtistName(n);
    setTab("artist");
  }, []);

  const chip = (term: string, label: string) => {
    setActiveChip(term || label);
    setQuery("");
    setTab("search");
    void runSearch(term, label, source);
    // Если кликнули по имени артиста — подтягиваем похожих
    if (label.startsWith("Исполнитель:")) void loadSimilar(term);
    else { setSimilar([]); setSimilarOf(""); }
  };

  const histToTrack = (h: HistItem): Track => ({
    id: h.trackId,
    source: (h.source as Track["source"]) || "deezer",
    title: h.title,
    artist: h.artist,
    album: "",
    artwork: h.artwork || "",
    artworkLarge: h.artwork || "",
    streamUrl: h.streamUrl || "",
    duration: h.duration,
    genre: h.genre || "",
    year: "",
    externalUrl: "",
    isFull: h.source === "audius" || h.source === "archive",
  });

  /* ────────── Строка трека ────────── */
  const Row = ({ t, i, list }: { t: Track; i: number; list: Track[] }) => {
    const active = current?.id === t.id;
    return (
      <div
        onClick={() => (active ? toggle() : playTrack(t, list, heading))}
        className={`track-row ${active ? "playing" : ""}`}
      >
        <div className="track-num">
          {active && isPlaying ? (
            <div className="eq"><span /><span /><span /><span /><span /></div>
          ) : (
            <span className="text-[12.5px] text-[#5a5a70] font-bold">{i + 1}</span>
          )}
        </div>

        <div className="relative group flex-shrink-0">
          <img src={t.artwork} alt="" className="track-cover" loading="lazy" />
          <div
            className={`absolute inset-0 rounded-xl bg-black/55 flex items-center justify-center transition-opacity ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {active && isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1.2" />
                <rect x="14" y="4" width="4" height="16" rx="1.2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7 4.5v15l13-7.5z" /></svg>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[14.5px] font-bold truncate ${active ? "text-[#b3a9ff]" : "text-[#e8e8f0]"}`}>
              {t.title}
            </p>
            <span className="gash-badge badge-full !text-[9px] !px-1.5 !py-0 flex-shrink-0" title="Полный трек">FULL</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); openArtist(t.artist); }}
            className="text-[13px] text-[#8a8a99] truncate hover:text-[#a99bff] transition-colors text-left max-w-full"
          >
            {t.artist}
          </button>
        </div>

        <span
          className="hidden lg:inline-flex gash-badge !text-[9.5px] flex-shrink-0"
          style={{
            background: `${SRC[t.source]?.color ?? "#666"}15`,
            color: SRC[t.source]?.color ?? "#888",
            borderColor: `${SRC[t.source]?.color ?? "#666"}30`,
          }}
        >
          {SRC[t.source]?.icon} {SRC[t.source]?.label}
        </span>

        <span className="track-time text-[12.5px] text-[#6a6a80]">{fmt(t.duration)}</span>

        <div onClick={(e) => e.stopPropagation()} className="track-actions">
          <button
            onClick={() => { addToQueue(t); setQueueToast(t.title); setTimeout(() => setQueueToast(""), 1600); }}
            className="icon-btn hidden sm:flex hover:!text-[#00e0a4]"
            title="Добавить в текущую очередь"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
              <path d="M3 6h13M3 12h9M3 18h9M17 12v8M21 16h-8" />
            </svg>
          </button>
          <AddToPlaylist track={t} variant="icon" />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      {artistClip && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 animate-fade">
          <div className="absolute inset-0 bg-black/88 backdrop-blur-md" onClick={() => setArtistClip(null)} />
          <div className="relative w-full max-w-3xl animate-rise">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-extrabold text-white line-clamp-2">{artistClip.title}</p>
                <p className="text-[12.5px] text-[#8a8a9e] mt-0.5">{artistClip.author}</p>
              </div>
              <button onClick={() => setArtistClip(null)} className="icon-btn !w-10 !h-10 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video src={artistClip.files[0]?.url} poster={artistClip.thumb} controls autoPlay
              className="w-full max-h-[54vh] rounded-2xl bg-black border border-white/[0.1]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {artistClip.files.slice(0, 4).map((f) => (
                <a key={f.quality}
                  href={`/api/video/file?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(`${artistClip.title.slice(0, 40)}_${f.quality}.mp4`)}`}
                  className="gash-btn-outline justify-center no-underline !py-2.5 !text-[12.5px]">
                  📥 {f.quality}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      {showOnboard && <OnboardingModal onDone={() => { setShowOnboard(false); localStorage.setItem("gash_onboarded", "1"); if (tab === "mix") void loadMix(); }} />}
      {/* Мини-панель играющего трека: висит поверх, макет не двигает */}
      {current && (
        <button
          onClick={() => setFullscreen(true)}
          className="mini-now fixed right-5 bottom-[104px] z-[70] hidden lg:flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-2xl"
          style={{
            background: "rgba(17,17,24,0.95)",
            border: "1px solid rgba(124,92,255,0.35)",
            boxShadow: "0 20px 44px -20px rgba(0,0,0,1)",
            backdropFilter: "blur(20px)",
            maxWidth: 320,
          }}
        >
          <img src={current.artworkLarge} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          <div className="min-w-0 text-left">
            <p className="text-[12.5px] font-bold text-white truncate">{current.title}</p>
            <p className="text-[11px] text-[#8a8a9e] truncate">{current.artist}</p>
          </div>
          <div className="flex-shrink-0 w-[52px]">
            <Visualizer bars={12} height={22} variant="mirror" />
          </div>
        </button>
      )}

      {queueToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[150] px-5 py-3 rounded-2xl"
          style={{ background: "rgba(0,224,164,0.16)", border: "1px solid rgba(0,224,164,0.4)", backdropFilter: "blur(16px)" }}>
          <span className="text-[13px] font-bold text-[#4ff0c8]">✓ «{queueToast}» в очереди</span>
        </div>
      )}

      {/* ═══ HERO музыки ═══ */}
      <div className="music-hero animate-fade-in">
        <div className="music-hero-glow" />
        <div className="music-hero-content">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="status-pill ok !mb-3">
                <span className="live-dot" />
                Живая лента
              </div>
              <h1 className="music-hero-title">
                <span className="gradient-text">Твоя</span> музыка
              </h1>
              <p className="music-hero-sub">
                Любой исполнитель, песня целиком, точное караоке и клипы
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["Баста", "Miyagi", "УННВ", "1kla$", "Скриптонит", "Eminem"].map((n) => (
                  <button key={n} onClick={() => openArtist(n)} className="music-quick-chip">
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="music-hero-stats">
              {[
                { v: "∞", l: "треков", c: "#22d3ee" },
                { v: "🎯", l: "точное караоке", c: "#f043a0" },
                { v: "🎬", l: "с клипами", c: "#ffb340" },
              ].map((x) => (
                <div key={x.l} className="music-hero-stat">
                  <div className="music-hero-stat-v" style={{ color: x.c }}>{x.v}</div>
                  <div className="music-hero-stat-l">{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="music-tabs grid-cols-5 mb-5">
        {([
          { k: "discover", l: "Обзор", i: "🧭" },
          { k: "search", l: "Поиск", i: "🔍" },
          { k: "artist", l: "Артист", i: "🎤" },
          { k: "mix", l: "Микс", i: "✨" },
          { k: "history", l: "История", i: "🕐" },
        ] as const).map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            className={`music-tab ${tab === x.k ? "on" : ""}`}
          >
            <span className="music-tab-icon">{x.i}</span>
            <span className="music-tab-label">{x.l}</span>
          </button>
        ))}
      </div>

      {/* ══════ ОБЗОР ══════ */}
      {tab === "discover" && <DiscoverTab onArtist={openArtist} />}

      {/* ══════ АРТИСТ ══════ */}
      {tab === "artist" && (
        artistName ? (
          <ArtistTab
            name={artistName}
            onArtist={openArtist}
            renderTracks={(list) => (
              <div className="space-y-2">
                {list.map((t, i) => <Row key={`${t.id}-${i}`} t={t} i={i} list={list} />)}
              </div>
            )}
          />
        ) : (
          <div className="gash-card gash-card-static empty-state">
            <div className="icon">🎤</div>
            <p className="title">Исполнитель не выбран</p>
            <p className="hint">Нажмите на имя артиста в любом списке или найдите через поиск</p>
          </div>
        )
      )}

      {/* ══════ ПОИСК ══════ */}
      {tab === "search" && (
        <>
          <form onSubmit={search} className="mb-4">
            <div className="gash-card gash-card-static gash-card-glow p-2.5 flex gap-2.5">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6a6a7a] pointer-events-none">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Исполнитель, трек, жанр…"
                  className="gash-input !pl-11 !border-transparent !bg-transparent focus:!bg-white/[0.03]"
                />
              </div>
              <button type="submit" disabled={loading || !query.trim()} className="gash-btn">
                {loading ? <span className="gash-loader !w-4 !h-4 !border-2" /> : "Найти"}
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="seg-group">
              {[
                { k: "all", l: "Все" },
                { k: "youtube", l: "▶ YouTube" },
                { k: "clips", l: "🎬 Клипы" },
                { k: "audius", l: "🎧 Audius" },
                { k: "underground", l: "🌑 Андеграунд" },
              ].map((s) => (
                <button key={s.k} onClick={() => setSource(s.k as typeof source)} className={`seg-btn ${source === s.k ? "active" : ""}`}>
                  {s.l}
                </button>
              ))}
            </div>
            <Link href="/playlists" className="gash-btn-ghost no-underline">💿 Плейлисты →</Link>
          </div>

          {/* Русский рэп */}
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-[#5a5a6a] mb-2">🎤 Русский рэп</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {RAP_RU.map((a) => (
                <button
                  key={a}
                  onClick={() => chip(a, `Исполнитель: ${a}`)}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold whitespace-nowrap border transition-all ${
                    activeChip === a
                      ? "bg-[#e84393] text-white border-transparent shadow-[0_6px_18px_-8px_rgba(232,67,147,1)]"
                      : "bg-white/[0.03] text-[#a0a0b0] border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Мировые */}
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-[#5a5a6a] mb-2">🌍 Зарубежные</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {WORLD.map((a) => (
                <button
                  key={a}
                  onClick={() => chip(a, `Исполнитель: ${a}`)}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap border transition-all ${
                    activeChip === a
                      ? "bg-[#6c5ce7] text-white border-transparent"
                      : "bg-white/[0.03] text-[#8a8a99] border-white/[0.06] hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Жанры Audius */}
          {genres.length > 0 && (
            <div className="mb-6">
              <p className="section-title">Жанры</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {genres.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => void byGenre(g)}
                    className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-all ${
                      activeGenre2 === g.key && !activeChip
                        ? "bg-gradient-to-r from-[#7c5cff] to-[#5c3ce0] text-white border-transparent"
                        : "bg-white/[0.04] text-[#a8a8bd] border-white/[0.07] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="gash-alert gash-alert-danger mb-6">⚠️ {error}</div>}

          {/* Похожие исполнители */}
          {similar.length > 0 && !loading && (
            <div className="gash-card gash-card-static p-5 mb-5 animate-rise">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-[14px] font-extrabold text-[#e8e8f0]">
                  🎯 Похожи на <span className="text-[#e84393]">{similarOf}</span>
                </h3>
                <button onClick={() => { setSimilar([]); setSimilarOf(""); }} className="icon-btn">✕</button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {similar.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => chip(a.name, `Исполнитель: ${a.name}`)}
                    className="flex flex-col items-center gap-2 min-w-[86px] group"
                  >
                    {a.picture ? (
                      <img
                        src={a.picture}
                        alt=""
                        className="w-[74px] h-[74px] rounded-full object-cover border-2 border-transparent group-hover:border-[#e84393] transition-all group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-[74px] h-[74px] rounded-full bg-[#6c5ce7]/20 flex items-center justify-center text-2xl">
                        🎤
                      </div>
                    )}
                    <span className="text-[12px] font-bold text-[#c8c8d8] text-center leading-tight line-clamp-2 group-hover:text-white transition-colors">
                      {a.name}
                    </span>
                    {a.fans > 0 && (
                      <span className="text-[10px] text-[#6a6a7a]">
                        {a.fans > 1e6 ? (a.fans / 1e6).toFixed(1) + "M" : Math.round(a.fans / 1000) + "K"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton track-skeleton" />
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="gash-card gash-card-static empty-state">
              <div className="text-6xl mb-4 opacity-60">🔇</div>
              <p className="text-lg font-bold text-[#e0e0e0]">Ничего не найдено</p>
            </div>
          ) : (
            <>
              <div className="results-head flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-[#e8e8f0]">{heading}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="gash-badge gash-badge-success !text-[10px]">
                      ✓ все {tracks.length} играют целиком
                    </span>
                    <span className="gash-badge gash-badge-neutral !text-[10px]">
                      YouTube · Audius · Archive
                    </span>

                  </div>
                </div>
                <button onClick={() => playTrack(tracks[0], tracks, heading)} className="gash-btn !py-2.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                  Слушать всё
                </button>
              </div>
              <div className="track-list space-y-2">
                {tracks.map((t, i) => <Row key={`${t.id}-${i}`} t={t} i={i} list={tracks} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ══════ МИКС ══════ */}
      {tab === "mix" && (
        <div>
          <div className="gash-card gash-card-static p-6 mb-5 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{ background: "radial-gradient(500px 180px at 20% 0%, rgba(232,67,147,0.22), transparent 65%)" }}
            />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-extrabold text-white mb-1.5 flex items-center gap-2">
                  ✨ Мой микс
                  {mixInfo.personal && <span className="gash-badge gash-badge-success !text-[10px]">персональный</span>}
                </h2>
                {mixInfo.personal ? (
                  <>
                    <p className="text-[13px] text-[#8a8a99] mb-2">Подобрано по тому, что вы слушали:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mixInfo.basedOn.slice(0, 5).map((b) => (
                        <span key={b.artist} className="gash-badge gash-badge-info !text-[10.5px]">
                          {b.artist} · {b.plays}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[#8a8a99] max-w-md">
                    Послушайте несколько треков — и микс подстроится под ваш вкус.
                    Пока показываем подборку русского рэпа.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => void loadMix()} disabled={mixLoading} className="gash-btn-ghost">
                  🔄 Обновить
                </button>
                {mix.length > 0 && (
                  <button onClick={() => playTrack(mix[0], mix, "Мой микс")} className="gash-btn !py-2.5">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                    Слушать микс
                  </button>
                )}
              </div>
            </div>
          </div>

          {mixLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-[76px]" />)}
            </div>
          ) : (
            <div className="track-list space-y-2">
              {mix.map((t, i) => <Row key={`${t.id}-${i}`} t={t} i={i} list={mix} />)}
            </div>
          )}
        </div>
      )}

      {/* ══════ ИСТОРИЯ ══════ */}
      {tab === "history" && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { l: "Прослушано", v: taste.total, c: "#6c5ce7" },
              { l: "Артистов", v: taste.uniqueArtists, c: "#00e0a4" },
              { l: "Минут", v: Math.round(taste.seconds / 60), c: "#e84393" },
            ].map((s) => (
              <div key={s.l} className="stat-tile">
                <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] mt-1">{s.l}</div>
              </div>
            ))}
          </div>

          {taste.topArtists.length > 0 && (
            <div className="gash-card gash-card-static p-5 mb-5">
              <h3 className="text-[15px] font-extrabold text-[#e8e8f0] mb-4">🏆 Ваши любимые артисты</h3>
              <div className="space-y-2">
                {taste.topArtists.slice(0, 8).map((a, i) => {
                  const max = taste.topArtists[0]?.plays || 1;
                  return (
                    <button
                      key={a.artist}
                      onClick={() => chip(a.artist, `Исполнитель: ${a.artist}`)}
                      className="w-full flex items-center gap-3 group"
                    >
                      <span className="text-[11px] font-extrabold text-[#6a6a7a] w-5">{i + 1}</span>
                      <span className="text-[13px] font-bold text-[#dcdce6] w-32 sm:w-44 truncate text-left group-hover:text-[#a99bff] transition-colors">
                        {a.artist}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(a.plays / max) * 100}%`,
                            background: "linear-gradient(90deg,#6c5ce7,#e84393)",
                          }}
                        />
                      </div>
                      <span className="text-[11.5px] text-[#7a7a8a] tabular-nums w-8 text-right">{a.plays}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-extrabold text-[#e8e8f0]">🕐 Недавно слушали</h3>
            {history.length > 0 && (
              <button
                onClick={async () => {
                  await fetch("/api/music/history", { method: "DELETE" });
                  void loadHistory();
                  setMix([]);
                }}
                className="gash-btn-ghost !text-[#ff8098]"
              >
                Очистить
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="gash-card gash-card-static empty-state">
              <div className="text-5xl mb-4 opacity-55">🎧</div>
              <p className="text-[15px] font-bold text-[#c8c8d8] mb-1">История пуста</p>
              <p className="text-[13px] text-[#6a6a7a]">Включите любой трек — он появится здесь</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => {
                const t = histToTrack(h);
                return <Row key={h.id} t={t} i={i} list={history.map(histToTrack)} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
