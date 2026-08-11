/**
 * Простая шина событий в памяти процесса для real-time доставки через SSE.
 * Каждый подключённый пользователь держит открытый поток, а сервер
 * пушит в него события (новое сообщение, привязка Telegram, набор текста).
 */

export type RealtimeEvent =
  | { type: "dm"; message: unknown }
  | { type: "read"; byUserId: number }
  | { type: "typing"; fromUserId: number; fromName: string }
  | { type: "presence"; userId: number; online: boolean }
  | { type: "ping" };

type Listener = (event: RealtimeEvent) => void;

const globalForRt = globalThis as typeof globalThis & {
  __gashRealtime?: Map<number, Set<Listener>>;
  __gashPresence?: Map<number, number>;
};

// Слушатели по userId (у пользователя может быть несколько вкладок)
const listeners: Map<number, Set<Listener>> =
  globalForRt.__gashRealtime ?? new Map<number, Set<Listener>>();
globalForRt.__gashRealtime = listeners;

// Последняя активность: userId → timestamp
const presence: Map<number, number> =
  globalForRt.__gashPresence ?? new Map<number, number>();
globalForRt.__gashPresence = presence;

const ONLINE_WINDOW_MS = 45 * 1000;

/** Подписаться на события пользователя. Возвращает функцию отписки. */
export function subscribe(userId: number, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);
  touch(userId);

  return () => {
    const s = listeners.get(userId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(userId);
  };
}

/** Отправить событие конкретному пользователю */
export function publish(userId: number, event: RealtimeEvent): void {
  const set = listeners.get(userId);
  if (!set) return;
  for (const l of set) {
    try {
      l(event);
    } catch {
      /* игнорируем сломанный поток */
    }
  }
}

/** Отправить событие нескольким пользователям */
export function publishMany(userIds: number[], event: RealtimeEvent): void {
  for (const id of new Set(userIds)) publish(id, event);
}

/** Отметить активность пользователя */
export function touch(userId: number): void {
  presence.set(userId, Date.now());
}

/** Онлайн ли пользователь */
export function isOnline(userId: number): boolean {
  const last = presence.get(userId);
  if (!last) return false;
  return Date.now() - last < ONLINE_WINDOW_MS;
}

/** Список онлайн-пользователей из переданного набора */
export function filterOnline(userIds: number[]): number[] {
  return userIds.filter(isOnline);
}

/** Сколько вкладок подключено */
export function connectionCount(): number {
  let n = 0;
  for (const s of listeners.values()) n += s.size;
  return n;
}
