/**
 * Внешние источники случайности для казино.
 *
 * Основной алгоритм остаётся provably fair (HMAC-SHA256 от серверного
 * и клиентского seed). Внешние сервисы добавляют дополнительную
 * энтропию в серверный seed — так результат нельзя предсказать,
 * даже зная состояние процесса.
 */

/** random.org — атмосферный шум, признанный источник истинной случайности */
export async function randomOrg(min = 0, max = 999999): Promise<number | null> {
  try {
    const r = await fetch(
      `https://www.random.org/integers/?num=1&min=${min}&max=${max}&col=1&base=10&format=plain&rnd=new`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const v = Number((await r.text()).trim());
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** csrng.net — криптографически стойкий генератор */
export async function csrng(min = 0, max = 999999): Promise<number | null> {
  try {
    const r = await fetch(`https://csrng.net/csrng/csrng.php?min=${min}&max=${max}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as Array<{ random?: number; status?: string }>;
    const v = d?.[0]?.random;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Собирает внешнюю энтропию из доступных источников.
 * Если оба недоступны — возвращает пустую строку, и игра
 * работает на локальном криптографическом генераторе.
 */
export async function externalEntropy(): Promise<{ value: string; source: string }> {
  const [org, cs] = await Promise.all([randomOrg(), csrng()]);

  const parts: string[] = [];
  const names: string[] = [];

  if (org !== null) { parts.push(String(org)); names.push("random.org"); }
  if (cs !== null) { parts.push(String(cs)); names.push("csrng.net"); }

  return {
    value: parts.join(":"),
    source: names.length > 0 ? names.join(" + ") : "local",
  };
}

/* ═══════════ Колода карт ═══════════ */

export interface Card {
  code: string;
  value: string;
  suit: string;
  image: string;
}

/** Новая перемешанная колода через deckofcardsapi */
export async function newDeck(decks = 1): Promise<string | null> {
  try {
    const r = await fetch(`https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=${decks}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { deck_id?: string; success?: boolean };
    return d.success && d.deck_id ? d.deck_id : null;
  } catch {
    return null;
  }
}

/** Раздать карты из колоды */
export async function drawCards(deckId: string, count: number): Promise<Card[]> {
  try {
    const r = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=${count}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      cards?: Array<{ code: string; value: string; suit: string; image: string }>;
    };
    return (d.cards ?? []).map((c) => ({
      code: c.code,
      value: c.value,
      suit: c.suit,
      image: c.image,
    }));
  } catch {
    return [];
  }
}

/** Очки карты в блэкджеке */
export function cardPoints(value: string): number {
  if (value === "ACE") return 11;
  if (["KING", "QUEEN", "JACK"].includes(value)) return 10;
  return Number(value) || 0;
}

/** Сумма руки с учётом тузов */
export function handTotal(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + cardPoints(c.value), 0);
  let aces = cards.filter((c) => c.value === "ACE").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
