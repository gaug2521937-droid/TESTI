import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { gameRounds } from "@/db/schema";
import { getCurrentUser, getGuestKey } from "@/lib/auth";
import { addXp, getOrCreateStats } from "@/lib/levels";
import { newDeck, drawCards, handTotal, type Card } from "@/lib/randomSources";

export const dynamic = "force-dynamic";

/**
 * Блэкджек на настоящей колоде из deckofcardsapi.
 * Состояние партии хранится в памяти процесса и живёт 15 минут.
 */

interface Hand {
  deckId: string;
  bet: number;
  player: Card[];
  dealer: Card[];
  finished: boolean;
  createdAt: number;
}

const globalForBj = globalThis as typeof globalThis & { __bjTables?: Map<string, Hand> };
const tables: Map<string, Hand> = globalForBj.__bjTables ?? new Map();
globalForBj.__bjTables = tables;

const TTL = 15 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [k, v] of tables) if (now - v.createdAt > TTL) tables.delete(k);
}

async function ownerKey() {
  const user = await getCurrentUser();
  const guest = await getGuestKey();
  return user ? `u${user.id}` : `g${guest}`;
}

/** Записываем итог партии и начисляем опыт */
async function finish(hand: Hand, win: boolean, mult: number, detail: string) {
  const user = await getCurrentUser();
  const guestKey = await getGuestKey();
  const payout = win ? Number((hand.bet * mult).toFixed(2)) : 0;

  await db.insert(gameRounds).values({
    userId: user?.id ?? null,
    guestKey: user ? null : guestKey,
    game: "blackjack",
    bet: hand.bet,
    multiplier: win ? mult : 0,
    payout,
    win,
    detail: detail.slice(0, 120),
  });

  const xp = await addXp(
    12,
    { gamesPlayed: 1, gamesWon: win ? 1 : 0 },
    win ? mult : 0,
    Math.round(payout - hand.bet)
  );

  const stats = await getOrCreateStats();
  return { payout, xp, coins: stats?.coins ?? null };
}

export async function POST(request: NextRequest) {
  try {
    cleanup();
    const body = await request.json();
    const action = String(body.action || "");
    const key = await ownerKey();

    /* ─────── Новая партия ─────── */
    if (action === "deal") {
      const bet = Number(body.bet);
      if (!bet || bet <= 0) return NextResponse.json({ error: "Некорректная ставка" }, { status: 400 });

      const stats = await getOrCreateStats();
      if (stats && stats.coins < bet) {
        return NextResponse.json({ error: "Недостаточно монет", coins: stats.coins }, { status: 400 });
      }

      const deckId = await newDeck(6);
      if (!deckId) {
        return NextResponse.json({ error: "Карточный сервис недоступен, попробуйте позже" }, { status: 502 });
      }

      const cards = await drawCards(deckId, 4);
      if (cards.length < 4) {
        return NextResponse.json({ error: "Не удалось раздать карты" }, { status: 502 });
      }

      const hand: Hand = {
        deckId,
        bet,
        player: [cards[0], cards[2]],
        dealer: [cards[1], cards[3]],
        finished: false,
        createdAt: Date.now(),
      };
      tables.set(key, hand);

      const pt = handTotal(hand.player);
      const dt = handTotal(hand.dealer);

      // Блэкджек сразу
      if (pt === 21) {
        hand.finished = true;
        const push = dt === 21;
        const res = await finish(hand, !push, push ? 1 : 2.5, push ? "ничья" : "блэкджек");
        return NextResponse.json({
          state: "finished",
          player: hand.player,
          dealer: hand.dealer,
          playerTotal: pt,
          dealerTotal: dt,
          outcome: push ? "push" : "blackjack",
          message: push ? "Ничья — у обоих 21" : "Блэкджек! Выплата ×2.5",
          ...res,
        });
      }

      return NextResponse.json({
        state: "playing",
        player: hand.player,
        // Вторая карта дилера скрыта
        dealer: [hand.dealer[0]],
        playerTotal: pt,
        dealerTotal: handTotal([hand.dealer[0]]),
        canDouble: true,
      });
    }

    const hand = tables.get(key);
    if (!hand || hand.finished) {
      return NextResponse.json({ error: "Партия не найдена — раздайте заново" }, { status: 400 });
    }

    /* ─────── Взять карту ─────── */
    if (action === "hit") {
      const [card] = await drawCards(hand.deckId, 1);
      if (!card) return NextResponse.json({ error: "Колода закончилась" }, { status: 502 });

      hand.player.push(card);
      const pt = handTotal(hand.player);

      if (pt > 21) {
        hand.finished = true;
        const res = await finish(hand, false, 0, `перебор ${pt}`);
        tables.delete(key);
        return NextResponse.json({
          state: "finished",
          player: hand.player,
          dealer: hand.dealer,
          playerTotal: pt,
          dealerTotal: handTotal(hand.dealer),
          outcome: "bust",
          message: `Перебор — ${pt} очков`,
          ...res,
        });
      }

      return NextResponse.json({
        state: "playing",
        player: hand.player,
        dealer: [hand.dealer[0]],
        playerTotal: pt,
        dealerTotal: handTotal([hand.dealer[0]]),
        canDouble: false,
      });
    }

    /* ─────── Хватит / Удвоить ─────── */
    if (action === "stand" || action === "double") {
      if (action === "double") {
        const stats = await getOrCreateStats();
        if (stats && stats.coins < hand.bet * 2) {
          return NextResponse.json({ error: "Не хватает монет на удвоение" }, { status: 400 });
        }
        hand.bet *= 2;
        const [card] = await drawCards(hand.deckId, 1);
        if (card) hand.player.push(card);
      }

      let pt = handTotal(hand.player);

      if (pt > 21) {
        hand.finished = true;
        const res = await finish(hand, false, 0, `перебор ${pt}`);
        tables.delete(key);
        return NextResponse.json({
          state: "finished",
          player: hand.player,
          dealer: hand.dealer,
          playerTotal: pt,
          dealerTotal: handTotal(hand.dealer),
          outcome: "bust",
          message: `Перебор — ${pt} очков`,
          ...res,
        });
      }

      // Дилер добирает до 17
      while (handTotal(hand.dealer) < 17) {
        const [card] = await drawCards(hand.deckId, 1);
        if (!card) break;
        hand.dealer.push(card);
      }

      const dt = handTotal(hand.dealer);
      pt = handTotal(hand.player);
      hand.finished = true;

      let outcome: string;
      let win = false;
      let mult = 0;
      let message: string;

      if (dt > 21) {
        outcome = "dealer_bust"; win = true; mult = 2;
        message = `У дилера перебор — ${dt}`;
      } else if (pt > dt) {
        outcome = "win"; win = true; mult = 2;
        message = `Победа — ${pt} против ${dt}`;
      } else if (pt === dt) {
        outcome = "push"; win = true; mult = 1;
        message = `Ничья — по ${pt}`;
      } else {
        outcome = "lose";
        message = `Проигрыш — ${pt} против ${dt}`;
      }

      const res = await finish(hand, win, mult, outcome);
      tables.delete(key);

      return NextResponse.json({
        state: "finished",
        player: hand.player,
        dealer: hand.dealer,
        playerTotal: pt,
        dealerTotal: dt,
        outcome,
        message,
        ...res,
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Blackjack error:", error);
    return NextResponse.json({ error: "Ошибка игры" }, { status: 500 });
  }
}
