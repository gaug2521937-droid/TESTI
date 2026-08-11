import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { casinoHistory } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Провably fair: результат считается из серверного seed + клиентского seed + nonce.
 * Игрок получает хеш серверного seed ДО броска и сам seed после — можно проверить,
 * что число не подкручивали.
 */
function rollNumber(serverSeed: string, clientSeed: string, nonce: number) {
  const hmac = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest("hex");
  // Первые 8 hex-символов → число 0..1
  const int = parseInt(hmac.slice(0, 8), 16);
  return { value: (int / 0xffffffff) * 100, hash: hmac };
}

/** Режимы игры с разными шансами и выплатами (RTP ≈ 97%) */
const MODES = {
  // Больше порога — выигрыш
  over: (roll: number, target: number) => roll > target,
  under: (roll: number, target: number) => roll < target,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    const mode = (String(body.mode || "over") as keyof typeof MODES) in MODES ? (String(body.mode) as keyof typeof MODES) : "over";
    const target = Math.min(Math.max(Number(body.target) || 50, 2), 98);
    const clientSeed = String(body.clientSeed || "gash").slice(0, 64);

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Введите корректную ставку" }, { status: 400 });
    }
    if (amount > 1_000_000) {
      return NextResponse.json({ error: "Максимальная ставка — 1 000 000" }, { status: 400 });
    }

    // Шанс выигрыша и коэффициент
    const winChance = mode === "over" ? 100 - target : target;
    if (winChance < 1 || winChance > 98) {
      return NextResponse.json({ error: "Некорректный порог" }, { status: 400 });
    }
    const HOUSE_EDGE = 0.03; // 3% в пользу заведения — как в реальных играх
    const multiplier = Number(((100 / winChance) * (1 - HOUSE_EDGE)).toFixed(4));

    const serverSeed = crypto.randomBytes(24).toString("hex");
    const nonce = Date.now() % 100000;
    const { value, hash } = rollNumber(serverSeed, clientSeed, nonce);
    const rolled = Number(value.toFixed(2));

    const isWin = MODES[mode](rolled, target);
    const payout = isWin ? Number((amount * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - amount).toFixed(2));

    const user = await getCurrentUser();

    const [entry] = await db
      .insert(casinoHistory)
      .values({
        userId: user?.id ?? null,
        amount,
        result: isWin ? "win" : "lose",
        multiplier: isWin ? multiplier : 0,
        rolledNumber: Math.round(rolled),
        payout,
      })
      .returning();

    return NextResponse.json({
      success: true,
      id: entry.id,
      amount,
      mode,
      target,
      rolled,
      winChance: Number(winChance.toFixed(2)),
      multiplier,
      result: isWin ? "win" : "lose",
      payout,
      profit,
      fair: {
        serverSeedHash: crypto.createHash("sha256").update(serverSeed).digest("hex").slice(0, 32),
        serverSeed,
        clientSeed,
        nonce,
        resultHash: hash.slice(0, 16),
      },
      message: isWin
        ? `Выпало ${rolled} — выигрыш ×${multiplier.toFixed(2)}`
        : `Выпало ${rolled} — не повезло`,
    });
  } catch (error) {
    console.error("Casino error:", error);
    return NextResponse.json({ error: "Ошибка обработки ставки" }, { status: 500 });
  }
}
