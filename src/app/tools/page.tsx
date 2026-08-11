"use client";

import { useState, useMemo, useEffect } from "react";

type ToolKey = "calc" | "units" | "date" | "password" | "qr" | "base64" | "count" | "color";

const TOOLS: { key: ToolKey; label: string; icon: string; desc: string; color: string }[] = [
  { key: "calc", label: "Калькулятор", icon: "🧮", desc: "Проценты, скидки, НДС, чаевые", color: "#00e0a4" },
  { key: "units", label: "Конвертер величин", icon: "📐", desc: "Длина, вес, температура, объём", color: "#00d2ff" },
  { key: "date", label: "Даты и возраст", icon: "📅", desc: "Разница дат, сколько дней", color: "#ffc542" },
  { key: "password", label: "Пароли", icon: "🔐", desc: "Надёжные пароли и проверка", color: "#e84393" },
  { key: "qr", label: "QR-код", icon: "📱", desc: "Ссылка, Wi-Fi, текст в QR", color: "#6c5ce7" },
  { key: "count", label: "Текст", icon: "📊", desc: "Счётчик и регистр", color: "#ff7043" },
  { key: "base64", label: "Base64 и хеши", icon: "🔄", desc: "Кодирование, SHA-256", color: "#a29bfe" },
  { key: "color", label: "Цвета", icon: "🎨", desc: "HEX ↔ RGB ↔ HSL, палитра", color: "#00cec9" },
];

export default function ToolsPage() {
  const [active, setActive] = useState<ToolKey>("calc");
  const [copied, setCopied] = useState("");

  const copy = (text: string, label = "") => {
    void navigator.clipboard.writeText(text);
    setCopied(label || text.slice(0, 20));
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="page-head animate-fade-in">
        <div className="status-pill">
          🧰 Полезные утилиты на каждый день
        </div>
        <h1>
          <span className="gradient-text">Инструменты</span>
        </h1>
        <p className="text-[#9a9aa8]">Считайте проценты, переводите величины, генерируйте пароли и QR</p>
      </div>

      {/* Плитки инструментов */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {TOOLS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            style={{ animationDelay: `${i * 0.04}s` }}
            className={`gash-card p-4 text-left animate-fade-in ${
              active === t.key ? "!border-[#6c5ce7] !shadow-[0_0_32px_-12px_rgba(108,92,231,0.95)]" : ""
            }`}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-2.5"
              style={{ background: `${t.color}1c`, color: t.color }}
            >
              {t.icon}
            </div>
            <p className="text-[13px] font-extrabold text-[#e8e8f0] leading-tight">{t.label}</p>
            <p className="text-[11px] text-[#6a6a7a] mt-1 leading-snug">{t.desc}</p>
          </button>
        ))}
      </div>

      {copied && (
        <div className="gash-alert gash-alert-success mb-4">✅ Скопировано: {copied}</div>
      )}

      <div className="gash-card gash-card-static gash-card-glow p-6 animate-rise">
        {active === "calc" && <CalcTool onCopy={copy} />}
        {active === "units" && <UnitsTool onCopy={copy} />}
        {active === "date" && <DateTool />}
        {active === "password" && <PasswordTool onCopy={copy} />}
        {active === "qr" && <QrTool />}
        {active === "base64" && <Base64Tool onCopy={copy} />}
        {active === "count" && <CountTool />}
        {active === "color" && <ColorTool onCopy={copy} />}
      </div>
    </div>
  );
}

/* ---------- Генератор паролей ---------- */
function PasswordTool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const [len, setLen] = useState(16);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [pwd, setPwd] = useState("");

  const generate = () => {
    let chars = "abcdefghijkmnopqrstuvwxyz";
    if (upper) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (digits) chars += "23456789";
    if (symbols) chars += "!@#$%^&*()-_=+[]{}<>?";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    setPwd(Array.from(arr, (n) => chars[n % chars.length]).join(""));
  };

  const strength = useMemo(() => {
    if (!pwd) return 0;
    let pool = 26;
    if (upper) pool += 24;
    if (digits) pool += 8;
    if (symbols) pool += 21;
    const bits = Math.log2(pool) * pwd.length;
    return Math.min(100, (bits / 128) * 100);
  }, [pwd, upper, digits, symbols]);

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">🔐 Генератор паролей</h3>
      <div className="flex gap-2.5 mb-4">
        <input readOnly value={pwd} placeholder="Нажмите «Сгенерировать»" className="gash-input flex-1 font-mono !text-[15px]" />
        <button onClick={() => pwd && onCopy(pwd, "пароль")} disabled={!pwd} className="gash-btn-outline">
          📋
        </button>
      </div>
      {pwd && (
        <div className="mb-5">
          <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${strength}%`,
                background: strength > 70 ? "#00e0a4" : strength > 40 ? "#ffc542" : "#ff5470",
              }}
            />
          </div>
          <p className="text-[11.5px] text-[#7a7a8a] mt-1.5 font-semibold">
            Стойкость: {strength > 70 ? "отличная" : strength > 40 ? "средняя" : "слабая"}
          </p>
        </div>
      )}
      <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">
        Длина: {len} символов
      </label>
      <input type="range" min={6} max={64} value={len} onChange={(e) => setLen(Number(e.target.value))}
        className="range-slider mb-5"
        style={{ background: `linear-gradient(90deg,#6c5ce7 ${((len - 6) / 58) * 100}%, rgba(255,255,255,0.12) ${((len - 6) / 58) * 100}%)` }} />
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { l: "A-Z", v: upper, s: setUpper },
          { l: "0-9", v: digits, s: setDigits },
          { l: "!@#", v: symbols, s: setSymbols },
        ].map((o) => (
          <button key={o.l} onClick={() => o.s(!o.v)}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold border transition-all ${
              o.v ? "bg-[#6c5ce7] text-white border-transparent" : "bg-white/[0.04] text-[#8a8a99] border-white/[0.08]"
            }`}>
            {o.v ? "✓ " : ""}{o.l}
          </button>
        ))}
      </div>
      <button onClick={generate} className="gash-btn w-full">🎲 Сгенерировать</button>
    </div>
  );
}

/* ---------- QR-код ---------- */
function QrTool() {
  const [text, setText] = useState("https://gashproject.ru");
  const [size, setSize] = useState(280);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text || " ")}&bgcolor=1e1e1e&color=ffffff&margin=12`;

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">📱 Генератор QR-кода</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Ссылка или любой текст…" className="gash-textarea mb-4" rows={3} />
      <div className="seg-group mb-5">
        {[200, 280, 400].map((s) => (
          <button key={s} onClick={() => setSize(s)} className={`seg-btn ${size === s ? "active" : ""}`}>
            {s}px
          </button>
        ))}
      </div>
      {text.trim() && (
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-2xl bg-[#1a1a22] border border-white/[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="QR-код" width={size} height={size} className="rounded-lg" />
          </div>
          <a href={url} download="qr.png" target="_blank" rel="noopener noreferrer" className="gash-btn no-underline">
            📥 Скачать PNG
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------- Base64 ---------- */
function Base64Tool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"enc" | "dec">("enc");

  const output = useMemo(() => {
    if (!input) return "";
    try {
      return mode === "enc"
        ? btoa(unescape(encodeURIComponent(input)))
        : decodeURIComponent(escape(atob(input.trim())));
    } catch {
      return "⚠️ Некорректные данные для декодирования";
    }
  }, [input, mode]);

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">🔄 Base64</h3>
      <div className="seg-group mb-4">
        <button onClick={() => setMode("enc")} className={`seg-btn ${mode === "enc" ? "active" : ""}`}>Кодировать</button>
        <button onClick={() => setMode("dec")} className={`seg-btn ${mode === "dec" ? "active" : ""}`}>Декодировать</button>
      </div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)}
        placeholder={mode === "enc" ? "Обычный текст…" : "Base64-строка…"} className="gash-textarea mb-3 font-mono !text-[13px]" rows={4} />
      <div className="relative mb-5">
        <textarea readOnly value={output} placeholder="Результат…" className="gash-textarea !bg-white/[0.02] font-mono !text-[13px]" rows={4} />
        {output && (
          <button onClick={() => onCopy(output, "результат")} className="absolute top-2.5 right-2.5 gash-btn-ghost">📋</button>
        )}
      </div>

      <div className="divider-accent mb-5" />
      <HashBlock input={input} onCopy={onCopy} />
    </div>
  );
}

/* Хеши SHA-256 / SHA-512 */
function HashBlock({ input, onCopy }: { input: string; onCopy: (s: string, l?: string) => void }) {
  const [hashes, setHashes] = useState<{ algo: string; value: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    if (!input) return;
    setBusy(true);
    const enc = new TextEncoder().encode(input);
    const out = await Promise.all(
      ["SHA-1", "SHA-256", "SHA-512"].map(async (a) => {
        const buf = await crypto.subtle.digest(a, enc);
        return { algo: a, value: Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("") };
      })
    );
    setHashes(out);
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-[#c8c8d8]">#️⃣ Хеш-суммы текста сверху</p>
        <button onClick={() => void compute()} disabled={!input || busy} className="gash-btn-ghost">
          {busy ? "Считаем…" : "Вычислить"}
        </button>
      </div>
      <div className="space-y-2">
        {hashes.map((h) => (
          <div key={h.algo} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="gash-badge gash-badge-info !text-[10px]">{h.algo}</span>
              <button onClick={() => onCopy(h.value, h.algo)} className="gash-btn-ghost !py-1 !px-2 !text-[11px]">📋</button>
            </div>
            <p className="font-mono text-[11px] text-[#a8a8b8] break-all leading-relaxed">{h.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Счётчик текста ---------- */
function CountTool() {
  const [text, setText] = useState("");
  const s = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      chars: text.length,
      noSpaces: text.replace(/\s/g, "").length,
      words,
      lines: text ? text.split("\n").length : 0,
      sentences: text.trim() ? (text.match(/[.!?]+/g) || []).length || 1 : 0,
      readMin: Math.max(1, Math.ceil(words / 200)),
    };
  }, [text]);

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">📊 Статистика текста</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте текст для анализа…" className="gash-textarea mb-5" rows={7} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { l: "Символов", v: s.chars, c: "#6c5ce7" },
          { l: "Без пробелов", v: s.noSpaces, c: "#00d2ff" },
          { l: "Слов", v: s.words, c: "#00e0a4" },
          { l: "Строк", v: s.lines, c: "#ffc542" },
          { l: "Предложений", v: s.sentences, c: "#e84393" },
          { l: "Мин. чтения", v: s.readMin, c: "#ff7043" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: x.c }}>{x.v}</div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mt-1">{x.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Цвета ---------- */
function ColorTool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const [hex, setHex] = useState("#6c5ce7");

  const conv = useMemo(() => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    return {
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${h}, ${Math.round(sat * 100)}%, ${Math.round(l * 100)}%)`,
      hexUp: `#${m[1]}${m[2]}${m[3]}`.toUpperCase(),
      lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255,
    };
  }, [hex]);

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">🎨 Конвертер цветов</h3>
      <div className="flex gap-3 mb-5">
        <input type="color" value={conv ? conv.hexUp : "#6c5ce7"} onChange={(e) => setHex(e.target.value)}
          className="w-16 h-[50px] rounded-xl border border-white/[0.1] bg-transparent cursor-pointer" />
        <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#6c5ce7"
          className="gash-input flex-1 font-mono" />
      </div>
      {conv ? (
        <>
          <div className="h-24 rounded-2xl mb-4 flex items-center justify-center font-extrabold text-lg border border-white/[0.1]"
            style={{ background: conv.hexUp, color: conv.lum > 0.55 ? "#111" : "#fff" }}>
            {conv.hexUp}
          </div>
          <div className="space-y-2">
            {[
              { l: "HEX", v: conv.hexUp },
              { l: "RGB", v: conv.rgb },
              { l: "HSL", v: conv.hsl },
            ].map((f) => (
              <div key={f.l} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="gash-badge gash-badge-info !text-[10px] w-12 justify-center">{f.l}</span>
                <span className="flex-1 font-mono text-[13px] text-[#dcdce6]">{f.v}</span>
                <button onClick={() => onCopy(f.v, f.l)} className="gash-btn-ghost">📋</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="gash-alert gash-alert-warning">⚠️ Введите корректный HEX, например #6c5ce7</div>
      )}
    </div>
  );
}

/* ---------- UUID ---------- */
function UuidTool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const [list, setList] = useState<string[]>([]);
  const [count, setCount] = useState(5);

  const gen = () => setList(Array.from({ length: count }, () => crypto.randomUUID()));

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">🆔 Генератор UUID v4</h3>
      <div className="flex gap-2.5 mb-5">
        <input type="number" min={1} max={50} value={count}
          onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
          className="gash-input !w-24" />
        <button onClick={gen} className="gash-btn flex-1">🎲 Сгенерировать</button>
        {list.length > 0 && (
          <button onClick={() => onCopy(list.join("\n"), "все UUID")} className="gash-btn-outline">📋 Все</button>
        )}
      </div>
      <div className="space-y-1.5">
        {list.map((u, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-[#6a6a7a] font-bold w-6 flex-shrink-0">{i + 1}</span>
            <span className="flex-1 font-mono text-[12.5px] text-[#dcdce6] break-all">{u}</span>
            <button onClick={() => onCopy(u, "UUID")} className="gash-btn-ghost flex-shrink-0">📋</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Калькулятор процентов и финансов ---------- */
function CalcTool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const [tab, setTab] = useState<"percent" | "discount" | "vat" | "tip" | "loan">("percent");
  const [a, setA] = useState("1000");
  const [b, setB] = useState("15");
  const [months, setMonths] = useState("12");

  const A = Number(a) || 0;
  const B = Number(b) || 0;
  const M = Number(months) || 1;

  const rows: { l: string; v: string }[] = (() => {
    switch (tab) {
      case "percent":
        return [
          { l: `${B}% от ${A.toLocaleString("ru-RU")}`, v: ((A * B) / 100).toFixed(2) },
          { l: `${A.toLocaleString("ru-RU")} + ${B}%`, v: (A * (1 + B / 100)).toFixed(2) },
          { l: `${A.toLocaleString("ru-RU")} − ${B}%`, v: (A * (1 - B / 100)).toFixed(2) },
          { l: `${A} — это сколько % от ${B}`, v: B ? ((A / B) * 100).toFixed(2) + "%" : "—" },
        ];
      case "discount":
        return [
          { l: "Скидка составит", v: ((A * B) / 100).toFixed(2) },
          { l: "Цена со скидкой", v: (A * (1 - B / 100)).toFixed(2) },
          { l: "Экономия за 3 шт.", v: ((A * B * 3) / 100).toFixed(2) },
        ];
      case "vat":
        return [
          { l: `НДС ${B}% сверху`, v: ((A * B) / 100).toFixed(2) },
          { l: "Итого с НДС", v: (A * (1 + B / 100)).toFixed(2) },
          { l: "НДС в сумме (выделить)", v: ((A * B) / (100 + B)).toFixed(2) },
          { l: "Сумма без НДС", v: (A - (A * B) / (100 + B)).toFixed(2) },
        ];
      case "tip":
        return [
          { l: `Чаевые ${B}%`, v: ((A * B) / 100).toFixed(2) },
          { l: "Итого к оплате", v: (A * (1 + B / 100)).toFixed(2) },
          { l: "На двоих", v: ((A * (1 + B / 100)) / 2).toFixed(2) },
          { l: "На четверых", v: ((A * (1 + B / 100)) / 4).toFixed(2) },
        ];
      case "loan": {
        const r = B / 100 / 12;
        const pay = r > 0 ? (A * r) / (1 - Math.pow(1 + r, -M)) : A / M;
        return [
          { l: "Платёж в месяц", v: pay.toFixed(2) },
          { l: "Всего выплатите", v: (pay * M).toFixed(2) },
          { l: "Переплата", v: (pay * M - A).toFixed(2) },
        ];
      }
    }
  })();

  const labels = {
    percent: ["Число", "Процент"],
    discount: ["Цена", "Скидка %"],
    vat: ["Сумма", "Ставка НДС %"],
    tip: ["Счёт", "Чаевые %"],
    loan: ["Сумма кредита", "Ставка % годовых"],
  }[tab];

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">🧮 Калькулятор</h3>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5">
        {([
          { k: "percent", l: "Проценты" },
          { k: "discount", l: "Скидка" },
          { k: "vat", l: "НДС" },
          { k: "tip", l: "Чаевые" },
          { k: "loan", l: "Кредит" },
        ] as const).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all ${
              tab === t.k ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white" : "bg-white/[0.04] text-[#8a8a99] hover:bg-white/[0.08]"
            }`}>{t.l}</button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">{labels[0]}</label>
          <input type="number" value={a} onChange={(e) => setA(e.target.value)} className="gash-input !text-[16px] !font-bold" />
        </div>
        <div>
          <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">{labels[1]}</label>
          <input type="number" value={b} onChange={(e) => setB(e.target.value)} className="gash-input !text-[16px] !font-bold" />
        </div>
      </div>

      {tab === "loan" && (
        <div className="mb-3">
          <label className="block text-[11.5px] uppercase tracking-wider font-bold text-[#6a6a7a] mb-2">Срок, месяцев</label>
          <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} className="gash-input" />
        </div>
      )}

      <div className="space-y-2 mt-5">
        {rows.map((r) => (
          <div key={r.l} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <span className="flex-1 text-[13px] text-[#a8a8b8]">{r.l}</span>
            <span className="text-[16px] font-extrabold text-[#00e0a4] tabular-nums">{r.v}</span>
            <button onClick={() => onCopy(r.v, r.l)} className="gash-btn-ghost !py-1 !px-2">📋</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Конвертер величин ---------- */
function UnitsTool({ onCopy }: { onCopy: (s: string, l?: string) => void }) {
  const GROUPS = {
    length: { label: "Длина", units: { "мм": 0.001, "см": 0.01, "м": 1, "км": 1000, "дюйм": 0.0254, "фут": 0.3048, "миля": 1609.34 } },
    weight: { label: "Вес", units: { "г": 0.001, "кг": 1, "т": 1000, "фунт": 0.453592, "унция": 0.0283495 } },
    volume: { label: "Объём", units: { "мл": 0.001, "л": 1, "м³": 1000, "галлон": 3.78541, "стакан": 0.24 } },
    speed: { label: "Скорость", units: { "км/ч": 1, "м/с": 3.6, "миль/ч": 1.60934, "узел": 1.852 } },
    data: { label: "Данные", units: { "КБ": 1, "МБ": 1024, "ГБ": 1048576, "ТБ": 1073741824 } },
  };
  type G = keyof typeof GROUPS;

  const [group, setGroup] = useState<G>("length");
  const [from, setFrom] = useState("м");
  const [to, setTo] = useState("км");
  const [val, setVal] = useState("1");
  const [temp, setTemp] = useState("20");

  const units = Object.keys(GROUPS[group].units);
  useEffect(() => {
    const u = Object.keys(GROUPS[group].units);
    setFrom(u[0]); setTo(u[1] ?? u[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const table = GROUPS[group].units as Record<string, number>;
  const result = ((Number(val) || 0) * (table[from] ?? 1)) / (table[to] ?? 1);

  const C = Number(temp) || 0;

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">📐 Конвертер величин</h3>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5">
        {(Object.keys(GROUPS) as G[]).map((g) => (
          <button key={g} onClick={() => setGroup(g)}
            className={`px-4 py-2 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition-all ${
              group === g ? "bg-gradient-to-br from-[#6c5ce7] to-[#5340c9] text-white" : "bg-white/[0.04] text-[#8a8a99] hover:bg-white/[0.08]"
            }`}>{GROUPS[g].label}</button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-end mb-4">
        <div>
          <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="gash-input !text-[16px] !font-bold mb-2" />
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="gash-select !py-2.5 !text-[13px]">
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <button onClick={() => { setFrom(to); setTo(from); }}
          className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[#a99bff] hover:rotate-180 transition-all duration-500 mb-1">⇄</button>
        <div>
          <div className="gash-input !text-[16px] !font-extrabold !text-[#00e0a4] mb-2 truncate">
            {result.toLocaleString("ru-RU", { maximumFractionDigits: 6 })}
          </div>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="gash-select !py-2.5 !text-[13px]">
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <button onClick={() => onCopy(String(result), "результат")} className="gash-btn-outline w-full mb-6">📋 Скопировать</button>

      <div className="divider-accent mb-5" />
      <p className="text-[13px] font-bold text-[#c8c8d8] mb-3">🌡 Температура</p>
      <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)}
        placeholder="Цельсий" className="gash-input mb-3 !text-[16px] !font-bold" />
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { l: "°C", v: C.toFixed(1) },
          { l: "°F", v: (C * 9 / 5 + 32).toFixed(1) },
          { l: "K", v: (C + 273.15).toFixed(1) },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-[#6a6a7a] mb-1">{x.l}</div>
            <div className="text-[16px] font-extrabold text-[#00d2ff] tabular-nums">{x.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Даты и возраст ---------- */
function DateTool() {
  const today = new Date().toISOString().slice(0, 10);
  const [d1, setD1] = useState(today);
  const [d2, setD2] = useState(today);
  const [birth, setBirth] = useState("2000-01-01");
  const [addDays, setAddDays] = useState("30");

  const diff = Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
  const b = new Date(birth);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const md = now.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < b.getDate())) years--;
  const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400000);

  const future = new Date(Date.now() + (Number(addDays) || 0) * 86400000);

  return (
    <div>
      <h3 className="text-lg font-extrabold text-white mb-5">📅 Даты и возраст</h3>

      <p className="text-[13px] font-bold text-[#c8c8d8] mb-3">Разница между датами</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <input type="date" value={d1} onChange={(e) => setD1(e.target.value)} className="gash-input" />
        <input type="date" value={d2} onChange={(e) => setD2(e.target.value)} className="gash-input" />
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { l: "Дней", v: Math.abs(diff) },
          { l: "Недель", v: Math.abs(Math.round(diff / 7)) },
          { l: "Месяцев", v: Math.abs(Math.round(diff / 30.44)) },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 text-center">
            <div className="text-xl font-extrabold text-[#a99bff] tabular-nums">{x.v}</div>
            <div className="text-[10px] uppercase font-bold text-[#6a6a7a] mt-1">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="divider-accent mb-5" />
      <p className="text-[13px] font-bold text-[#c8c8d8] mb-3">Возраст</p>
      <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="gash-input mb-3" />
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { l: "Лет", v: years, c: "#00e0a4" },
          { l: "Дней прожито", v: totalDays.toLocaleString("ru-RU"), c: "#00d2ff" },
          { l: "Часов", v: (totalDays * 24).toLocaleString("ru-RU"), c: "#e84393" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 text-center">
            <div className="text-[17px] font-extrabold tabular-nums" style={{ color: x.c }}>{x.v}</div>
            <div className="text-[10px] uppercase font-bold text-[#6a6a7a] mt-1">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="divider-accent mb-5" />
      <p className="text-[13px] font-bold text-[#c8c8d8] mb-3">Дата через N дней</p>
      <div className="flex gap-3">
        <input type="number" value={addDays} onChange={(e) => setAddDays(e.target.value)} className="gash-input !w-32" />
        <div className="gash-input flex-1 !font-bold !text-[#ffc542]">
          {future.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}
