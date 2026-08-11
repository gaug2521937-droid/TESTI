import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { casinoHistory, notes, playlists, playlistTracks, directMessages, chatMessages } from "@/db/schema";
import { eq, sql, or, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Собираем статистику пользователя
  const [betStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      wins: sql<number>`count(*) filter (where result = 'win')::int`,
      wagered: sql<number>`coalesce(sum(amount),0)::float`,
      won: sql<number>`coalesce(sum(payout),0)::float`,
    })
    .from(casinoHistory)
    .where(eq(casinoHistory.userId, user.id));

  const [noteCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notes)
    .where(eq(notes.userId, user.id));

  const [plCount] = await db
    .select({
      c: sql<number>`count(*)::int`,
      tracks: sql<number>`(select count(*)::int from ${playlistTracks} pt
        join ${playlists} p on p.id = pt.playlist_id where p.user_id = ${user.id})`,
    })
    .from(playlists)
    .where(eq(playlists.userId, user.id));

  const [dmCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(or(eq(directMessages.senderId, user.id), eq(directMessages.recipientId, user.id)));

  const [chatCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.userId, user.id));

  const recentBets = await db
    .select()
    .from(casinoHistory)
    .where(eq(casinoHistory.userId, user.id))
    .orderBy(desc(casinoHistory.createdAt))
    .limit(5);

  const profit = (betStats?.won ?? 0) - (betStats?.wagered ?? 0);
  const winRate = betStats?.total ? ((betStats.wins / betStats.total) * 100).toFixed(0) : "0";
  const label = user.displayName || user.username;
  
  const stats = [
    { l: "Ставок", v: betStats?.total ?? 0, i: "🎰", c: "#ffc542", href: "/casino" },
    { l: "Винрейт", v: `${winRate}%`, i: "📊", c: "#00e0a4", href: "/casino" },
    { l: "Плейлистов", v: plCount?.c ?? 0, i: "💿", c: "#6c5ce7", href: "/playlists" },
    { l: "Треков", v: plCount?.tracks ?? 0, i: "🎵", c: "#e84393", href: "/music" },
    { l: "Заметок", v: noteCount?.c ?? 0, i: "📝", c: "#00d2ff", href: "/notes" },
    { l: "Сообщений", v: (dmCount?.c ?? 0) + (chatCount?.c ?? 0), i: "💬", c: "#ff7043", href: "/messages" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      {/* Шапка профиля */}
      <div className="gash-card gash-card-static p-7 md:p-9 mb-5 animate-rise relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px 220px at 15% 0%, rgba(108,92,231,0.30), transparent 65%), radial-gradient(420px 200px at 90% 100%, rgba(0,210,255,0.16), transparent 65%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-24 h-24 rounded-3xl object-cover shadow-2xl flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#8577f0] to-[#4b3fb8] flex items-center justify-center text-4xl font-extrabold text-white shadow-2xl flex-shrink-0">
              {label[0]?.toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-3xl font-extrabold text-white mb-1">{label}</h1>
            <p className="text-[14px] text-[#8a8a99] mb-3">
              @{user.username}
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="gash-badge gash-badge-info">
                {user.authProvider === "phone" ? "📱 По телефону" : "🔑 Аккаунт с паролем"}
              </span>
              {user.phone && (
                <span className="gash-badge gash-badge-success">
                  📱 {maskPhone(user.phone)}
                </span>
              )}
              <span className="gash-badge gash-badge-neutral">
                📅 с {new Date(user.createdAt).toLocaleDateString("ru-RU")}
              </span>
              {user.email && <span className="gash-badge gash-badge-neutral">✉️ {user.email}</span>}
            </div>
          </div>

          <Link href="/messages" className="gash-btn no-underline flex-shrink-0">
            💌 Сообщения
          </Link>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {stats.map((s, i) => (
          <Link
            key={s.l}
            href={s.href}
            style={{ animationDelay: `${i * 0.05}s` }}
            className="gash-card p-4 text-center no-underline animate-fade-in"
          >
            <div className="text-xl mb-1.5">{s.i}</div>
            <div className="text-xl font-extrabold tabular-nums" style={{ color: s.c }}>
              {s.v}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] mt-1">
              {s.l}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Баланс казино */}
        <div className="gash-card gash-card-static p-6 animate-fade-in">
          <h3 className="text-[15px] font-extrabold text-[#e8e8f0] mb-5">🎰 Итоги казино</h3>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { l: "Поставлено", v: betStats?.wagered ?? 0, c: "#a99bff" },
              { l: "Выиграно", v: betStats?.won ?? 0, c: "#00e0a4" },
              { l: "Итог", v: profit, c: profit >= 0 ? "#00e0a4" : "#ff5470" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-1">
                  {x.l}
                </div>
                <div className="text-[15px] font-extrabold tabular-nums" style={{ color: x.c }}>
                  {x.v >= 0 && x.l === "Итог" ? "+" : ""}
                  {Math.round(x.v).toLocaleString("ru-RU")}
                </div>
              </div>
            ))}
          </div>

          {recentBets.length === 0 ? (
            <p className="text-[13px] text-[#6a6a7a] text-center py-6">Ставок пока нет</p>
          ) : (
            <div className="space-y-1.5">
              {recentBets.map((b) => {
                const win = b.result === "win";
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                  >
                    <span className="text-[12.5px] font-bold" style={{ color: win ? "#00e0a4" : "#ff5470" }}>
                      {win ? "🎉" : "😔"} #{b.rolledNumber}
                    </span>
                    <span className="text-[12px] text-[#7a7a8a] tabular-nums">
                      {b.amount.toLocaleString("ru-RU")}
                    </span>
                    <span className="text-[12.5px] font-extrabold tabular-nums" style={{ color: win ? "#00e0a4" : "#ff5470" }}>
                      {win ? "+" : "−"}
                      {(win ? b.payout : b.amount).toLocaleString("ru-RU")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Быстрые ссылки */}
        <div className="gash-card gash-card-static p-6 animate-fade-in">
          <h3 className="text-[15px] font-extrabold text-[#e8e8f0] mb-5">⚡ Быстрый доступ</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { h: "/music", i: "🎵", l: "Музыка", d: "Полные треки" },
              { h: "/playlists", i: "💿", l: "Плейлисты", d: "Мои подборки" },
              { h: "/messages", i: "💌", l: "Сообщения", d: "Личные чаты" },
              { h: "/rates", i: "📈", l: "Крипта", d: "Графики" },
              { h: "/weather", i: "🌤", l: "Погода", d: "7 дней" },
              { h: "/tools", i: "🧰", l: "Инструменты", d: "8 утилит" },
            ].map((x) => (
              <Link
                key={x.h}
                href={x.h}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#6c5ce7]/45 hover:bg-[#6c5ce7]/[0.08] transition-all no-underline"
              >
                <span className="text-lg flex-shrink-0">{x.i}</span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-[#dcdce6] truncate">{x.l}</p>
                  <p className="text-[10.5px] text-[#6a6a7a] truncate">{x.d}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
