"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Peer {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  online?: boolean;
  lastSeenAt?: string;
}

interface Conversation extends Peer {
  lastText: string;
  lastAt: string;
  lastSenderId: number;
  unread: number;
}

interface DM {
  id: number;
  senderId: number;
  recipientId: number;
  text: string;
  createdAt: string;
  readAt: string | null;
}

function avatarColor(name: string) {
  const c = ["#6c5ce7", "#00e0a4", "#ff7043", "#00d2ff", "#ffc542", "#e84393", "#00cec9", "#ff5470"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

function timeStr(s: string) {
  const d = new Date(s);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function Avatar({ user, size = 44 }: { user: Peer; size?: number }) {
  const label = user.displayName || user.username;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-extrabold w-full h-full"
          style={{ background: avatarColor(label), fontSize: size * 0.38 }}
        >
          {label[0]?.toUpperCase()}
        </div>
      )}
      {user.online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[#15151c] bg-[#00e0a4]"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export default function MessagesPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [meId, setMeId] = useState(0);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [thread, setThread] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Peer[]>([]);
  const [error, setError] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingFrom, setTypingFrom] = useState<{ id: number; name: string } | null>(null);
  
  const endRef = useRef<HTMLDivElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  const loadConvs = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const d = await res.json();
      if (res.ok) {
        setAuthed(true);
        setConvs(d.conversations || []);
        setMeId(d.meId);
      }
    } catch {
      /* тихо */
    }
  }, []);

  const loadThread = useCallback(async (userId: number) => {
    try {
      const res = await fetch(`/api/messages?with=${userId}`);
      const d = await res.json();
      if (res.ok) {
        setThread(d.messages || []);
        setPeer(d.peer);
        setMeId(d.meId);
      }
    } catch {
      /* тихо */
    }
  }, []);

  useEffect(() => {
    void loadConvs();
  }, [loadConvs]);

  /* ---------- SSE: real-time ---------- */
  useEffect(() => {
    if (authed !== true) return;

    const es = new EventSource("/api/realtime");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);

        if (ev.type === "dm") {
          const m: DM = ev.message;
          const active = peerRef.current;
          // Сообщение в открытом диалоге — дописываем мгновенно
          if (active && (m.senderId === active.id || m.recipientId === active.id)) {
            setThread((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            setTypingFrom(null);
            if (m.senderId === active.id) void fetch(`/api/messages?with=${active.id}`);
          }
          void loadConvs();
        }

        if (ev.type === "read") {
          setThread((prev) =>
            prev.map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() }))
          );
        }

        if (ev.type === "typing") {
          const active = peerRef.current;
          if (active && ev.fromUserId === active.id) {
            setTypingFrom({ id: ev.fromUserId, name: ev.fromName });
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setTypingFrom(null), 3200);
          }
        }

        if (ev.type === "tg_linked") void loadConvs();
      } catch {
        /* игнорируем */
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [authed, loadConvs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, typingFrom]);

  // Поиск пользователей
  useEffect(() => {
    if (authed !== true) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/messages?search=${encodeURIComponent(search)}`);
        const d = await res.json();
        if (res.ok) setFound(d.users || []);
      } catch {
        /* тихо */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, authed]);

  const openChat = async (u: Peer) => {
    setPeer(u);
    setMobileThread(true);
    setThread([]);
    setTypingFrom(null);
    await loadThread(u.id);
    await loadConvs();
  };

  const onType = (v: string) => {
    setText(v);
    if (!peer) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 2200) {
      lastTypingSent.current = now;
      void fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "typing", recipientId: peer.id }),
      });
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !peer) return;
    const body = text.trim();
    setText("");
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: peer.id, text: body }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Ошибка отправки");
        setText(body);
        return;
      }
      setThread((prev) => (prev.some((x) => x.id === d.message.id) ? prev : [...prev, d.message]));
      void loadConvs();
    } catch {
      setError("Не удалось отправить");
      setText(body);
    } finally {
      setSending(false);
    }
  };

  if (authed === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="gash-card gash-card-static gash-card-glow p-10 animate-rise">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-extrabold text-white mb-2">Нужен аккаунт</h1>
          <p className="text-[13.5px] text-[#8a8a99] mb-6 leading-relaxed">
            Личные сообщения доступны после входа. Быстрее всего — по номеру телефона.
          </p>
          <Link href="/login" className="gash-btn no-underline">
            📱 Войти по телефону
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="page-head animate-fade-in">
        <div
          className={`inline-flex items-center gap-2 gash-badge mb-4 ${
            connected ? "gash-badge-success" : "gash-badge-warning"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00e0a4] animate-pulse" : "bg-[#ffc542]"}`}
          />
          {connected ? "Real-time подключено" : "Подключение…"}
        </div>
        <h1>
          <span className="gradient-text">Сообщения</span>
        </h1>
        <p className="text-[#9a9aa8] text-[14px]">
          Мгновенная доставка · печатает-индикатор · статусы прочтения
        </p>
      </div>

      <div className="gash-card gash-card-static overflow-hidden animate-rise">
        <div
          className="grid grid-cols-1 md:grid-cols-[310px,1fr]"
          style={{ height: "clamp(480px, 68vh, 700px)" }}
        >
          {/* Список */}
          <div className={`border-r border-white/[0.07] flex-col ${mobileThread ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-white/[0.07]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Найти собеседника…"
                className="gash-input !py-2.5 !text-[13px]"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {convs.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] px-4 pt-3 pb-1.5">
                    Диалоги
                  </p>
                  {convs.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => void openChat(c)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                        peer?.id === c.id ? "bg-[#6c5ce7]/15" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <Avatar user={c} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13.5px] font-bold text-[#e8e8f0] truncate flex items-center gap-1.5">
                            {c.displayName || c.username}
                          </p>
                          <span className="text-[10px] text-[#6a6a7a] flex-shrink-0">
                            {timeStr(c.lastAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] text-[#7a7a8a] truncate">
                            {c.lastSenderId === meId && "Вы: "}
                            {c.lastText}
                          </p>
                          {c.unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#6c5ce7] text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              <p className="text-[10px] uppercase tracking-wider font-bold text-[#6a6a7a] px-4 pt-3 pb-1.5">
                {search ? "Найдено" : "Все пользователи"}
              </p>
              {found.length === 0 ? (
                <p className="text-[12px] text-[#6a6a7a] px-4 py-4 text-center">Никого не найдено</p>
              ) : (
                found.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => void openChat(u)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      peer?.id === u.id ? "bg-[#6c5ce7]/15" : "hover:bg-white/[0.05]"
                    }`}
                  >
                    <Avatar user={u} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#dcdce6] truncate flex items-center gap-1.5">
                        {u.displayName || u.username}
                      </p>
                      <p className="text-[11px] text-[#6a6a7a] truncate">
                        {u.online ? (
                          <span className="text-[#00e0a4]">в сети</span>
                        ) : (
                          `@${u.username}`
                        )}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Переписка */}
          <div className={`flex-col ${mobileThread ? "flex" : "hidden md:flex"}`}>
            {!peer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="text-5xl mb-4 opacity-50">✈️</div>
                <p className="text-[15px] font-bold text-[#c8c8d8] mb-1">Выберите собеседника</p>
                <p className="text-[13px] text-[#6a6a7a]">Сообщения приходят мгновенно</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-3 bg-white/[0.02]">
                  <button onClick={() => setMobileThread(false)} className="icon-btn md:hidden flex-shrink-0">
                    ←
                  </button>
                  <Avatar user={peer} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold text-white truncate flex items-center gap-1.5">
                      {peer.displayName || peer.username}
                    </p>
                    <p className="text-[11.5px] truncate">
                      {typingFrom ? (
                        <span className="text-[#a99bff]">печатает…</span>
                      ) : peer.online ? (
                        <span className="text-[#00e0a4]">в сети</span>
                      ) : (
                        <span className="text-[#7a7a8a]">@{peer.username}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {thread.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="text-4xl mb-3 opacity-50">👋</div>
                      <p className="text-[13.5px] text-[#8a8a99]">Напишите первым</p>
                    </div>
                  ) : (
                    thread.map((m) => {
                      const own = m.senderId === meId;
                      return (
                        <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"} animate-fade-in`}>
                          <div
                            className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl ${
                              own
                                ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white rounded-br-md"
                                : "bg-white/[0.07] text-[#e0e0e0] border border-white/[0.07] rounded-bl-md"
                            }`}
                          >
                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                              {m.text}
                            </p>
                            <div
                              className={`flex items-center gap-1.5 justify-end mt-1 text-[10px] ${
                                own ? "text-white/65" : "text-[#6a6a7a]"
                              }`}
                            >
                              {new Date(m.createdAt).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {own && <span>{m.readAt ? "✓✓" : "✓"}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {typingFrom && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.07] border border-white/[0.07]">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-[#a99bff]"
                              style={{ animation: `float 1s ease-in-out ${i * 0.15}s infinite` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {error && (
                  <div className="px-4 pb-2">
                    <div className="gash-alert gash-alert-danger !py-2 !text-[12.5px]">⚠️ {error}</div>
                  </div>
                )}

                <form onSubmit={send} className="p-3 border-t border-white/[0.07] flex gap-2.5">
                  <input
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    placeholder="Сообщение…"
                    maxLength={2000}
                    className="gash-input flex-1 !py-2.5"
                    autoComplete="off"
                  />
                  <button type="submit" disabled={sending || !text.trim()} className="gash-btn !px-4 !py-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
