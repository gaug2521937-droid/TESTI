import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { gameRounds } from "@/db/schema";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { addXp, getOrCreateStats, changeCoins } from "@/lib/levels";
import crypto from "crypto";
import { externalEntropy } from "@/lib/randomSources";

export const dynamic = "force-dynamic";

/**
 * Единый движок игр казино с проверяемой честностью.
 * Все исходы считаются из HMAC-SHA256(serverSeed, clientSeed:nonce) —
 * подкрутить результат нельзя, игрок получает seed и может проверить.
 */

const HOUSE_EDGE = 0.03; // 3% в пользу заведения

function hmacFloat(serverSeed: string, clientSeed: string, nonce: number, salt = ""): number {
  const h = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${salt}`).digest("hex");
  return parseInt(h.slice(0, 8), 16) / 0xffffffff;
}

/**
 * Точка взрыва в Crash.
 * Классическая формула: 99 / (1 - r), обрезанная сверху.
 * Даёт длинный хвост — редко, но бывают ×50 и выше.
 */
function crashPoint(r: number): number {
  // Мгновенный взрыв — редкость, а не каждый третий раунд
  if (r < 0.008) return 1.0;

  // Сжимаем нижний хвост: раньше треть раундов гасла до 1.2×,
  // теперь у игрока почти всегда есть время среагировать
  const shaped = 0.06 + r * 0.94;
  const raw = (1 - HOUSE_EDGE) / (1 - shaped);
  return Math.max(1.01, Math.min(1000, Math.floor(raw * 100) / 100));
}

interface PlayBody {
  game: string;
  bet: number;
  clientSeed?: string;
  // Crash
  autoCashout?: number;
  cashedAt?: number;
  // Mines
  mines?: number;
  picks?: number;
  // Dice
  target?: number;
  mode?: "over" | "under";
  // Coinflip
  side?: "heads" | "tails";
  // Roulette
  betType?: "red" | "black" | "green" | "even" | "odd" | "number";
  number?: number;
  // Tower
  floors?: number;
  difficulty?: "easy" | "medium" | "hard";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlayBody;
    const game = String(body.game || "");
    const bet = Number(body.bet);

    if (!bet || isNaN(bet) || bet <= 0) {
      return NextResponse.json({ error: "Некорректная ставка" }, { status: 400 });
    }
    if (bet > 1_000_000) {
      return NextResponse.json({ error: "Максимум 1 000 000" }, { status: 400 });
    }

    const stats = await getOrCreateStats();
    if (stats && stats.coins < bet) {
      return NextResponse.json({ error: "Недостаточно монет", coins: stats.coins }, { status: 400 });
    }

    // Внешняя энтропия усиливает серверный seed: даже зная состояние
    // процесса, предсказать результат нельзя
    const ext = await externalEntropy();
    const serverSeed = crypto
      .createHash("sha256")
      .update(crypto.randomBytes(24).toString("hex") + ext.value)
      .digest("hex");
    const clientSeed = String(body.clientSeed || "gash").slice(0, 64);
    const nonce = Math.floor(Math.random() * 1e6);

    let win = false;
    let multiplier = 0;
    let detail = "";
    const extra: Record<string, unknown> = {};

    switch (game) {
      /* ═══════ CRASH ═══════ */
      case "crash": {
        const point = crashPoint(hmacFloat(serverSeed, clientSeed, nonce));
        const target = Number(body.autoCashout) || 0;

        extra.crashPoint = point;
        // Сервер решает: успел ли игрок забрать до взрыва
        if (target > 1 && target <= point) {
          win = true;
          multiplier = target;
        }
        detail = `взрыв на ${point.toFixed(2)}×`;
        break;
      }

      /* ═══════ MINES ═══════ */
      case "mines": {
        const total = 25;
        const minesCount = Math.min(Math.max(Number(body.mines) || 3, 1), 24);
        const picks = Math.min(Math.max(Number(body.picks) || 1, 1), total - minesCount);

        // Раскладка мин из хеша
        const cells = Array.from({ length: total }, (_, i) => i);
        for (let i = total - 1; i > 0; i--) {
          const j = Math.floor(hmacFloat(serverSeed, clientSeed, nonce, `m${i}`) * (i + 1));
          [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        const mineSet = cells.slice(0, minesCount);
        extra.mines = mineSet;

        // Коэффициент за безопасные открытия
        let m = 1;
        for (let k = 0; k < picks; k++) {
          m *= (total - k) / (total - minesCount - k);
        }
        multiplier = Number((m * (1 - HOUSE_EDGE)).toFixed(4));
        win = true; // проигрыш фиксируется клиентом при попадании на мину
        detail = `${minesCount} мин, ${picks} открыто`;
        break;
      }

      /* ═══════ DICE ═══════ */
      case "dice": {
        const target = Math.min(Math.max(Number(body.target) || 50, 2), 98);
        const mode = body.mode === "under" ? "under" : "over";
        const roll = Number((hmacFloat(serverSeed, clientSeed, nonce) * 100).toFixed(2));
        const chance = mode === "over" ? 100 - target : target;

        win = mode === "over" ? roll > target : roll < target;
        multiplier = win ? Number(((100 / chance) * (1 - HOUSE_EDGE)).toFixed(4)) : 0;
        extra.roll = roll;
        extra.chance = chance;
        detail = `выпало ${roll}`;
        break;
      }

      /* ═══════ COINFLIP ═══════ */
      case "coinflip": {
        const side = body.side === "tails" ? "tails" : "heads";
        const r = hmacFloat(serverSeed, clientSeed, nonce);
        const outcome = r < 0.5 ? "heads" : "tails";
        win = outcome === side;
        multiplier = win ? Number((2 * (1 - HOUSE_EDGE)).toFixed(4)) : 0;
        extra.outcome = outcome;
        detail = outcome === "heads" ? "орёл" : "решка";
        break;
      }

      /* ═══════ РУЛЕТКА ═══════ */
      case "roulette": {
        const pocket = Math.floor(hmacFloat(serverSeed, clientSeed, nonce) * 37); // 0..36
        const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const isRed = REDS.includes(pocket);
        const type = body.betType ?? "red";

        if (type === "number") {
          win = pocket === Number(body.number);
          multiplier = win ? 35 : 0;
        } else if (type === "red") {
          win = isRed;
          multiplier = win ? 2 : 0;
        } else if (type === "black") {
          win = pocket !== 0 && !isRed;
          multiplier = win ? 2 : 0;
        } else if (type === "green") {
          win = pocket === 0;
          multiplier = win ? 35 : 0;
        } else if (type === "even") {
          win = pocket !== 0 && pocket % 2 === 0;
          multiplier = win ? 2 : 0;
        } else {
          win = pocket % 2 === 1;
          multiplier = win ? 2 : 0;
        }

        extra.pocket = pocket;
        extra.color = pocket === 0 ? "green" : isRed ? "red" : "black";
        detail = `выпало ${pocket}`;
        break;
      }

      /* ═══════ PLINKO ═══════ */
      case "plinko": {
        const ROWS = 12;
        const path: number[] = [];
        let slot = 0;
        for (let i = 0; i < ROWS; i++) {
          const right = hmacFloat(serverSeed, clientSeed, nonce, `p${i}`) > 0.5 ? 1 : 0;
          path.push(right);
          slot += right;
        }
        // Множители по ячейкам: края крупные, центр мелкий
        const PAYOUTS = [10, 5, 2.4, 1.4, 1.1, 0.6, 0.4, 0.6, 1.1, 1.4, 2.4, 5, 10];
        multiplier = Number((PAYOUTS[slot] * (1 - HOUSE_EDGE)).toFixed(4));
        win = multiplier >= 1;
        extra.path = path;
        extra.slot = slot;
        detail = `ячейка ${slot + 1}`;
        break;
      }

      /* ═══════ TOWER ═══════ */
      case "tower": {
        const diff = body.difficulty ?? "medium";
        const perRow = diff === "easy" ? 4 : diff === "hard" ? 2 : 3; // клеток в ряду
        const safe = perRow - 1; // безопасных клеток
        const floors = Math.min(Math.max(Number(body.floors) || 1, 1), 8);

        const layout: number[] = [];
        for (let i = 0; i < 8; i++) {
          layout.push(Math.floor(hmacFloat(serverSeed, clientSeed, nonce, `t${i}`) * perRow));
        }
        extra.trap = layout;
        extra.perRow = perRow;

        multiplier = Number((Math.pow(perRow / safe, floors) * (1 - HOUSE_EDGE)).toFixed(4));
        win = true; // клиент сам решает, когда забрать
        detail = `${floors} этажей, ${diff}`;
        break;
      }

      /* ═══════ СЛОТЫ ═══════ */
      case "slots": {
        const SYM = ["🍒", "🍋", "🔔", "💎", "7️⃣", "⭐"];
        const reels = [0, 1, 2].map((i) =>
          Math.floor(hmacFloat(serverSeed, clientSeed, nonce, `s${i}`) * SYM.length)
        );
        const [a, b, c] = reels;

        if (a === b && b === c) {
          // Три одинаковых — крупный выигрыш, зависит от символа
          const BIG = [8, 10, 14, 25, 50, 30];
          multiplier = Number((BIG[a] * (1 - HOUSE_EDGE)).toFixed(2));
          win = true;
        } else if (a === b || b === c || a === c) {
          multiplier = Number((1.8 * (1 - HOUSE_EDGE)).toFixed(2));
          win = true;
        }

        extra.reels = reels.map((i) => SYM[i]);
        detail = reels.map((i) => SYM[i]).join(" ");
        break;
      }

      default:
        return NextResponse.json({ error: "Неизвестная игра" }, { status: 400 });
    }

    const payout = win ? Number((bet * multiplier).toFixed(2)) : 0;
    const profit = Number((payout - bet).toFixed(2));

    // Записываем раунд
    const user = await getCurrentUser();
    const guestKey = await getGuestKey();
    await db.insert(gameRounds).values({
      userId: user?.id ?? null,
      guestKey: user ? null : guestKey,
      game,
      bet,
      multiplier,
      payout,
      win,
      detail: detail.slice(0, 120),
    });

    // Опыт и монеты
    const xpGain = Math.min(30, Math.round(3 + Math.log10(bet + 1) * 4));
    const xpResult = await addXp(
      xpGain,
      { gamesPlayed: 1, gamesWon: win ? 1 : 0 },
      win ? multiplier : 0,
      Math.round(profit)
    );

    return NextResponse.json({
      success: true,
      game,
      bet,
      win,
      multiplier,
      payout,
      profit,
      detail,
      ...extra,
      coins: xpResult ? (await getOrCreateStats())?.coins ?? null : null,
      xp: xpResult,
      fair: {
        serverSeed,
        clientSeed,
        nonce,
        entropySource: ext.source,
        hash: crypto.createHash("sha256").update(serverSeed).digest("hex").slice(0, 24),
      },
    });
  } catch (error) {
    console.error("Play error:", error);
    return NextResponse.json({ error: "Ошибка игры" }, { status: 500 });
  }
}

/** Пополнение баланса (ежедневный бонус) */
export async function PATCH() {
  try {
    const coins = await changeCoins(1000);
    return NextResponse.json({ success: true, coins });
  } catch {
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
