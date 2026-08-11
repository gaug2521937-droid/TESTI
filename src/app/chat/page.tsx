"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  createdAt: string;
}

const EMOJIS = ["👍", "🔥", "😂", "❤️", "🎉", "😎", "🤔", "🚀", "💜", "👀"];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsAuthenticated(true);
          setCurrentUser(data.user.username);
          setUsername(data.user.username);
        }
      })
      .catch(() => {});

    void fetchMessages();
    const t = setInterval(() => void fetchMessages(), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Автопрокрутка, если пользователь внизу или это первая загрузка
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || firstLoad.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: firstLoad.current ? "auto" : "smooth" });
      firstLoad.current = false;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (res.ok) setMessages(data.messages || []);
    } catch {
      /* тихо */
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const optimistic = newMessage.trim();
    setNewMessage("");
    setShowEmoji(false);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: optimistic,
          username: isAuthenticated ? undefined : username.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка отправки");
        setNewMessage(optimistic);
        return;
      }
      await fetchMessages();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setError("Не удалось отправить сообщение");
      setNewMessage(optimistic);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s: string) => {
    const d = new Date(s);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const avatarColor = (name: string) => {
    const colors = [
      "#6c5ce7", "#00e0a4", "#ff7043", "#00d2ff", "#ffc542",
      "#e84393", "#00cec9", "#ff5470", "#a29bfe", "#74b9ff",
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  const uniqueUsers = new Set(messages.map((m) => m.username)).size;

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      {/* Заголовок */}
      <div className="text-center mb-7 animate-fade-in">
        <div className="inline-flex items-center gap-2 gash-badge gash-badge-success mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e0a4] animate-pulse" />
          Автообновление каждые 4 секунды
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
          <span className="gradient-text">Чат</span>
        </h1>
        <p className="text-[#9a9aa8]">Общий чат для всех — регистрация не нужна</p>
      </div>

      {/* Имя для гостей */}
      {!isAuthenticated && (
        <div className="gash-card gash-card-static p-4 mb-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
              style={{ background: avatarColor(username || "Аноним") }}
            >
              {(username || "А")[0].toUpperCase()}
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Как вас зовут? (по умолчанию Аноним)"
              maxLength={50}
              className="gash-input !py-2.5 !text-[13.5px]"
            />
          </div>
        </div>
      )}

      {/* Чат */}
      <div className="gash-card gash-card-static mb-4 animate-fade-in overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold text-[#c8c8d8]">💬 Общий чат</span>
            <span className="gash-badge gash-badge-neutral">{messages.length} сообщ.</span>
            <span className="gash-badge gash-badge-info hidden sm:inline-flex">
              {uniqueUsers} участн.
            </span>
          </div>
          <button
            onClick={() => void fetchMessages()}
            className="text-[12px] font-bold text-[#8577f0] hover:text-[#a99bff] transition-colors"
          >
            🔄 Обновить
          </button>
        </div>

        <div
          ref={scrollRef}
          className="p-4 space-y-2.5 overflow-y-auto"
          style={{ height: "clamp(320px, 52vh, 540px)" }}
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-3 opacity-50">🤫</div>
              <p className="text-[14px] font-bold text-[#c8c8d8] mb-1">Пока тишина</p>
              <p className="text-[12.5px] text-[#6a6a7a]">Станьте первым, кто напишет!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const own =
                (isAuthenticated && msg.username === currentUser) ||
                (!isAuthenticated && msg.username === (username || "Аноним"));
              const color = avatarColor(msg.username);
              return (
                <div key={msg.id} className={`chat-message ${own ? "chat-message-own" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-extrabold flex-shrink-0"
                      style={{ background: color }}
                    >
                      {msg.username[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                        <span className="font-extrabold text-[12.5px]" style={{ color }}>
                          {msg.username}
                        </span>
                        {own && (
                          <span className="gash-badge gash-badge-info !text-[9px] !px-1.5 !py-0">
                            вы
                          </span>
                        )}
                        <span className="text-[10.5px] text-[#5a5a6a] tabular-nums">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-[13.5px] text-[#dcdce6] break-words leading-relaxed whitespace-pre-wrap">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-3">⚠️ {error}</div>}

      {/* Эмодзи */}
      {showEmoji && (
        <div className="gash-card gash-card-static p-3 mb-3 flex flex-wrap gap-1.5 animate-bounce-in">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setNewMessage((m) => m + e)}
              className="w-10 h-10 rounded-xl text-xl hover:bg-white/[0.08] hover:scale-110 transition-all"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Отправка */}
      <form onSubmit={handleSend} className="flex gap-2.5 animate-fade-in">
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          className={`w-[46px] h-[46px] rounded-xl border flex items-center justify-center text-lg flex-shrink-0 transition-all ${
            showEmoji
              ? "bg-[#6c5ce7]/20 border-[#6c5ce7]/50"
              : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]"
          }`}
        >
          😊
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Напишите сообщение…"
          maxLength={1000}
          className="gash-input flex-1"
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !newMessage.trim()} className="gash-btn !px-5">
          {loading ? (
            <span className="gash-loader !w-4 !h-4 !border-2" />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
      <p className="text-[11px] text-[#5a5a6a] mt-2.5 text-center">
        {newMessage.length}/1000 символов · будьте вежливы 💜
      </p>
    </div>
  );
}
