"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

/** Регистрация и вход по номеру телефона с кодом подтверждения */
export function PhoneAuth() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [username, setUsername] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [demoCode, setDemoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Таймер повторной отправки
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Форматирование ввода: +7 (912) 345-67-89
  const formatPhone = (raw: string) => {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7") && d.length > 0 && d.length <= 10) d = "7" + d;
    d = d.slice(0, 11);
    if (d.length === 0) return "";
    let out = "+" + d[0];
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 5) out += ") " + d.slice(4, 7);
    if (d.length >= 8) out += "-" + d.slice(7, 9);
    if (d.length >= 10) out += "-" + d.slice(9, 11);
    return out;
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = phone.replace(/\D/g, "");
    if (raw.length < 10) {
      setError("Введите полный номер телефона");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка отправки кода");
        return;
      }
      setMasked(data.maskedPhone);
      setIsNew(data.isNewUser);
      setDemoCode(data.demoCode || "");
      setStep("code");
      setCountdown(45);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputs.current[0]?.focus(), 120);
    } catch {
      setError("Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (codeOverride?: string) => {
    const code = codeOverride ?? digits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          phone: phone.replace(/\D/g, ""),
          code,
          username: username.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Неверный код");
        setDigits(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Ошибка проверки кода");
    } finally {
      setLoading(false);
    }
  };

  const onDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Вставка всего кода целиком
      const arr = clean.slice(0, 6).split("");
      const next = [...digits];
      arr.forEach((c, k) => {
        if (i + k < 6) next[i + k] = c;
      });
      setDigits(next);
      const filled = next.join("");
      if (filled.length === 6) void verify(filled);
      else inputs.current[Math.min(i + arr.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (next.every((d) => d !== "")) void verify(next.join(""));
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  /* ---------- Шаг 1: номер ---------- */
  if (step === "phone") {
    return (
      <form onSubmit={sendCode}>
        {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

        <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
          Номер телефона
        </label>
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
            📱
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="+7 (912) 345-67-89"
            className="gash-input !pl-12 !text-[17px] !font-bold !tracking-wide"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={loading || phone.replace(/\D/g, "").length < 10}
          className="gash-btn w-full !py-3.5 !text-[15px]"
        >
          {loading ? "Отправляем…" : "📨 Получить код"}
        </button>

        <p className="text-[11.5px] text-[#5a5a6a] mt-3.5 text-center leading-relaxed">
          Нажимая кнопку, вы подтверждаете согласие на обработку данных.
          Если аккаунта нет — он создастся автоматически.
        </p>
      </form>
    );
  }

  /* ---------- Шаг 2: код ---------- */
  return (
    <div>
      <button
        onClick={() => {
          setStep("phone");
          setError("");
        }}
        className="gash-btn-ghost mb-4"
      >
        ← Изменить номер
      </button>

      <div className="text-center mb-5">
        <div className="text-3xl mb-2">✉️</div>
        <p className="text-[14px] font-bold text-white mb-1">Введите код из 6 цифр</p>
        <p className="text-[12.5px] text-[#8a8a99]">
          Отправлен на <span className="text-[#a99bff] font-semibold">{masked}</span>
        </p>
      </div>

      {/* Демо-код */}
      {demoCode && (
        <div
          className="rounded-2xl p-3.5 mb-4 text-center border animate-bounce-in"
          style={{
            background: "linear-gradient(135deg, rgba(255,197,66,0.14), rgba(255,197,66,0.04))",
            borderColor: "rgba(255,197,66,0.35)",
          }}
        >
          <p className="text-[10.5px] uppercase tracking-wider font-bold text-[#ffc542] mb-1.5">
            Демо-режим · SMS-шлюз не подключён
          </p>
          <button
            onClick={() => {
              setDigits(demoCode.split(""));
              void verify(demoCode);
            }}
            className="text-[26px] font-extrabold text-white tracking-[0.28em] tabular-nums hover:text-[#ffc542] transition-colors"
          >
            {demoCode}
          </button>
          <p className="text-[10.5px] text-[#a08a4a] mt-1">Нажмите на код, чтобы подставить</p>
        </div>
      )}

      {error && <div className="gash-alert gash-alert-danger mb-4">⚠️ {error}</div>}

      {/* Поля кода */}
      <div className="flex gap-2 justify-center mb-4">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => onDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            inputMode="numeric"
            maxLength={6}
            className="w-[46px] h-[56px] text-center text-[22px] font-extrabold rounded-xl bg-white/[0.04] border-2 border-white/[0.1] text-white outline-none transition-all focus:border-[#6c5ce7] focus:bg-[#6c5ce7]/10 focus:shadow-[0_0_0_4px_rgba(108,92,231,0.16)]"
          />
        ))}
      </div>

      {/* Имя для новых */}
      {isNew && (
        <div className="mb-4">
          <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
            Как вас называть? <span className="text-[#5a5a6a] normal-case">(необязательно)</span>
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ваше имя"
            maxLength={40}
            className="gash-input"
          />
        </div>
      )}

      <button
        onClick={() => void verify()}
        disabled={loading || digits.join("").length !== 6}
        className="gash-btn w-full !py-3.5 !text-[15px] mb-3"
      >
        {loading ? "Проверяем…" : isNew ? "🚀 Создать аккаунт" : "🔓 Войти"}
      </button>

      <button
        onClick={() => void sendCode()}
        disabled={countdown > 0 || loading}
        className="w-full text-[12.5px] font-semibold text-[#8a8a99] hover:text-[#a99bff] disabled:opacity-45 transition-colors"
      >
        {countdown > 0 ? `Отправить повторно через ${countdown} сек` : "Отправить код ещё раз"}
      </button>
    </div>
  );
}
