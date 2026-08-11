import { NextRequest, NextResponse } from "next/server";
import { getOrCreateStats, levelInfo, ACHIEVEMENTS, addXp } from "@/lib/levels";

export const dynamic = "force-dynamic";

/** Профиль игрока: уровень, монеты, достижения */
export async function GET() {
  try {
    const stats = await getOrCreateStats();
    if (!stats) {
      return NextResponse.json({ error: "Нет профиля" }, { status: 400 });
    }

    const owned = new Set(stats.achievements.split(",").filter(Boolean));

    return NextResponse.json({
      level: levelInfo(stats.xp),
      coins: stats.coins,
      counters: {
        tracksPlayed: stats.tracksPlayed,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        bestMultiplier: stats.bestMultiplier,
        postsCreated: stats.postsCreated,
      },
      achievements: ACHIEVEMENTS.map((a) => ({
        id: a.id,
        name: a.name,
        desc: a.desc,
        icon: a.icon,
        unlocked: owned.has(a.id),
      })),
      unlockedCount: owned.size,
      totalAchievements: ACHIEVEMENTS.length,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Ошибка профиля" }, { status: 500 });
  }
}

/** Начисление опыта извне (например, за прослушивание) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reason = String(body.reason || "");

    // Фиксированные награды, чтобы нельзя было накрутить произвольно
    const REWARDS: Record<string, { xp: number; counters: Record<string, number> }> = {
      track: { xp: 2, counters: { tracksPlayed: 1 } },
      post: { xp: 15, counters: { postsCreated: 1 } },
      daily: { xp: 50, counters: {} },
    };

    const r = REWARDS[reason];
    if (!r) return NextResponse.json({ error: "Неизвестная награда" }, { status: 400 });

    const result = await addXp(r.xp, r.counters);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("XP error:", error);
    return NextResponse.json({ error: "Ошибка начисления" }, { status: 500 });
  }
}
