import Link from "next/link";

// Моковые данные для статического экспорта
const mockUser = {
  id: "static-user",
  username: "demo_user",
  displayName: "Demo User",
  avatarUrl: null,
  authProvider: "phone",
  phone: "+79991234567",
  createdAt: new Date().toISOString(),
  email: "demo@example.com"
};

const mockBetStats = {
  total: 100,
  wins: 45,
  wagered: 5000,
  won: 7500,
};

const mockRecentBets = [
  { id: 1, result: "win", rolledNumber: 77, amount: 100, payout: 200 },
  { id: 2, result: "lose", rolledNumber: 13, amount: 50, payout: 0 },
];

export default function ProfilePage() {
  const user = mockUser;
  const betStats = mockBetStats;
  const recentBets = mockRecentBets;

  const profit = betStats.won - betStats.wagered;
  const winRate = betStats.total ? ((betStats.wins / betStats.total) * 100).toFixed(0) : "0";
  const label = user.displayName || user.username;

  const stats = [
    { l: "Ставок", v: betStats.total, i: "🎰", c: "#ffc542", href: "/casino" },
    { l: "Винрейт", v: `${winRate}%`, i: "📊", c: "#00e0a4", href: "/casino" },
    { l: "Плейлистов", v: 3, i: "💿", c: "#6c5ce7", href: "/playlists" },
    { l: "Треков", v: 25, i: "🎵", c: "#e84393", href: "/music" },
    { l: "Заметок", v: 5, i: "📝", c: "#00d2ff", href: "/notes" },
    { l: "Сообщений", v: 20, i: "💬", c: "#ff7043", href: "/messages" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      {/* Остальной код страницы остается без изменений */}
      {/* ... */}
    </div>
  );
}
