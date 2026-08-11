"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  color: string;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Звук",
    items: [
      { href: "/music", label: "Музыка", icon: "🎵", color: "#f043a0" },
      { href: "/playlists", label: "Плейлисты", icon: "💿", color: "#a68fff" },
      { href: "/radio", label: "Радио", icon: "📻", color: "#22d3ee" },
    ],
  },
  {
    title: "Рынки",
    items: [
      { href: "/rates", label: "Крипта", icon: "📈", color: "#34e5a0" },
      { href: "/weather", label: "Погода", icon: "🌤", color: "#22d3ee" },
      { href: "/news", label: "Новости", icon: "📰", color: "#ffb340" },
    ],
  },
  {
    title: "Развлечения",
    items: [
      { href: "/casino", label: "Казино", icon: "🎰", color: "#ffb340" },
      { href: "/ai", label: "AI-арт", icon: "🎨", color: "#f043a0" },
      { href: "/video", label: "Видео", icon: "🎬", color: "#ff4d6d" },
      { href: "/reels", label: "Рилс VK", icon: "📱", color: "#22d3ee" },
    ],
  },
  {
    title: "Общение",
    items: [
      { href: "/notes", label: "Посты", icon: "📮", color: "#a68fff" },
      { href: "/chat", label: "Чат", icon: "💬", color: "#7c5cff" },
      { href: "/messages", label: "Сообщения", icon: "💌", color: "#34e5a0" },
    ],
  },
  {
    title: "Прочее",
    items: [{ href: "/tools", label: "Инструменты", icon: "🧰", color: "#ffb340" }],
  },
];

interface Me {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Боковая панель навигации.
 * На широких экранах закреплена слева, на мобильных — выезжает шторкой.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [level, setLevel] = useState<{ level: number; color: string; title: string; progress: number } | null>(null);
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setUser(d.user))
      .catch(() => {});

    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.level) setLevel(d.level);
        if (typeof d?.coins === "number") setCoins(d.coins);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  const label = user?.displayName || user?.username || "";

  const nav = (
    <>
      {/* Логотип */}
      <Link href="/" className="flex items-center gap-2.5 no-underline group px-3 py-4 flex-shrink-0">
        <div className="group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
          <Logo size={34} />
        </div>
        <div className="leading-none">
          <div className="text-[15px] font-black gradient-text tracking-[-0.04em]">GASHPROJECT</div>
          <div className="text-[8px] text-[#4a4a5e] tracking-[0.28em] font-bold mt-[3px]">HUB · 2026</div>
        </div>
      </Link>

      {/* Профиль-карточка */}
      <div className="px-3 mb-3 flex-shrink-0">
        {user ? (
          <Link
            href="/profile"
            className="block rounded-[18px] p-3 no-underline transition-all hover:border-[#7c5cff]/50"
            style={{
              background: "linear-gradient(150deg, rgba(124,92,255,0.14), rgba(124,92,255,0.03))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-[13px] object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-[#8f72ff] to-[#5334d6] flex items-center justify-center text-[14px] font-black text-white flex-shrink-0">
                  {label[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-white truncate leading-tight">{label}</p>
                {level && (
                  <p className="text-[10.5px] font-bold" style={{ color: level.color }}>
                    {level.level} ур · {level.title}
                  </p>
                )}
              </div>
            </div>

            {level && (
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${level.progress}%`, background: `linear-gradient(90deg, ${level.color}, #7c5cff)` }}
                />
              </div>
            )}

            {coins !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#5a5a70]">Монеты</span>
                <span className="text-[12.5px] font-extrabold text-[#ffb340] tabular-nums">
                  {coins.toLocaleString("ru-RU")}
                </span>
              </div>
            )}
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Link href="/login" className="gash-btn-ghost justify-center no-underline !text-[12.5px]">Вход</Link>
            <Link href="/register" className="gash-btn justify-center no-underline !text-[12.5px] !py-2.5 !px-2">Создать</Link>
          </div>
        )}
      </div>

      {/* Пункты меню */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 no-scrollbar">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] no-underline mb-1 transition-all ${
            pathname === "/" ? "bg-white/[0.09] text-white" : "text-[#8a8a9e] hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <span className="text-[16px] w-5 text-center">🏠</span>
          <span className="text-[13.5px] font-bold">Главная</span>
        </Link>

        {GROUPS.map((g) => (
          <div key={g.title} className="mt-4">
            <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-[#3f3f52] px-3 mb-1.5">
              {g.title}
            </p>
            {g.items.map((i) => {
              const on = pathname === i.href;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-[14px] no-underline mb-0.5 transition-all"
                  style={{
                    background: on ? `${i.color}1c` : undefined,
                    color: on ? i.color : "#8a8a9e",
                  }}
                >
                  {on && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: i.color, boxShadow: `0 0 10px ${i.color}` }}
                    />
                  )}
                  <span className="text-[16px] w-5 text-center">{i.icon}</span>
                  <span className="text-[13.5px] font-bold">{i.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Низ панели */}
      {user && (
        <div className="px-3 pb-3 flex-shrink-0">
          <button onClick={logout} className="gash-btn-ghost w-full justify-center !text-[#ff849c] !text-[12.5px]">
            Выйти из аккаунта
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Десктоп: закреплённая панель */}
      <aside
        className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[248px] z-40 flex-col"
        style={{
          background: "rgba(11,11,17,0.72)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(24px) saturate(150%)",
        }}
      >
        {nav}
      </aside>

      {/* Мобильная шапка */}
      <header
        className="lg:hidden sticky top-0 z-50 flex items-center justify-between px-4 h-[62px]"
        style={{
          background: "rgba(7,7,11,0.9)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Logo size={30} />
          <span className="text-[15px] font-black gradient-text tracking-[-0.04em]">GASHPROJECT</span>
        </Link>

        <div className="flex items-center gap-2">
          {coins !== null && (
            <span className="px-2.5 py-1.5 rounded-xl bg-[#ffb340]/12 border border-[#ffb340]/25 text-[12px] font-extrabold text-[#ffb340] tabular-nums">
              {coins.toLocaleString("ru-RU")}
            </span>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="w-10 h-10 rounded-[13px] bg-white/[0.05] border border-white/[0.08] flex flex-col items-center justify-center gap-[5px] active:scale-95 transition-transform"
            aria-label="Меню"
          >
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "opacity-0" : ""}`} />
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </button>
        </div>
      </header>

      {/* Мобильная шторка */}
      <div className={`lg:hidden fixed inset-0 z-[60] transition-all duration-300 ${open ? "visible" : "invisible"}`}>
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-[272px] flex flex-col transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            background: "rgba(13,13,20,0.98)",
            borderRight: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(24px)",
          }}
        >
          {nav}
        </aside>
      </div>
    </>
  );
}
