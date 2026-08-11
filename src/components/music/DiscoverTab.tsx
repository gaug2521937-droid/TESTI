"use client";

import { useState, useEffect, useCallback } from "react";

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

interface GenreCard {
  id: string;
  name: string;
  picture: string;
}

function fans(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

/** Витрина каталога: чарты артистов, альбомы, жанры и подборки */
export function DiscoverTab({ onArtist }: { onArtist: (name: string) => void }) {
  const [artists, setArtists] = useState<ArtistCard[]>([]);
  const [albums, setAlbums] = useState<AlbumCard[]>([]);
  const [genres, setGenres] = useState<GenreCard[]>([]);
  const [editorial, setEditorial] = useState<GenreCard[]>([]);
  const [apiCount, setApiCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/music/discover");
      const d = await r.json();
      setArtists(d.chartArtists || []);
      setAlbums(d.albums || []);
      setGenres(d.genres || []);
      setEditorial(d.editorial || []);
      setApiCount(d.apiCount || 0);
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-[150px]" />
        <div className="skeleton h-[210px]" />
        <div className="skeleton h-[120px]" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Чарт артистов */}
      {artists.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">🏆 Топ исполнителей мира</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">Deezer чарт</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {artists.map((a, i) => (
              <button
                key={a.id}
                onClick={() => onArtist(a.name)}
                className="flex flex-col items-center gap-2 min-w-[92px] group animate-fade-in"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="relative">
                  {a.picture ? (
                    <img
                      src={a.picture}
                      alt=""
                      loading="lazy"
                      className="w-[80px] h-[80px] rounded-full object-cover border-2 border-transparent group-hover:border-[#f043a0] transition-all group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] rounded-full bg-[#7c5cff]/20 flex items-center justify-center text-2xl">
                      🎤
                    </div>
                  )}
                  <span className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-[#f043a0] text-white text-[11px] font-black flex items-center justify-center border-2 border-[#07070b]">
                    {i + 1}
                  </span>
                </div>
                <span className="text-[12px] font-bold text-[#c8c8d8] text-center leading-tight line-clamp-2 group-hover:text-white transition-colors">
                  {a.name}
                </span>
                {a.fans > 0 && <span className="text-[10px] text-[#5a5a70]">{fans(a.fans)} фанатов</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Альбомы */}
      {albums.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">💽 Свежие альбомы</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">Deezer каталог</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {albums.slice(0, 14).map((a, i) => (
              <button
                key={a.id}
                onClick={() => onArtist(a.artist)}
                className="text-left group animate-fade-in"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="relative aspect-square rounded-[14px] overflow-hidden mb-2 bg-white/[0.04]">
                  {a.cover ? (
                    <img
                      src={a.cover}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">💽</div>
                  )}
                  {a.year && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[9.5px] font-bold text-white backdrop-blur-sm">
                      {a.year}
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-bold text-[#e4e4ee] line-clamp-1 group-hover:text-[#a68fff] transition-colors">
                  {a.title}
                </p>
                <p className="text-[10.5px] text-[#5a5a70] line-clamp-1">{a.artist}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Жанры */}
      {genres.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title !mb-0 flex-1">🎭 Жанры каталога</p>
            <span className="gash-badge gash-badge-neutral !text-[9.5px] ml-3">Deezer жанры</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button key={g.id} onClick={() => onArtist(g.name)} className="artist-chip">
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Редакция */}
      {editorial.length > 0 && (
        <div>
          <p className="section-title">✨ Выбор редакции</p>
          <div className="flex flex-wrap gap-2">
            {editorial.map((e) => (
              <button
                key={e.id}
                onClick={() => onArtist(e.name)}
                className="px-4 py-2 rounded-full text-[12.5px] font-bold border transition-all bg-white/[0.035] text-[#a8a8bd] border-white/[0.07] hover:bg-[#7c5cff]/15 hover:text-white hover:border-[#7c5cff]/45"
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {apiCount > 0 && (
        <p className="text-center text-[11.5px] text-[#4a4a5e]">
          Данные собираются из <b className="text-[#7c5cff]">{apiCount}</b> открытых музыкальных API
        </p>
      )}
    </div>
  );
}
