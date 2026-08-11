"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePlayer, type Track } from "@/components/PlayerContext";

interface Playlist {
  id: number;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  trackCount: number;
  totalDuration: number;
  cover: string | null;
  createdAt: string;
}

interface PTrack {
  id: number;
  trackId: string;
  source: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  streamUrl: string;
  duration: number;
  genre: string | null;
  isFull: boolean;
}

const EMOJIS = ["🎵", "🔥", "💜", "🌙", "☀️", "🏋️", "🚗", "🎮", "😴", "💃", "🧠", "🌊"];
const COLORS = ["#6c5ce7", "#00e0a4", "#ff5470", "#00d2ff", "#ffc542", "#e84393"];

function dur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

// Преобразуем запись из БД в трек плеера
function toTrack(t: PTrack): Track {
  return {
    id: t.trackId,
    source: t.source === "audius" ? "audius" : "itunes",
    title: t.title,
    artist: t.artist,
    album: t.album || "",
    artwork: t.artwork || "",
    artworkLarge: t.artwork || "",
    streamUrl: t.streamUrl,
    duration: t.duration,
    genre: t.genre || "",
    year: "",
    externalUrl: "",
    isFull: Boolean(t.isFull),
  };
}

export default function PlaylistsPage() {
  const [lists, setLists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<PTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🎵");
  const [color, setColor] = useState("#6c5ce7");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [isAuth, setIsAuth] = useState(false);

  const { playTrack, current, isPlaying, toggle } = usePlayer();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists", { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setLists(data.playlists || []);
        setIsAuth(data.isAuthenticated);
      }
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openPlaylist = async (p: Playlist) => {
    setSelected(p);
    setTracksLoading(true);
    try {
      const res = await fetch(`/api/playlists/${p.id}/tracks`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setTracks(data.tracks || []);
    } catch {
      /* тихо */
    } finally {
      setTracksLoading(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Введите название");
      return;
    }
    setSaving(true);
    setError("");
    setOk("");
    try {
      // credentials: 'same-origin' по умолчанию у fetch, но некоторые прокси режут cookie —
      // явно указываем 'include', чтобы гостевой ключ точно долетел
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          emoji,
          color,
        }),
      });

      // Читаем как текст, чтобы поймать не-JSON ответы (например, 500 HTML)
      const raw = await res.text();
      let data: { success?: boolean; error?: string; playlist?: Playlist } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(`Сервер вернул неожиданный ответ (${res.status})`);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || `Ошибка ${res.status}. Обновите страницу и попробуйте снова.`);
        return;
      }

      // Успех: показываем уведомление и обновляем список
      setOk(`Плейлист «${name.trim()}» создан`);
      setName("");
      setDesc("");
      setShowCreate(false);
      await load();
      setTimeout(() => setOk(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось связаться с сервером");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await fetch(`/api/playlists?id=${id}`, { method: "DELETE", credentials: "include" });
      if (selected?.id === id) setSelected(null);
      await load();
    } catch {
      /* тихо */
    }
  };

  const removeTrack = async (rowId: number) => {
    if (!selected) return;
    try {
      await fetch(`/api/playlists/${selected.id}/tracks?trackRowId=${rowId}`, { method: "DELETE", credentials: "include" });
      setTracks((t) => t.filter((x) => x.id !== rowId));
      await load();
    } catch {
      /* тихо */
    }
  };

  const playAll = () => {
    if (tracks.length === 0 || !selected) return;
    const list = tracks.map(toTrack);
    playTrack(list[0], list, selected.name);
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      {/* Заголовок */}
      <div className="page-head animate-fade-in">
        <div className="status-pill">
          💿 Собственные подборки
        </div>
        <h1>
          <span className="gradient-text">Плейлисты</span>
        </h1>
        <p className="text-[#9a9aa8] max-w-lg mx-auto">
          Сохраняйте любимые треки в тематические подборки и слушайте их одним нажатием.
        </p>
        {!isAuth && (
          <p className="text-[12px] text-[#6a6a7a] mt-3">
            💡 Плейлисты гостя привязаны к браузеру.{" "}
            <Link href="/login" className="text-[#a99bff] no-underline font-semibold">
              Войдите
            </Link>
            , чтобы они сохранились навсегда.
          </p>
        )}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-5">⚠️ {error}</div>}
      {ok && <div className="gash-alert gash-alert-success mb-5">✅ {ok}</div>}

      {/* Кнопка создания */}
      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <h2 className="text-lg font-extrabold text-[#e8e8f0]">
          Мои подборки <span className="text-[#6a6a7a]">({lists.length})</span>
        </h2>
        <div className="flex gap-2.5">
          <Link href="/music" className="gash-btn-ghost no-underline">
            🎵 К музыке
          </Link>
          <button onClick={() => setShowCreate((s) => !s)} className="gash-btn">
            {showCreate ? "Отмена" : "＋ Создать"}
          </button>
        </div>
      </div>

      {/* Форма создания */}
      {showCreate && (
        <form onSubmit={create} className="gash-card gash-card-static gash-card-glow p-6 mb-6 animate-bounce-in">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                Название
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Для тренировки"
                maxLength={120}
                className="gash-input"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                Описание
              </label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Необязательно"
                maxLength={400}
                className="gash-input"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 mb-5">
            <div>
              <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                Иконка
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-9 h-9 rounded-xl text-base transition-all ${
                      emoji === e
                        ? "bg-[#6c5ce7]/28 ring-2 ring-[#6c5ce7] scale-110"
                        : "bg-white/[0.05] hover:bg-white/[0.1]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                Цвет
              </label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-9 h-9 rounded-xl transition-all ${
                      color === c ? "ring-2 ring-white scale-110" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving || !name.trim()} className="gash-btn">
            {saving ? "Создаём…" : "💾 Создать плейлист"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[330px,1fr] gap-5 items-start">
        {/* Сетка плейлистов */}
        <div className="space-y-2.5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[76px]" />)
          ) : lists.length === 0 ? (
            <div className="gash-card gash-card-static p-10 text-center">
              <div className="text-5xl mb-3 opacity-55">💿</div>
              <p className="text-[14px] font-bold text-[#c8c8d8] mb-1">Плейлистов пока нет</p>
              <p className="text-[12.5px] text-[#6a6a7a]">Создайте первый по кнопке выше</p>
            </div>
          ) : (
            lists.map((p, i) => (
              <button
                key={p.id}
                onClick={() => void openPlaylist(p)}
                style={{ animationDelay: `${i * 0.04}s` }}
                className={`gash-card w-full p-3.5 flex items-center gap-3 text-left animate-fade-in ${
                  selected?.id === p.id ? "!border-[#6c5ce7] !shadow-[0_0_30px_-12px_rgba(108,92,231,0.9)]" : ""
                }`}
              >
                {p.cover ? (
                  <img src={p.cover} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${p.color}22` }}
                  >
                    {p.emoji}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold text-[#e8e8f0] truncate">{p.name}</p>
                  <p className="text-[11.5px] text-[#6a6a7a]">
                    {p.trackCount} трек. · {dur(p.totalDuration)}
                  </p>
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(p.id);
                  }}
                  className="icon-btn hover:!text-[#ff5470] flex-shrink-0"
                >
                  🗑
                </span>
              </button>
            ))
          )}
        </div>

        {/* Треки выбранного плейлиста */}
        <div>
          {!selected ? (
            <div className="gash-card gash-card-static p-16 text-center">
              <div className="text-5xl mb-4 opacity-50">👈</div>
              <p className="text-[15px] font-bold text-[#c8c8d8] mb-1">Выберите плейлист</p>
              <p className="text-[13px] text-[#6a6a7a]">Треки появятся здесь</p>
            </div>
          ) : (
            <div className="gash-card gash-card-static overflow-hidden animate-rise">
              {/* Шапка плейлиста */}
              <div
                className="p-6 relative"
                style={{
                  background: `linear-gradient(135deg, ${selected.color}28, transparent 70%)`,
                }}
              >
                <div className="flex items-start gap-4">
                  {selected.cover ? (
                    <img
                      src={selected.cover}
                      alt=""
                      className="w-20 h-20 rounded-2xl object-cover shadow-xl flex-shrink-0"
                    />
                  ) : (
                    <span
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ background: `${selected.color}30` }}
                    >
                      {selected.emoji}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-extrabold text-white truncate">{selected.name}</h2>
                    {selected.description && (
                      <p className="text-[13px] text-[#a8a8b8] mt-1">{selected.description}</p>
                    )}
                    <p className="text-[12px] text-[#7a7a8a] mt-1.5">
                      {tracks.length} треков · {dur(selected.totalDuration)}
                    </p>
                    {tracks.length > 0 && (
                      <button onClick={playAll} className="gash-btn !py-2.5 mt-3.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7 4.5v15l13-7.5z" />
                        </svg>
                        Слушать плейлист
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Треки */}
              <div className="p-4">
                {tracksLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton h-14" />
                    ))}
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-3 opacity-50">🎵</div>
                    <p className="text-[13.5px] text-[#8a8a99] mb-3">Плейлист пуст</p>
                    <Link href="/music" className="gash-btn-outline no-underline !text-[13px]">
                      Найти треки →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {tracks.map((t, i) => {
                      const track = toTrack(t);
                      const active = current?.id === track.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() =>
                            active ? toggle() : playTrack(track, tracks.map(toTrack), selected.name)
                          }
                          className={`track-row !py-2.5 ${active ? "playing" : ""}`}
                        >
                          <span className="w-5 text-center text-[12px] text-[#6a6a7a] font-semibold flex-shrink-0">
                            {active && isPlaying ? (
                              <span className="eq justify-center !h-3">
                                <span /><span /><span />
                              </span>
                            ) : (
                              i + 1
                            )}
                          </span>
                          {t.artwork && (
                            <img
                              src={t.artwork}
                              alt=""
                              className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13.5px] font-bold truncate ${
                                active ? "text-[#b3a9ff]" : "text-[#e0e0e0]"
                              }`}
                            >
                              {t.title}
                            </p>
                            <p className="text-[12px] text-[#8a8a99] truncate">{t.artist}</p>
                          </div>

                          <span className="text-[12px] text-[#7a7a8a] tabular-nums flex-shrink-0 w-9 text-right">
                            {fmt(t.duration)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeTrack(t.id);
                            }}
                            className="icon-btn hover:!text-[#ff5470] flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
