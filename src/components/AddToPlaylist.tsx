"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { Track } from "./PlayerContext";

interface PlaylistRow {
  id: number;
  name: string;
  emoji: string;
  color: string;
  trackCount: number;
}

const EMOJI_SET = ["🎵", "🔥", "💜", "🌙", "☀️", "🏋️", "🚗", "🎮", "😴", "💃"];

/**
 * Кнопка «＋ в плейлист».
 *
 * Меню рендерится через портал в <body> с фиксированными координатами —
 * поэтому оно не наследует transform/overflow родителя и не дёргается
 * при наведении на строку трека.
 */
export function AddToPlaylist({
  track,
  variant = "icon",
}: {
  track: Track;
  variant?: "icon" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<PlaylistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [emoji, setEmoji] = useState("🎵");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      if (res.ok) setLists(data.playlists || []);
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  /** Считаем позицию меню относительно окна */
  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const W = 270;
    const H = 340;

    let left = r.right - W;
    let top = r.bottom + 8;

    // Не вылезаем за края экрана
    if (left < 8) left = 8;
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 8);

    setPos({ top, left });
  }, []);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
    void load();
  };

  // Пересчитываем при скролле и ресайзе
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  const flash = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 1500);
  };

  const addTo = async (playlistId: number, name: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || "Ошибка", false);
        return;
      }
      if (data.duplicate) {
        flash("Уже в «" + name + "»", false);
      } else {
        flash("Добавлено в «" + name + "»");
        setLists((p) =>
          p.map((x) => (x.id === playlistId ? { ...x, trackCount: x.trackCount + 1 } : x))
        );
        setTimeout(() => setOpen(false), 700);
      }
    } catch {
      flash("Ошибка сети", false);
    }
  };

  const createAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), emoji }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        await addTo(data.playlist.id, data.playlist.name);
        setNewName("");
        await load();
      } else {
        flash(data.error || "Ошибка", false);
      }
    } catch {
      flash("Ошибка сети", false);
    } finally {
      setCreating(false);
    }
  };

  const menu =
    open && pos && mounted
      ? createPortal(
          <>
            {/* Клик мимо — закрыть */}
            <div
              className="fixed inset-0 z-[190]"
              onClick={() => setOpen(false)}
              onWheel={() => setOpen(false)}
            />

            <div
              ref={menuRef}
              className="fixed z-[200] w-[270px] rounded-2xl p-2.5 animate-pop"
              style={{
                top: pos.top,
                left: pos.left,
                background: "rgba(20,20,27,0.98)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 28px 60px -20px rgba(0,0,0,1), 0 0 0 1px rgba(108,92,231,0.14)",
                backdropFilter: "blur(24px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Шапка */}
              <div className="flex items-center gap-2 px-1.5 pb-2.5 mb-1 border-b border-white/[0.07]">
                <img
                  src={track.artwork}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-white truncate leading-tight">
                    {track.title}
                  </p>
                  <p className="text-[10.5px] text-[#7a7a8a] truncate">{track.artist}</p>
                </div>
              </div>

              {toast && (
                <div
                  className={`px-3 py-2 rounded-xl mb-2 text-[12px] font-semibold animate-pop ${
                    toast.ok
                      ? "bg-[#00e0a4]/12 text-[#4ff0c8] border border-[#00e0a4]/25"
                      : "bg-[#ffc542]/12 text-[#ffd370] border border-[#ffc542]/25"
                  }`}
                >
                  {toast.ok ? "✓ " : "· "}
                  {toast.text}
                </div>
              )}

              {/* Список */}
              <div className="max-h-[180px] overflow-y-auto space-y-1 mb-2">
                {loading ? (
                  <div className="space-y-1.5 p-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton h-9" />
                    ))}
                  </div>
                ) : lists.length === 0 ? (
                  <p className="text-[12px] text-[#6a6a7a] px-2 py-4 text-center">
                    Плейлистов пока нет —<br />создайте первый ниже
                  </p>
                ) : (
                  lists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void addTo(p.id, p.name)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.09] active:scale-[0.98] transition-all text-left"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] flex-shrink-0"
                        style={{ background: `${p.color}22` }}
                      >
                        {p.emoji}
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] font-semibold text-[#dcdce6] truncate">
                        {p.name}
                      </span>
                      <span className="text-[10.5px] text-[#6a6a7a] flex-shrink-0 tabular-nums">
                        {p.trackCount}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Создание */}
              <form onSubmit={createAndAdd} className="pt-2 border-t border-white/[0.08]">
                <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar">
                  {EMOJI_SET.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-7 h-7 rounded-lg text-[13px] flex-shrink-0 transition-all ${
                        emoji === e ? "bg-[#6c5ce7]/30 ring-1 ring-[#6c5ce7] scale-110" : "hover:bg-white/[0.08]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Новый плейлист…"
                    maxLength={120}
                    className="gash-input !py-2 !text-[12.5px] !rounded-xl"
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="gash-btn !py-2 !px-3 !text-[13px] !rounded-xl"
                  >
                    ＋
                  </button>
                </div>
              </form>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        data-menu-open={open ? "true" : "false"}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={
          variant === "icon"
            ? `icon-btn ${open ? "on" : ""}`
            : `gash-btn-outline !text-[12.5px] !py-2 !px-3.5 ${open ? "!bg-[#6c5ce7]/25" : ""}`
        }
        title="Добавить в плейлист"
      >
        {variant === "icon" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className={`transition-transform duration-300 ${open ? "rotate-45" : ""}`}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        ) : (
          <>＋ В плейлист</>
        )}
      </button>
      {menu}
    </>
  );
}
