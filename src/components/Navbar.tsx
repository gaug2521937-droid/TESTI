"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  color: string;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Медиа",
    items: [
      { href: "/music", label: "Музыка", icon: "🎵", color: "#f043a0" },
      { href: "/playlists", label: "Плейлисты", icon: "💿", color: "#a68fff" },
      { href: "/radio", label: "Радио", icon: "📻", color: "#22d3ee" },
      { href: "/video", label: "Видео", icon: "🎬", color: "#ff4d6d" },
    ],
  },
  {
    title: "Данные",
    items: [
      { href: "/rates", label: "Крипта", icon: "📈", color: "#34e5a0" },
      { href: "/weather", label: "Погода", icon: "🌤", color: "#22d3ee" },
      { href: "/tools", label: "Инструменты", icon: "🧰", color: "#ffb340" },
      { href: "/ai", label: "AI-картинки", icon: "🎨", color: "#f043a0" },
    ],
  },
  {
    title: "Общение",
    items: [
      { href: "/casino", label: "Казино", icon: "🎰", color: "#ffb340" },
      { href: "/notes", label: "Посты", icon: "📮", color: "#a68fff" },
      { href: "/chat", label: "Чат", icon: "💬", color: "#7c5cff" },
      { href: "/messages", label: "Сообщения", icon: "💌", color: "#22d3ee" },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);
const PRIMARY = ["/music", "/radio", "/rates", "/casino", "/ai"];

interface Me {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [level, setLevel] = useState<{ level: number; color: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setUser(d.user))
      .catch(() => {});

    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.level && setLevel({ level: d.level.level, color: d.level.color }))
      .catch(() => {});

    const onScroll = () => setScrolled(window.scrollY > 14);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => { setMore(false); setOpen(false); }, [pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  const label = user?.displayName || user?.username || "";
  const mainItems = ALL.filter((i) => PRIMARY.includes(i.href));
  const restGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !PRIMARY.includes(i.href)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? "bg-[#07070b]/88 backdrop-blur-2xl border-white/[0.08] shadow-[0_12px_40px_-22px_rgba(0,0,0,1)]"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-[66px] gap-3">
          {/* Логотип */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group flex-shrink-0">
            <div className="relative w-9 h-9 rounded-[13px] flex items-center justify-center text-[17px] bg-gradient-to-br from-[#8f72ff] via-[#7c5cff] to-[#5334d6] shadow-[0_8px_22px_-8px_rgba(124,92,255,1)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              ⚡
            </div>
            <div className="leading-none hidden sm:block">
              <div className="text-[16.5px] font-black gradient-text tracking-tight">GASHPROJECT</div>
              <div className="text-[9px] text-[#4a4a5e] tracking-[0.24em] font-bold mt-[3px]">ALL IN ONE</div>
            </div>
          </Link>

          {/* Десктоп-меню */}
          <div className="hidden xl:flex items-center gap-1">
            {mainItems.map((i) => {
              const on = pathname === i.href;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`nav-link no-underline ${on ? "active" : ""}`}
                  style={on ? { boxShadow: `inset 0 0 0 1px ${i.color}55`, background: `${i.color}1c` } : {}}
                >
                  <span className="text-[13px]">{i.icon}</span>
                  <span style={on ? { color: i.color } : {}}>{i.label}</span>
                </Link>
              );
            })}

            {/* Выпадающее «Ещё» */}
            <div className="relative">
              <button
                onClick={() => setMore((m) => !m)}
                className={`nav-link ${restGroups.some((g) => g.items.some((i) => i.href === pathname)) ? "active" : ""}`}
              >
                <span className="text-[13px]">✨</span>
                <span>Ещё</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  className={`transition-transform duration-300 ${more ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {more && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMore(false)} />
                  <div
                    className="absolute right-0 top-full mt-2.5 w-[520px] z-50 rounded-[22px] p-4 animate-pop grid grid-cols-3 gap-4"
                    style={{
                      background: "rgba(17,17,24,0.98)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 28px 64px -22px rgba(0,0,0,1)",
                      backdropFilter: "blur(24px)",
                    }}
                  >
                    {restGroups.map((g) => (
                      <div key={g.title}>
                        <p className="text-[9.5px] uppercase tracking-[0.14em] font-extrabold text-[#4a4a5e] mb-2 px-1">
                          {g.title}
                        </p>
                        <div className="space-y-0.5">
                          {g.items.map((i) => (
                            <Link
                              key={i.href}
                              href={i.href}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl no-underline transition-all ${
                                pathname === i.href ? "bg-white/[0.09]" : "hover:bg-white/[0.06]"
                              }`}
                            >
                              <span className="text-[15px]">{i.icon}</span>
                              <span
                                className="text-[13px] font-bold"
                                style={{ color: pathname === i.href ? i.color : "#a8a8bd" }}
                              >
                                {i.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Профиль */}
          <div className="hidden xl:flex items-center gap-2.5 flex-shrink-0">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-[14px] bg-white/[0.05] border border-white/[0.08] hover:border-[#7c5cff]/50 transition-colors no-underline"
                >
                  <div className="relative">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-[10px] object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-[#8f72ff] to-[#5334d6] flex items-center justify-center text-[12px] font-extrabold text-white">
                        {label[0]?.toUpperCase()}
                      </div>
                    )}
                    {level && (
                      <span
                        className="absolute -bottom-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full text-[8.5px] font-black text-white flex items-center justify-center border-2 border-[#07070b]"
                        style={{ background: level.color }}
                      >
                        {level.level}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-bold text-[#d5d5e2] max-w-[100px] truncate">{label}</span>
                </Link>
                <button onClick={logout} className="gash-btn-ghost">Выйти</button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link no-underline">Вход</Link>
                <Link href="/register" className="gash-btn !text-[13.5px] !py-2.5 !px-5 no-underline">Регистрация</Link>
              </>
            )}
          </div>

          {/* Гамбургер */}
          <button
            className="xl:hidden w-10 h-10 rounded-[13px] bg-white/[0.05] border border-white/[0.08] flex flex-col items-center justify-center gap-[5px] active:scale-95 transition-transform flex-shrink-0"
            onClick={() => setOpen(!open)}
            aria-label="Меню"
          >
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "rotate-45 translate-y-[7px]" : ""}`} />
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "opacity-0 scale-0" : ""}`} />
            <span className={`block w-[17px] h-[2px] rounded-full bg-[#e4e4ee] transition-all duration-300 ${open ? "-rotate-45 -translate-y-[7px]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <div className={`xl:hidden fixed inset-0 top-[66px] z-40 transition-all duration-300 ${open ? "opacity-100 visible" : "opacity-0 invisible"}`}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div
          className={`relative bg-[#0d0d14]/98 backdrop-blur-2xl border-b border-white/[0.09] px-4 py-5 max-h-[calc(100vh-66px)] overflow-y-auto transition-transform duration-400 ${
            open ? "translate-y-0" : "-translate-y-6"
          }`}
        >
          {GROUPS.map((g, gi) => (
            <div key={g.title} className="mb-4">
              <p className="section-title !mb-2.5">{g.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((i, ii) => {
                  const on = pathname === i.href;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setOpen(false)}
                      style={{
                        animationDelay: `${(gi * 4 + ii) * 0.025}s`,
                        background: on ? `${i.color}20` : undefined,
                        borderColor: on ? `${i.color}55` : undefined,
                      }}
                      className={`animate-fade-in flex items-center gap-2.5 p-3.5 rounded-[17px] no-underline border transition-all ${
                        on ? "" : "bg-white/[0.03] border-white/[0.07] active:scale-95"
                      }`}
                    >
                      <span className="text-xl">{i.icon}</span>
                      <span className="text-[13px] font-bold" style={{ color: on ? i.color : "#a8a8bd" }}>
                        {i.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="gash-divider !my-3" />

          {user ? (
            <div className="flex items-center justify-between gap-3">
              <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 no-underline">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-[14px] object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#8f72ff] to-[#5334d6] flex items-center justify-center text-sm font-extrabold text-white">
                    {label[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{label}</p>
                  <p className="text-[11px] text-[#5a5a70]">
                    {level ? `${level.level} уровень · профиль →` : "Открыть профиль →"}
                  </p>
                </div>
              </Link>
              <button onClick={logout} className="gash-btn-ghost !text-[#ff849c]">Выйти</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/login" onClick={() => setOpen(false)} className="gash-btn-outline no-underline justify-center">🔑 Вход</Link>
              <Link href="/register" onClick={() => setOpen(false)} className="gash-btn no-underline justify-center">✨ Создать</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
