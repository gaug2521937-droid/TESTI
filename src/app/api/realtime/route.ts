import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { subscribe, touch, type RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * SSE-поток реального времени.
 * Клиент открывает EventSource('/api/realtime') и мгновенно получает
 * новые сообщения без опроса сервера.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Требуется авторизация", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* поток закрыт */
        }
      };

      // Приветственное событие — фронтенд понимает, что связь установлена
      send({ type: "presence", userId: user.id, online: true });

      unsubscribe = subscribe(user.id, send);

      // Пинг каждые 20 сек, чтобы прокси не рвал соединение
      heartbeat = setInterval(() => {
        touch(user.id);
        send({ type: "ping" });
      }, 20000);

      // Закрытие при отключении клиента
      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          /* уже закрыт */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
