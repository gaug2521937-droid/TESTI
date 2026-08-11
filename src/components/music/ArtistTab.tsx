"use client";

import { useState, useEffect } from "react";
import type { Track } from "@/components/PlayerContext";

interface ArtistCard {
  id: string;
  name: string;
  picture: string;
  fans: number;
  albums: number;
}

interface AlbumCard {
  id: string;
  title: string;
  artist: string;
  cover: string;
  tracks: number;
  year: string;
}

interface ReleaseCard {
  id: string;
  title: string;
  year: string;
  label: string;
  cover: string;
  format: string;
}

interface VkClip {
  id: string;
  title: string;
  duration: number;
  views: number;
  thumb: string;
  author: string;
  files: { quality: string; url: string; height: number }[];
}

interface Info {
  name: string;
  bio: string | null;
  formed: string | null;
  country: string | null;
  genre: string | null;
  thumb: string | null;
  banner: string | null;
  members: string | null;
}

function fans(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

/**
 * Карточка артиста: профиль, биография, альбомы, издания,
 * похожие исполнители и слушабельные треки.
 */
export function ArtistTab({
  name,
  onArtist,
  renderTracks,
}: {
  name: string;
  onArtist: (n: string) => void;
  renderTracks: (tracks: Track[]) => React.ReactNode;
}) {
  const [artist, setArtist] = useState<ArtistCard | null>(null);
  const [bio, setBio] = useState<Info | null>(null);
  const [albums, setAlbums] = useState<AlbumCard[]>([]);
  const [related, setRelated] = useState<ArtistCard[]>([]);
  const [releases, setReleases] = useState<ReleaseCard[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioOpen, setBioOpen] = useState(false);
  const [clips, setClips] = useState<VkClip[]>([]);
  const [clip, setClip] = useState<VkClip | null>(null);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    setLoading(true);
    setBioOpen(false);

    fetch(`/api/music/artist?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setArtist(d.artist ?? null);
        setBio(d.bio ?? null);
        setAlbums(d.albums ?? []);
        setRelated(d.related ?? []);
        setReleases(d.releases ?? []);
        setTracks(d.tracks ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    // Клипы из VK — отдельным запросом, чтобы не тормозить основную карточку
    fetch(`/api/vk/video?mode=artist&q=${encodeURIComponent(name)}&count=8`)
      .then((r) => r.json())
      .then((d) => alive && setClips(d.videos ?? []))
      .catch(() => {});

    return () => { alive = false; };
  }, [name]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-[190px]" />
        <div className="skeleton h-[130px]" />
        <div className="skeleton h-[240px]" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="gash-card gash-card-static empty-state">
        <div className="icon">🔍</div>
        <p className="title">Исполнитель не найден</p>
        <p className="hint">Попробуйте другое написание имени</p>
      </div>
    );
  }

  const banner = bio?.banner;

  return (
    <div className="space-y-6">
      {/* Шапка артиста */}
      <div className="gash-card gash-card-static overflow-hidden animate-rise">
        <div className="relative">
          {banner && (
            <div className="absolute inset-0">
              <img src={banner} alt="" className="w-full h-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-[#111118]/70 to-transparent" />
            </div>
          )}

          <div className="relative p-6 flex items-end gap-5 flex-wrap">
            {artist.picture || bio?.thumb ? (
              <img
                src={bio?.thumb || artist.picture}
                alt=""
                className="w-[110px] h-[110px] rounded-full object-cover border-2 border-white/15 shadow-2xl flex-shrink-0"
              />
            ) : (
              <div className="w-[110px] h-[110px] rounded-full bg-[#7c5cff]/20 flex items-center justify-center text-4xl flex-shrink-0">
                🎤
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-[26px] md:text-[32px] font-black text-white leading-tight mb-2">
                {artist.name}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {artist.fans > 0 && (
                  <span className="gash-badge gash-badge-info !text-[11px]">👥 {fans(artist.fans)} слушателей</span>
                )}
                {bio?.genre && <span className="gash-badge gash-badge-neutral !text-[11px]">{bio.genre}</span>}
                {bio?.country && <span className="gash-badge gash-badge-neutral !text-[11px]">📍 {bio.country}</span>}
                {bio?.formed && <span className="gash-badge gash-badge-neutral !text-[11px]">с {bio.formed}</span>}
                {artist.albums > 0 && (
                  <span className="gash-badge gash-badge-neutral !text-[11px]">💽 {artist.albums} релизов</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Биография */}
        {bio?.bio && (
          <div className="px-6 pb-6">
            <div className="divider-accent mb-4" />
            <p
              className={`text-[13.5px] text-[#a8a8bd] leading-relaxed ${bioOpen ? "" : "line-clamp-3"}`}
            >
              {bio.bio}
            </p>
            {bio.bio.length > 240 && (
              <button
                onClick={() => setBioOpen((v) => !v)}
                className="text-[12px] font-bold text-[#a68fff] hover:text-white transition-colors mt-2"
              >
                {bioOpen ? "Свернуть" : "Читать полностью"}
              </button>
            )}
            <p className="text-[10.5px] text-[#4a4a5e] mt-3">Справка: TheAudioDB</p>
          </div>
        )}
      </div>

      {/* Треки */}
      {tracks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">🎧 Слушать целиком</p>
            <span className="gash-badge gash-badge-success !text-[9.5px] ml-3">{tracks.length} треков</span>
          </div>
          {renderTracks(tracks)}
        </div>
      )}

      {/* Альбомы */}
      {albums.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">💽 Альбомы</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">Deezer</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {albums.map((a, i) => (
              <div key={a.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="aspect-square rounded-[14px] overflow-hidden mb-2 bg-white/[0.04]">
                  {a.cover ? (
                    <img src={a.cover} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">💽</div>
                  )}
                </div>
                <p className="text-[12px] font-bold text-[#e4e4ee] line-clamp-1">{a.title}</p>
                <p className="text-[10.5px] text-[#5a5a70]">
                  {a.year}{a.tracks > 0 ? ` · ${a.tracks} треков` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Издания Discogs */}
      {releases.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">📀 Физические издания</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">Discogs</span>
          </div>
          <div className="space-y-1.5">
            {releases.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#7c5cff]/35 transition-colors"
              >
                {r.cover ? (
                  <img src={r.cover} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-sm flex-shrink-0">📀</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#e4e4ee] truncate">{r.title}</p>
                  <p className="text-[10.5px] text-[#5a5a70] truncate">
                    {[r.year, r.label, r.format].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Клипы из VK */}
      {clips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">🎬 Клипы и живые выступления</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">VK Video</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {clips.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setClip(c)}
                className="gash-card overflow-hidden text-left group animate-fade-in"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="relative aspect-video bg-black/40">
                  {c.thumb ? (
                    <img src={c.thumb} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🎬</div>
                  )}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="#111"><path d="M7 4.5v15l13-7.5z" /></svg>
                    </span>
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 text-[10px] font-bold text-white tabular-nums">
                    {Math.floor(c.duration / 60)}:{String(c.duration % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] font-bold text-[#e4e4ee] line-clamp-2 leading-snug">{c.title}</p>
                  <p className="text-[10px] text-[#5a5a70] mt-1">👁 {c.views > 1e6 ? (c.views / 1e6).toFixed(1) + "M" : Math.round(c.views / 1e3) + "K"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Просмотр клипа */}
      {clip && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 animate-fade">
          <div className="absolute inset-0 bg-black/88 backdrop-blur-md" onClick={() => setClip(null)} />
          <div className="relative w-full max-w-3xl animate-rise">
            <div className="flex items-start gap-3 mb-3">
              <p className="flex-1 text-[15px] font-extrabold text-white line-clamp-2">{clip.title}</p>
              <button onClick={() => setClip(null)} className="icon-btn !w-10 !h-10 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video src={clip.files[0]?.url} poster={clip.thumb} controls autoPlay
              className="w-full max-h-[54vh] rounded-2xl bg-black border border-white/[0.1]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {clip.files.slice(0, 4).map((f) => (
                <a key={f.quality}
                  href={`/api/video/file?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(`${clip.title.slice(0, 40)}_${f.quality}.mp4`)}`}
                  className="gash-btn-outline justify-center no-underline !py-2.5 !text-[12.5px]">
                  📥 {f.quality}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Похожие */}
      {related.length > 0 && (
        <div>
          <p className="section-title">🎯 Похожие исполнители</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {related.map((a) => (
              <button
                key={a.id}
                onClick={() => onArtist(a.name)}
                className="flex flex-col items-center gap-2 min-w-[88px] group"
              >
                {a.picture ? (
                  <img
                    src={a.picture}
                    alt=""
                    loading="lazy"
                    className="w-[74px] h-[74px] rounded-full object-cover border-2 border-transparent group-hover:border-[#f043a0] transition-all group-hover:scale-105"
                  />
                ) : (
                  <div className="w-[74px] h-[74px] rounded-full bg-[#7c5cff]/20 flex items-center justify-center text-2xl">🎤</div>
                )}
                <span className="text-[11.5px] font-bold text-[#c8c8d8] text-center leading-tight line-clamp-2 group-hover:text-white transition-colors">
                  {a.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
