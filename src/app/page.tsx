import Link from "next/link";
import { HomeCryptoWidget } from "@/components/HomeCryptoWidget";
import { LiveClock } from "@/components/LiveClock";

export const dynamic = "force-static";

/** Крупные карточки — главные разделы */
const HERO_CARDS = [
  {
    icon: "🎵",
    title: "Музыка",
    desc: "Три открытых каталога, миллионы треков. Каждая песня играет целиком — от первой до последней секунды.",
    href: "/music",
    color: "#f043a0",
    tag: "Только полные треки",
    span: "lg:col-span-2",
  },
  {
    icon: "🎰",
    title: "Казино",
    desc: "Восемь игр с проверяемой честностью: Crash, Mines, Plinko, Tower и другие.",
    href: "/casino",
    color: "#ffb340",
    tag: "8 игр",
    span: "",
  },
  {
    icon: "📈",
    title: "Крипта",
    desc: "Живые графики, индекс страха и жадности, курсы ЦБ и конвертер.",
    href: "/rates",
    color: "#34e5a0",
    tag: "Real-time",
    span: "",
  },
  {
    icon: "🎨",
    title: "AI-картинки",
    desc: "Опишите словами — нейросеть нарисует. Двенадцать стилей, бесплатно.",
    href: "/ai",
    color: "#a68fff",
    tag: "Нейросеть Flux",
    span: "lg:col-span-2",
  },
];

/** Компактные плитки — остальные разделы */
const TILES = [
  { icon: "💿", title: "Плейлисты", href: "/playlists", color: "#a68fff" },
  { icon: "📻", title: "Радио", href: "/radio", color: "#22d3ee" },
  { icon: "🎬", title: "Видео", href: "/video", color: "#ff4d6d" },
  { icon: "🌤", title: "Погода", href: "/weather", color: "#22d3ee" },
  { icon: "🧰", title: "Инструменты", href: "/tools", color: "#ffb340" },
  { icon: "📮", title: "Посты", href: "/notes", color: "#a68fff" },
  { icon: "💬", title: "Чат", href: "/chat", color: "#7c5cff" },
  { icon: "💌", title: "Сообщения", href: "/messages", color: "#34e5a0" },
];

const SOURCES = [
  { l: "Audius", c: "#34e5a0" },
  { l: "Internet Archive", c: "#ffb340" },
  { l: "ccMixter", c: "#22d3ee" },
  { l: "Radio Browser", c: "#a68fff" },
  { l: "Binance", c: "#ffb340" },
  { l: "Open-Meteo", c: "#22d3ee" },
  { l: "Pollinations", c: "#f043a0" },
];

const STATS = [
  { value: "12", label: "Разделов" },
  { value: "8", label: "Игр в казино" },
  { value: "100%", label: "Песен целиком" },
  { value: "0 ₽", label: "Стоимость" },
];

export default function HomePage() {
  return (
    <div className="hero-gradient">
      {/* ═══════════ HERO ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 pt-14 md:pt-20 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <div className="status-pill ok animate-fade-in">
            <span className="live-dot" />
            Все сервисы работают прямо сейчас
          </div>

          <div className="text-[64px] md:text-[80px] leading-none mb-5 animate-float">⚡</div>

          <h1
            className="text-[2.4rem] sm:text-[3.2rem] md:text-[4rem] font-black mb-5 leading-[1.05] animate-fade-in"
            style={{ animationDelay: "0.05s" }}
          >
            Всё, что нужно —
            <br />
            <span className="gradient-text">в одном месте</span>
          </h1>

          <p
            className="text-[15px] md:text-[17px] text-[#8a8a9e] leading-relaxed mb-8 max-w-xl mx-auto animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            Музыка целиком, радио, графики криптовалют, восемь игр, нейросеть для картинок,
            погода, чат и утилиты. Без регистрации и оплаты.
          </p>

          <div
            className="flex items-center justify-center gap-3 flex-wrap mb-7 animate-fade-in"
            style={{ animationDelay: "0.15s" }}
          >
            <Link href="/music" className="gash-btn !text-[15px] !py-3.5 !px-8 no-underline">
              🎧 Слушать музыку
            </Link>
            <Link href="/casino" className="gash-btn-outline !text-[15px] !py-3.5 !px-8 no-underline">
              🎰 Играть в казино
            </Link>
          </div>

          <div
            className="flex items-center justify-center gap-1.5 flex-wrap mb-8 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            {SOURCES.map((s) => (
              <span
                key={s.l}
                className="src-pill"
                style={{ background: `${s.c}12`, color: s.c, borderColor: `${s.c}2e` }}
              >
                ● {s.l}
              </span>
            ))}
          </div>

          <LiveClock />
        </div>
      </section>

      {/* ═══════════ КРИПТА ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <p className="section-title !mb-1.5">Живые данные</p>
            <h2 className="text-[1.7rem] md:text-[2.1rem] font-black text-[#f2f2f7]">
              Крипторынок <span className="gradient-text">сейчас</span>
            </h2>
          </div>
          <Link href="/rates" className="gash-btn-ghost no-underline">Все графики →</Link>
        </div>
        <HomeCryptoWidget />
      </section>

      {/* ═══════════ КРУПНЫЕ КАРТОЧКИ ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 pb-10">
        <p className="section-title">Основное</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {HERO_CARDS.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className={`gash-card gash-card-glow p-6 no-underline group animate-fade-in flex flex-col ${c.span}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="icon-tile"
                  style={{ background: `${c.color}18`, color: c.color, borderColor: `${c.color}30` }}
                >
                  {c.icon}
                </div>
                <span
                  className="gash-badge !text-[10px]"
                  style={{ background: `${c.color}14`, color: c.color, borderColor: `${c.color}35` }}
                >
                  {c.tag}
                </span>
              </div>

              <h3
                className="text-[19px] font-black mb-2 transition-transform duration-300 group-hover:translate-x-1"
                style={{ color: c.color }}
              >
                {c.title}
              </h3>
              <p className="text-[13.5px] text-[#8a8a9e] leading-relaxed flex-1">{c.desc}</p>

              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-1.5 text-[13px] font-bold text-[#6a6a80] group-hover:text-[#a68fff] transition-colors">
                Открыть
                <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════ ПЛИТКИ ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <p className="section-title">Ещё разделы</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {TILES.map((t, i) => (
            <Link
              key={t.href}
              href={t.href}
              className="gash-card p-4 no-underline text-center animate-fade-in group"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="text-[26px] mb-2 transition-transform duration-300 group-hover:scale-110">
                {t.icon}
              </div>
              <div className="text-[12.5px] font-bold" style={{ color: t.color }}>
                {t.title}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════ СТАТИСТИКА ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <div className="gash-card gash-card-static p-8 md:p-10 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-45 pointer-events-none"
            style={{
              background:
                "radial-gradient(620px 220px at 18% 0%, rgba(124,92,255,0.28), transparent 66%), radial-gradient(520px 210px at 86% 100%, rgba(34,211,238,0.16), transparent 66%)",
            }}
          />
          <div className="relative">
            <h2 className="text-[1.4rem] md:text-[1.8rem] font-black text-center mb-8 text-[#f2f2f7]">
              Почему <span className="gradient-text">GASHPROJECT</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((s, i) => (
                <div key={s.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="max-w-3xl mx-auto px-4 pb-10">
        <div className="gash-card gash-card-glow p-8 md:p-12 text-center">
          <div className="text-[52px] mb-5 animate-float">🚀</div>
          <h2 className="text-[1.5rem] md:text-[2rem] font-black text-[#f2f2f7] mb-3">
            Готовы начать?
          </h2>
          <p className="text-[#8a8a9e] mb-7 max-w-md mx-auto text-[14.5px] leading-relaxed">
            Создайте аккаунт — уровни, монеты, плейлисты и история будут сохраняться.
            Регистрация по номеру занимает полминуты.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register" className="gash-btn !text-[15px] !py-3.5 !px-8 no-underline">
              ✨ Создать аккаунт
            </Link>
            <Link href="/login" className="gash-btn-outline !text-[15px] !py-3.5 !px-8 no-underline">
              🔑 Войти
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
