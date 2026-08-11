"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneAuth } from "@/components/PhoneAuth";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Оценка надёжности пароля
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-ZА-Я]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-zА-Яа-я0-9]/.test(password)) score++;
    const labels = ["Очень слабый", "Слабый", "Средний", "Хороший", "Надёжный", "Отличный"];
    const colors = ["#ff5470", "#ff5470", "#ffc542", "#ffc542", "#00e0a4", "#00e0a4"];
    return { score, label: labels[score], color: colors[score], pct: (score / 5) * 100 };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) return;

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка при регистрации");
        return;
      }
      // Небольшая пауза, чтобы cookie сессии успела осесть
      // (иначе router.refresh() иногда идёт раньше, чем браузер запишет её)
      await new Promise((r) => setTimeout(r, 100));
      router.refresh();
      router.push("/profile");
    } catch {
      setError("Не удалось зарегистрироваться. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="gash-card gash-card-static gash-card-glow p-8 animate-rise">
        <div className="text-center mb-7">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#7b6bf0] to-[#4b3fb8] flex items-center justify-center text-2xl shadow-[0_10px_30px_-10px_rgba(108,92,231,1)]">
            ✨
          </div>
          <h1 className="text-2xl font-extrabold gradient-text mb-1.5">Создать аккаунт</h1>
          <p className="text-[13.5px] text-[#8a8a99]">Ставки и заметки будут привязаны к вам</p>
        </div>

        {/* Быстрая регистрация по номеру телефона */}
        <div className="rounded-2xl border border-[#6c5ce7]/28 bg-[#6c5ce7]/[0.06] p-4 mb-5">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="gash-badge gash-badge-success !text-[10px]">быстрее всего</span>
            <span className="text-[12.5px] font-bold text-[#c8c8d8]">За 30 секунд, без пароля</span>
          </div>
          <PhoneAuth />
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/[0.1]" />
          <span className="text-[11px] uppercase tracking-wider font-bold text-[#5a5a6a]">
            или с паролем
          </span>
          <div className="flex-1 h-px bg-white/[0.1]" />
        </div>

        {error && <div className="gash-alert gash-alert-danger mb-5">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
              Имя пользователя
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="От 3 до 50 символов"
              className="gash-input"
              minLength={3}
              maxLength={50}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="gash-input"
              autoComplete="email"
              required
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
                placeholder="Минимум 6 символов"
                className="gash-input !pr-12"
                minLength={6}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a6a7a] hover:text-[#a99bff] transition-colors text-sm"
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>

            {password && (
              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-400"
                    style={{ width: `${strength.pct}%`, background: strength.color }}
                  />
                </div>
                <p className="text-[11px] font-bold mt-1.5" style={{ color: strength.color }}>
                  Надёжность: {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
              Подтвердите пароль
            </label>
            <input
              type={showPass ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className="gash-input"
              autoComplete="new-password"
              required
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[11.5px] text-[#ff5470] mt-1.5 font-semibold">
                Пароли не совпадают
              </p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="text-[11.5px] text-[#00e0a4] mt-1.5 font-semibold">✓ Пароли совпадают</p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !username.trim() ||
              !email.trim() ||
              !password ||
              password !== confirmPassword
            }
            className="gash-btn w-full !py-3.5 !text-[15px]"
          >
            {loading ? "Создаём…" : "🚀 Создать аккаунт"}
          </button>
        </form>

        <div className="gash-divider" />

        <p className="text-center text-[13.5px] text-[#8a8a99]">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-[#a99bff] hover:text-[#c5bcff] font-bold no-underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
