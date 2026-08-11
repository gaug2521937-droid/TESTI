import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { PlayerProvider } from "@/components/PlayerContext";
import { PlayerBar } from "@/components/PlayerBar";
import { NowPlaying } from "@/components/NowPlaying";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GASHPROJECT — музыка, казино, крипта и не только",
  description:
    "Полные треки, радио, восемь игр с проверяемой честностью, живые графики криптовалют, нейросеть для картинок, погода, новости и утилиты.",
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
};

const FOOTER = [
  { t: "Звук", l: [["/music", "Музыка"], ["/playlists", "Плейлисты"], ["/radio", "Радио"]] },
  { t: "Рынки", l: [["/rates", "Крипта"], ["/weather", "Погода"], ["/news", "Новости"]] },
  { t: "Развлечения", l: [["/casino", "Казино"], ["/ai", "AI-арт"], ["/video", "Видео"]] },
  { t: "Общение", l: [["/notes", "Посты"], ["/chat", "Чат"], ["/messages", "Сообщения"]] },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <div className="aurora-bg">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
          <div className="grid-overlay" />
        </div>

        <PlayerProvider>
          <Sidebar />

          {/* Контент со сдвигом под боковую панель */}
          <div className="lg:pl-[248px] min-h-screen flex flex-col">
            <main className="flex-1 w-full">{children}</main>

            <footer className="mt-16 border-t border-white/[0.06] bg-black/25 backdrop-blur-sm">
              <div className="max-w-6xl mx-auto px-5 py-10">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-[15px] font-black gradient-text mb-2.5">GASHPROJECT</p>
                    <p className="text-[12px] text-[#5a5a70] leading-relaxed">
                      Открытый хаб: музыка, игры, крипта и утилиты. Без рекламы и подписок.
                    </p>
                  </div>
                  {FOOTER.map((g) => (
                    <div key={g.t}>
                      <p className="text-[9.5px] uppercase tracking-[0.16em] font-extrabold text-[#3f3f52] mb-3">
                        {g.t}
                      </p>
                      <div className="space-y-1.5">
                        {g.l.map(([href, label]) => (
                          <Link
                            key={href}
                            href={href}
                            className="block text-[12.5px] text-[#7a7a90] hover:text-[#a68fff] transition-colors no-underline"
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="gash-divider !my-0 !mb-5" />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-[11px] text-[#4a4a5e]">
                    © {new Date().getFullYear()} GASHPROJECT · все данные из открытых источников
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {["Audius", "Archive", "Binance", "CoinGecko", "Open-Meteo", "Pollinations"].map((t) => (
                      <span key={t} className="src-pill" style={{ background: "rgba(255,255,255,0.04)", color: "#5a5a70", borderColor: "rgba(255,255,255,0.06)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </div>

          <PlayerBar />
          <NowPlaying />
        </PlayerProvider>
      </body>
    </html>
  );
}
