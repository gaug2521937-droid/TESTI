import { db } from "@/db";
import { userStats } from "@/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser, getGuestKey } from "@/lib/auth";

/**
 * Система опыта и уровней.
 * XP растёт за всё: прослушивание, игры, посты.
 * Порог уровня растёт квадратично — чем дальше, тем дольше качаться.
 */

/** Сколько всего XP нужно, чтобы достичь уровня n */
export function xpForLevel(level: number): number {
  return Math.round(60 * Math.pow(level - 1, 1.65));
}

/** Уровень по накопленному XP */
export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < 120 && xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export interface LevelInfo {
  level: number;
  xp: number;
  current: number;
  needed: number;
  progress: number;
  title: string;
  color: string;
}

const RANKS: { min: number; title: string; color: string }[] = [
  { min: 1, title: "Новичок", color: "#8a8a99" },
  { min: 5, title: "Слушатель", color: "#00d2ff" },
  { min: 10, title: "Меломан", color: "#6c5ce7" },
  { min: 18, title: "Знаток", color: "#a29bfe" },
  { min: 28, title: "Ветеран", color: "#00e0a4" },
  { min: 40, title: "Мастер", color: "#ffc542" },
  { min: 55, title: "Легенда", color: "#ff7043" },
  { min: 75, title: "Босс", color: "#e84393" },
  { min: 100, title: "Бог GASH", color: "#ff5470" },
];

export function rankFor(level: number) {
  return [...RANKS].reverse().find((r) => level >= r.min) ?? RANKS[0];
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = xp - base;
  const needed = Math.max(1, next - base);
  const rank = rankFor(level);
  return {
    level,
    xp,
    current,
    needed,
    progress: Math.min(100, (current / needed) * 100),
    title: rank.title,
    color: rank.color,
  };
}

/** Достижения — выдаются автоматически по счётчикам */
export const ACHIEVEMENTS: {
  id: string;
  name: string;
  desc: string;
  icon: string;
  check: (s: StatsRow) => boolean;
}[] = [
  { id: "first_track", name: "Первый трек", desc: "Послушать первую песню", icon: "🎧", check: (s) => s.tracksPlayed >= 1 },
  { id: "music_50", name: "Меломан", desc: "50 прослушиваний", icon: "🎵", check: (s) => s.tracksPlayed >= 50 },
  { id: "music_250", name: "Аудиофил", desc: "250 прослушиваний", icon: "🎼", check: (s) => s.tracksPlayed >= 250 },
  { id: "first_bet", name: "Новичок удачи", desc: "Первая ставка", icon: "🎲", check: (s) => s.gamesPlayed >= 1 },
  { id: "games_50", name: "Азартный", desc: "50 игр", icon: "🎰", check: (s) => s.gamesPlayed >= 50 },
  { id: "win_10", name: "Везунчик", desc: "10 побед", icon: "🍀", check: (s) => s.gamesWon >= 10 },
  { id: "multi_5", name: "Рисковый", desc: "Множитель ×5", icon: "🚀", check: (s) => s.bestMultiplier >= 5 },
  { id: "multi_20", name: "Космос", desc: "Множитель ×20", icon: "🌌", check: (s) => s.bestMultiplier >= 20 },
  { id: "first_post", name: "Автор", desc: "Первый пост", icon: "✍️", check: (s) => s.postsCreated >= 1 },
  { id: "posts_10", name: "Блогер", desc: "10 постов", icon: "📮", check: (s) => s.postsCreated >= 10 },
  { id: "level_10", name: "Десятка", desc: "Достичь 10 уровня", icon: "⭐", check: (s) => s.level >= 10 },
  { id: "level_25", name: "Опытный", desc: "Достичь 25 уровня", icon: "🌟", check: (s) => s.level >= 25 },
];

export interface StatsRow {
  id: number;
  xp: number;
  level: number;
  coins: number;
  tracksPlayed: number;
  gamesPlayed: number;
  gamesWon: number;
  bestMultiplier: number;
  postsCreated: number;
  achievements: string;
  preferredArtists: string;
  onboarded: boolean;
}

/** Находим или создаём запись статистики текущего пользователя */
export async function getOrCreateStats(): Promise<StatsRow | null> {
  const user = await getCurrentUser();
  const guestKey = await getGuestKey();
  if (!user && !guestKey) return null;

  const where = user
    ? eq(userStats.userId, user.id)
    : and(eq(userStats.guestKey, guestKey), isNull(userStats.userId));

  const [existing] = await db.select().from(userStats).where(where).limit(1);
  if (existing) return existing as StatsRow;

  const [created] = await db
    .insert(userStats)
    .values({ userId: user?.id ?? null, guestKey: user ? null : guestKey })
    .returning();

  return created as StatsRow;
}

export interface XpResult {
  gained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  newAchievements: typeof ACHIEVEMENTS;
  info: LevelInfo;
}

/** Начислить опыт и обновить счётчики */
export async function addXp(
  amount: number,
  counters: Partial<Pick<StatsRow, "tracksPlayed" | "gamesPlayed" | "gamesWon" | "postsCreated">> = {},
  bestMultiplier?: number,
  coinsDelta = 0
): Promise<XpResult | null> {
  const stats = await getOrCreateStats();
  if (!stats) return null;

  const prevLevel = levelFromXp(stats.xp);
  const newXp = Math.max(0, stats.xp + amount);
  const newLevel = levelFromXp(newXp);

  const next: StatsRow = {
    ...stats,
    xp: newXp,
    level: newLevel,
    coins: Math.max(0, stats.coins + coinsDelta),
    tracksPlayed: stats.tracksPlayed + (counters.tracksPlayed ?? 0),
    gamesPlayed: stats.gamesPlayed + (counters.gamesPlayed ?? 0),
    gamesWon: stats.gamesWon + (counters.gamesWon ?? 0),
    postsCreated: stats.postsCreated + (counters.postsCreated ?? 0),
    bestMultiplier: Math.max(stats.bestMultiplier, bestMultiplier ?? 0),
  };

  // Проверяем новые достижения
  const had = new Set(stats.achievements.split(",").filter(Boolean));
  const unlocked = ACHIEVEMENTS.filter((a) => !had.has(a.id) && a.check(next));
  for (const a of unlocked) had.add(a.id);

  await db
    .update(userStats)
    .set({
      xp: next.xp,
      level: next.level,
      coins: next.coins,
      tracksPlayed: next.tracksPlayed,
      gamesPlayed: next.gamesPlayed,
      gamesWon: next.gamesWon,
      postsCreated: next.postsCreated,
      bestMultiplier: next.bestMultiplier,
      achievements: Array.from(had).join(","),
      updatedAt: new Date(),
    })
    .where(eq(userStats.id, stats.id));

  return {
    gained: amount,
    xp: next.xp,
    level: next.level,
    leveledUp: newLevel > prevLevel,
    newAchievements: unlocked,
    info: levelInfo(next.xp),
  };
}

/** Изменить баланс монет отдельно от XP */
export async function changeCoins(delta: number): Promise<number | null> {
  const stats = await getOrCreateStats();
  if (!stats) return null;
  const coins = Math.max(0, stats.coins + delta);
  await db.update(userStats).set({ coins, updatedAt: new Date() }).where(eq(userStats.id, stats.id));
  return coins;
}

export { sql };
