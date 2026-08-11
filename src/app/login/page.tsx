"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneAuth } from "@/components/PhoneAuth";

type Tab = "phone" | "password";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "phone", label: "Телефон", icon: "📱" },
  { key: "password", label: "Пароль", icon: "🔑" },
];

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("phone");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при входе");
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Не удалось войти. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="gash-card gash-card-static gash-card-glow p-7 animate-rise">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#7b6bf0] to-[#4b3fb8] flex items-center justify-center text-2xl shadow-[0_10px_30px_-10px_rgba(108,92,231,1)] animate-float">
            ⚡
          </div>
          <h1 className="text-2xl font-extrabold gradient-text mb-1.5">Вход в GASHPROJECT</h1>
          <p className="text-[13px] text-[#8a8a99]">Выберите удобный способ</p>
        </div>

        {/* Вкладки способов входа */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setError("");
              }}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
                tab === t.key
                  ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white shadow-[0_6px_16px_-8px_rgba(108,92,231,1)]"
                  : "text-[#8a8a99] hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Содержимое вкладки */}
        <div className="animate-fade-in" key={tab}>
          {tab === "phone" && <PhoneAuth />}

                    {tab === "password" && (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="gash-alert gash-alert-danger">⚠️ {error}</div>}

              <div>
                <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                  Имя пользователя
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ваш логин"
                  className="gash-input"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="gash-input !pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a6a7a] hover:text-[#a99bff] transition-colors"
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="gash-btn w-full !py-3.5 !text-[15px]"
              >
                {loading ? "Входим…" : "🚀 Войти"}
              </button>

              <p className="text-center text-[13px] text-[#8a8a99]">
                Нет аккаунта?{" "}
                <Link href="/register" className="text-[#a99bff] font-bold no-underline">
                  Зарегистрируйтесь
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Преимущества */}
      <div className="grid grid-cols-3 gap-2.5 mt-5">
        {[
          { i: "⚡", t: "Быстро", d: "30 секунд" },
          { i: "🔒", t: "Безопасно", d: "Коды и bcrypt" },
          { i: "✈️", t: "Telegram", d: "Связь с ботом" },
        ].map((x, i) => (
          <div
            key={x.t}
            style={{ animationDelay: `${i * 0.08}s` }}
            className="gash-card gash-card-static p-3 text-center animate-fade-in"
          >
            <div className="text-lg mb-1">{x.i}</div>
            <div className="text-[12px] font-bold text-[#dcdce6]">{x.t}</div>
            <div className="text-[10px] text-[#6a6a7a] mt-0.5">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
