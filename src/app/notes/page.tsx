"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Post {
  id: number;
  userId: number | null;
  author: string;
  avatarUrl: string | null;
  title: string | null;
  text: string | null;
  filePath: string | null;
  fileType: string | null;
  isPublic: boolean;
  pinned: boolean;
  tags: string | null;
  likes: number;
  liked: boolean;
  isMine: boolean;
  createdAt: string;
}

function color(n: string) {
  const c = ["#6c5ce7", "#00e0a4", "#ff7043", "#00d2ff", "#ffc542", "#e84393"];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  if (s < 604800) return `${Math.floor(s / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function NotesPage() {
  const [feed, setFeed] = useState<"my" | "public">("my");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAuth, setIsAuth] = useState(false);

  // Редактор
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/notes?feed=${feed}&q=${encodeURIComponent(search)}`);
      const d = await r.json();
      if (r.ok) {
        setPosts(d.posts || []);
        setIsAuth(d.isAuthenticated);
      }
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, [feed, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const u = URL.createObjectURL(file);
      setPreview(u);
      return () => URL.revokeObjectURL(u);
    }
    setPreview(null);
  }, [file]);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !text.trim() && !file) return;
    setBusy(true);
    setError("");
    setOk("");

    const fd = new FormData();
    if (title.trim()) fd.append("title", title.trim());
    if (text.trim()) fd.append("text", text.trim());
    if (tags.trim()) fd.append("tags", tags.trim());
    if (authorName.trim()) fd.append("authorName", authorName.trim());
    fd.append("isPublic", String(isPublic));
    if (file) fd.append("file", file);

    try {
      const r = await fetch("/api/notes", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Не удалось опубликовать");
        return;
      }
      setOk(isPublic ? "Опубликовано в ленте!" : "Пост сохранён");
      setTitle(""); setText(""); setTags(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      void load();
      setTimeout(() => setOk(""), 2600);
    } catch {
      setError("Ошибка публикации");
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: number, action: string) => {
    // Оптимистичный лайк
    if (action === "like") {
      setPosts((p) =>
        p.map((x) =>
          x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x
        )
      );
    }
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (action !== "like") void load();
    } catch {
      void load();
    }
  };

  const del = async (id: number) => {
    setPosts((p) => p.filter((x) => x.id !== id));
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
    } catch {
      void load();
    }
  };

  const size = (s: number) =>
    s > 1048576 ? (s / 1048576).toFixed(1) + " МБ" : (s / 1024).toFixed(0) + " КБ";

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      {/* Заголовок */}
      <div className="page-head animate-fade-in">
        <div className="status-pill">
          📮 Посты · фото · аудио · видео
        </div>
        <h1>
          <span className="gradient-text">Мои посты</span>
        </h1>
        <p className="text-[#9a9aa8] text-[14px]">
          Пишите заметки как посты — оставляйте себе или публикуйте в общей ленте
        </p>
      </div>

      {ok && <div className="gash-alert gash-alert-success mb-4">✅ {ok}</div>}

      {/* Переключатель ленты */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="tab-bar grid-cols-2 flex-1 min-w-[200px]">
          {([
            { k: "my", l: "Мои", i: "📝" },
            { k: "public", l: "Общая лента", i: "🌐" },
          ] as const).map((x) => (
            <button
              key={x.k}
              onClick={() => setFeed(x.k)}
              className={`tab-item ${feed === x.k ? "on" : ""}`}
            >
              <span>{x.i}</span> {x.l}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen((o) => !o)} className="gash-btn !py-3">
          {open ? "Свернуть" : "✍️ Новый пост"}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Поиск по постам…"
        className="gash-input !py-2.5 !text-[13px] mb-5"
      />

      {/* Редактор */}
      {open && (
        <form onSubmit={publish} className="gash-card gash-card-static gash-card-glow p-5 mb-6 animate-bounce-in">
          {error && <div className="gash-alert gash-alert-danger mb-4 !text-[13px]">⚠️ {error}</div>}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок поста"
            maxLength={200}
            className="gash-input mb-3 !text-[16px] !font-bold"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="О чём хотите рассказать?…"
            className="gash-textarea mb-3"
            rows={5}
          />
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Теги через запятую"
              maxLength={200}
              className="gash-input !py-2.5 !text-[13px]"
            />
            {!isAuth && (
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ваше имя"
                maxLength={120}
                className="gash-input !py-2.5 !text-[13px]"
              />
            )}
          </div>

          <div
            className={`file-upload-area mb-3 ${drag ? "dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-3 text-left">
                {preview ? (
                  <img src={preview} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <span className="w-14 h-14 rounded-xl bg-[#6c5ce7]/15 flex items-center justify-center text-2xl flex-shrink-0">
                    {file.type.startsWith("audio/") ? "🎤" : file.type.startsWith("video/") ? "🎬" : "📄"}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#e0e0e0] truncate">{file.name}</p>
                  <p className="text-[11px] text-[#6a6a7a]">{size(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="icon-btn hover:!text-[#ff5470]"
                >✕</button>
              </div>
            ) : (
              <>
                <div className="text-2xl mb-1.5 opacity-70">📎</div>
                <p className="text-[13px] font-semibold text-[#a0a0b0]">Фото, аудио или видео</p>
                <p className="text-[11px] text-[#5a5a6a] mt-0.5">до 10 МБ · перетащите или нажмите</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*,audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all ${
                isPublic
                  ? "bg-[#00e0a4]/12 border-[#00e0a4]/35 text-[#4ff0c8]"
                  : "bg-white/[0.04] border-white/[0.08] text-[#8a8a99]"
              }`}
            >
              <span className={`w-9 h-5 rounded-full relative transition-colors ${isPublic ? "bg-[#00e0a4]" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isPublic ? "left-[18px]" : "left-0.5"}`} />
              </span>
              <span className="text-[13px] font-bold">
                {isPublic ? "🌐 В общую ленту" : "🔒 Только для себя"}
              </span>
            </button>

            <button type="submit" disabled={busy || (!title.trim() && !text.trim() && !file)} className="gash-btn">
              {busy ? "Публикуем…" : isPublic ? "🚀 Опубликовать" : "💾 Сохранить"}
            </button>
          </div>
        </form>
      )}

      {/* Лента */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="gash-card gash-card-static empty-state">
          <div className="text-5xl mb-4 opacity-55">{feed === "my" ? "📭" : "🌐"}</div>
          <p className="text-[15px] font-bold text-[#c8c8d8] mb-1">
            {feed === "my" ? "У вас пока нет постов" : "В ленте пока пусто"}
          </p>
          <p className="text-[13px] text-[#6a6a7a]">
            {feed === "my" ? "Создайте первый по кнопке выше" : "Опубликуйте пост первым"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p, i) => (
            <article
              key={p.id}
              className="gash-card p-5 animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}
            >
              {/* Шапка */}
              <div className="flex items-center gap-3 mb-3.5">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                    style={{ background: color(p.author) }}
                  >
                    {p.author[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-[#e8e8f0]">{p.author}</span>
                    {p.pinned && <span className="gash-badge gash-badge-warning !text-[9px]">📌 закреплено</span>}
                    {p.isPublic && feed === "my" && <span className="gash-badge gash-badge-success !text-[9px]">🌐 в ленте</span>}
                  </div>
                  <span className="text-[11.5px] text-[#6a6a7a]">{ago(p.createdAt)}</span>
                </div>

                {p.isMine && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => act(p.id, "pin")} className="icon-btn" title="Закрепить">📌</button>
                    <button onClick={() => act(p.id, "publish")} className="icon-btn" title={p.isPublic ? "Скрыть из ленты" : "В ленту"}>
                      {p.isPublic ? "🔒" : "🌐"}
                    </button>
                    <button onClick={() => del(p.id)} className="icon-btn hover:!text-[#ff5470]" title="Удалить">🗑</button>
                  </div>
                )}
              </div>

              {p.title && <h2 className="text-[18px] font-extrabold text-white mb-2 leading-snug">{p.title}</h2>}
              {p.text && (
                <p className="text-[14px] text-[#dcdce6] whitespace-pre-wrap break-words leading-relaxed mb-3">
                  {p.text}
                </p>
              )}

              {p.filePath && p.fileType === "image" && (
                <a href={p.filePath} target="_blank" rel="noopener noreferrer" className="block mb-3 rounded-xl overflow-hidden border border-white/[0.07]">
                  <img src={p.filePath} alt="" className="w-full max-h-96 object-cover hover:scale-[1.02] transition-transform duration-500" loading="lazy" />
                </a>
              )}
              {p.filePath && p.fileType === "audio" && (
                <div className="mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[12px] font-bold text-[#a99bff] mb-2">🎤 Аудио</p>
                  <audio controls src={p.filePath} className="w-full h-9" />
                </div>
              )}
              {p.filePath && p.fileType === "video" && (
                <video controls src={p.filePath} className="w-full max-h-96 mb-3 rounded-xl border border-white/[0.07]" />
              )}

              {p.tags && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSearch(t)}
                      className="gash-badge gash-badge-info !text-[10.5px] hover:!bg-[#6c5ce7]/25"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              {/* Действия */}
              <div className="flex items-center gap-4 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={() => act(p.id, "like")}
                  className={`flex items-center gap-1.5 text-[13px] font-bold transition-all ${
                    p.liked ? "text-[#ff5470] scale-105" : "text-[#7a7a8a] hover:text-[#ff8098]"
                  }`}
                >
                  <span className="text-base">{p.liked ? "❤️" : "🤍"}</span>
                  {p.likes > 0 && p.likes}
                </button>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${p.title ? p.title + "\n\n" : ""}${p.text ?? ""}`
                    );
                    setOk("Текст скопирован");
                    setTimeout(() => setOk(""), 1800);
                  }}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#7a7a8a] hover:text-[#a99bff] transition-colors"
                >
                  📋 Копировать
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
