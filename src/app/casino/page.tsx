"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CrashGame } from "@/components/games/CrashGame";
import { MinesGame, CoinflipGame, SlotsGame, RouletteGame } from "@/components/games/MiniGames";
import { RouletteWheel } from "@/components/games/RouletteWheel";
import { SlotsReels } from "@/components/games/SlotsReels";
import { PlinkoGame } from "@/components/games/PlinkoGame";
import { TowerGame } from "@/components/games/TowerGame";
import { DiceGame } from "@/components/games/DiceGame";
import { BlackjackGame } from "@/components/games/BlackjackGame";

interface LevelInfo {
  level: number;
  current: number;
  needed: number;
  progress: number;
  title: string;
  color: string;
}

interface Counters {
  gamesPlayed: number;
  gamesWon: number;
  bestMultiplier: number;
}

type Game = "crash" | "mines" | "plinko" | "tower" | "blackjack" | "dice" | "coinflip" | "roulette" | "slots";

const GAMES: {
  k: Game;
  name: string;
  icon: string;
  tag: string;
  color: string;
  max: string;
}[] = [
  { k: "crash", name: "Crash", icon: "🚀", tag: "Забери до взрыва", color: "#ff4d6d", max: "×1000" },
  { k: "mines", name: "Mines", icon: "💣", tag: "Обойди мины", color: "#ffb340", max: "×24" },
  { k: "plinko", name: "Plinko", icon: "🔴", tag: "Шарик по колышкам", color: "#a68fff", max: "×10" },
  { k: "tower", name: "Tower", icon: "🏗", tag: "Лезь по этажам", color: "#f043a0", max: "×25" },
  { k: "blackjack", name: "Блэкджек", icon: "🃏", tag: "Собери 21 очко", color: "#34e5a0", max: "×2.5" },
  { k: "dice", name: "Dice", icon: "🎲", tag: "Больше или меньше", color: "#22d3ee", max: "×48" },
  { k: "coinflip", name: "Монетка", icon: "🪙", tag: "Орёл или решка", color: "#ffc542", max: "×1.94" },
  { k: "roulette", name: "Рулетка", icon: "🎡", tag: "Красное или чёрное", color: "#34e5a0", max: "×35" },
  { k: "slots", name: "Слоты", icon: "🎰", tag: "Три барабана", color: "#ff7043", max: "×50" },
];

export default function CasinoPage() {
  const [game, setGame] = useState<Game>("crash");
  const [coins, setCoins] = useState(1000);
  const [level, setLevel] = useState<LevelInfo | null>(null);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "level" | "ach" | "coins" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [coinPulse, setCoinPulse] = useState<"up" | "down" | null>(null);
  const prevCoins = useRef(1000);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/stats");
      const d = await r.json();
      if (r.ok) {
        setCoins(d.coins);
        prevCoins.current = d.coins;
        setLevel(d.level);
        setCounters(d.counters);
      }
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleResult = useCallback((newCoins: number, xp?: unknown) => {
    // Подсветка изменения баланса
    if (newCoins > prevCoins.current) setCoinPulse("up");
    else if (newCoins < prevCoins.current) setCoinPulse("down");
    prevCoins.current = newCoins;
    setTimeout(() => setCoinPulse(null), 700);

    setCoins(newCoins);

    const x = xp as {
      leveledUp?: boolean;
      info?: LevelInfo;
      newAchievements?: { name: string; icon: string }[];
    } | null;

    if (x?.info) setLevel(x.info);
    if (x?.leveledUp) {
      setToast({ text: `Уровень ${x.info?.level} · ${x.info?.title}`, kind: "level" });
      setTimeout(() => setToast(null), 3600);
    } else if (x?.newAchievements?.length) {
      const a = x.newAchievements[0];
      setToast({ text: `${a.icon} ${a.name}`, kind: "ach" });
      setTimeout(() => setToast(null), 3600);
    }
  }, []);

  const claimBonus = async () => {
    const r = await fetch("/api/casino/play", { method: "PATCH" });
    const d = await r.json();
    if (d.coins != null) {
      setCoins(d.coins);
      prevCoins.current = d.coins;
      setCoinPulse("up");
      setTimeout(() => setCoinPulse(null), 700);
      setToast({ text: "+1 000 монет зачислено", kind: "coins" });
      setTimeout(() => setToast(null), 2600);
    }
  };

  const active = GAMES.find((g) => g.k === game)!;
  const winRate = counters?.gamesPlayed ? (counters.gamesWon / counters.gamesPlayed) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Всплывающее уведомление */}
      {toast && (
        <div
          className="fixed top-[88px] left-1/2 -translate-x-1/2 z-[150] px-6 py-3.5 rounded-2xl animate-pop flex items-center gap-3"
          style={{
            background:
              toast.kind === "level"
                ? "linear-gradient(135deg, rgba(124,92,255,0.28), rgba(240,67,160,0.2))"
                : toast.kind === "coins"
                ? "rgba(255,179,64,0.2)"
                : "rgba(52,229,160,0.2)",
            border: `1px solid ${
              toast.kind === "level" ? "rgba(124,92,255,0.55)" : toast.kind === "coins" ? "rgba(255,179,64,0.5)" : "rgba(52,229,160,0.5)"
            }`,
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 50px -20px rgba(0,0,0,1)",
          }}
        >
          <span className="text-lg">{toast.kind === "level" ? "🎉" : toast.kind === "coins" ? "💰" : "🏆"}</span>
          <span className="text-[14px] font-extrabold text-white">{toast.text}</span>
        </div>
      )}

      {/* ═══ ШАПКА: баланс, уровень, статистика ═══ */}
      <div className="gash-card gash-card-static overflow-hidden mb-5 animate-rise">
        {/* Верхняя полоса с градиентом активной игры */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${active.color}, transparent)` }} />

        <div className="p-5">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            {/* Баланс */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-300"
                style={{
                  background: "linear-gradient(140deg, rgba(255,179,64,0.25), rgba(255,179,64,0.08))",
                  border: "1px solid rgba(255,179,64,0.3)",
                  transform: coinPulse ? "scale(1.12)" : "scale(1)",
                }}
              >
                💰
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#6a6a80]">Баланс</p>
                <p
                  className="text-[28px] font-extrabold tabular-nums leading-none transition-colors duration-300"
                  style={{ color: coinPulse === "up" ? "#34e5a0" : coinPulse === "down" ? "#ff4d6d" : "#fff" }}
                >
                  {loading ? "…" : coins.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>

            {/* Уровень */}
            {level && (
              <div className="flex-1 min-w-[200px] max-w-[340px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white"
                      style={{ background: level.color }}
                    >
                      {level.level}
                    </span>
                    <span className="text-[12.5px] font-extrabold" style={{ color: level.color }}>
                      {level.title}
                    </span>
                  </span>
                  <span className="text-[11px] text-[#6a6a80] tabular-nums font-semibold">
                    {level.current}/{level.needed} XP
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${level.progress}%`,
                      background: `linear-gradient(90deg, ${level.color}, #7c5cff)`,
                      boxShadow: `0 0 14px ${level.color}90`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Быстрая статистика */}
            {counters && counters.gamesPlayed > 0 && (
              <div className="hidden lg:flex items-center gap-2.5">
                {[
                  { l: "Игр", v: counters.gamesPlayed, c: "#a68fff" },
                  { l: "Винрейт", v: `${winRate.toFixed(0)}%`, c: "#34e5a0" },
                  { l: "Рекорд", v: `×${counters.bestMultiplier.toFixed(1)}`, c: "#ffb340" },
                ].map((s) => (
                  <div key={s.l} className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center min-w-[70px]">
                    <div className="text-[14px] font-extrabold tabular-nums" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-[9.5px] uppercase tracking-wider font-bold text-[#6a6a80]">{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => void claimBonus()} className="gash-btn-outline !py-2.5 !text-[13px]">
              🎁 Бонус
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ЛОББИ ИГР ═══ */}
      <div className="mb-5">
        <p className="section-title">Выберите игру</p>
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-9 gap-2">
          {GAMES.map((g) => {
            const on = game === g.k;
            return (
              <button
                key={g.k}
                onClick={() => setGame(g.k)}
                className={`game-tile ${on ? "on" : ""}`}
                style={{
                  background: on ? `linear-gradient(160deg, ${g.color}26, ${g.color}0a)` : undefined,
                  borderColor: on ? `${g.color}70` : undefined,
                  boxShadow: on ? `0 12px 30px -14px ${g.color}` : undefined,
                }}
              >
                {on && (
                  <span
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: g.color }}
                  />
                )}
                <div className="text-[26px] mb-1 leading-none">{g.icon}</div>
                <div
                  className="text-[12px] font-extrabold leading-tight"
                  style={{ color: on ? g.color : "#c8c8d8" }}
                >
                  {g.name}
                </div>
                <div className="text-[9.5px] font-bold text-[#5a5a70] mt-1 hidden sm:block">{g.max}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ ИГРОВОЕ ПОЛЕ ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,268px] gap-5 items-start">
        <div className="gash-card gash-card-static overflow-hidden animate-rise" key={game}>
          {/* Заголовок игры */}
          <div
            className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3"
            style={{ background: `linear-gradient(90deg, ${active.color}14, transparent)` }}
          >
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${active.color}20`, border: `1px solid ${active.color}38` }}
            >
              {active.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-extrabold text-white leading-tight">{active.name}</h2>
              <p className="text-[12px] text-[#8a8a9e]">{active.tag}</p>
            </div>
            <span
              className="gash-badge !text-[10.5px] flex-shrink-0"
              style={{ background: `${active.color}18`, color: active.color, borderColor: `${active.color}38` }}
            >
              до {active.max}
            </span>
          </div>

          <div className="p-5">
            {game === "crash" && <CrashGame coins={coins} onResult={handleResult} />}
            {game === "mines" && <MinesGame coins={coins} onResult={handleResult} />}
            {game === "plinko" && <PlinkoGame coins={coins} onResult={handleResult} />}
            {game === "tower" && <TowerGame coins={coins} onResult={handleResult} />}
            {game === "blackjack" && <BlackjackGame coins={coins} onResult={handleResult} />}
            {game === "dice" && <DiceGame coins={coins} onResult={handleResult} />}
            {game === "coinflip" && <CoinflipGame coins={coins} onResult={handleResult} />}
            {game === "roulette" && <RouletteWheel coins={coins} onResult={handleResult} />}
            {game === "slots" && <SlotsReels coins={coins} onResult={handleResult} />}
          </div>
        </div>

        {/* ═══ БОКОВАЯ ПАНЕЛЬ ═══ */}
        <div className="space-y-4 lg:sticky lg:top-[84px]">
          {/* Все игры списком */}
          <div className="gash-card gash-card-static p-4">
            <p className="section-title !mb-3">Каталог</p>
            <div className="space-y-1">
              {GAMES.map((g) => (
                <button
                  key={g.k}
                  onClick={() => setGame(g.k)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                    game === g.k ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-[15px] flex-shrink-0">{g.icon}</span>
                  <span
                    className="flex-1 text-[12.5px] font-bold truncate"
                    style={{ color: game === g.k ? g.color : "#a8a8bd" }}
                  >
                    {g.name}
                  </span>
                  <span className="text-[10px] font-bold text-[#5a5a70] tabular-nums">{g.max}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Честность */}
          <div className="gash-card gash-card-static p-4">
            <p className="section-title !mb-3">Честность</p>
            <div className="flex items-start gap-2.5 mb-3">
              <span className="text-base flex-shrink-0">🔐</span>
              <p className="text-[11.5px] text-[#8a8a9e] leading-relaxed">
                Каждый исход — <b className="text-[#a68fff]">HMAC-SHA256</b> от серверного и вашего seed.
                Серверный усилен внешней энтропией с random.org и csrng.net — предсказать результат нельзя.
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5">
              {[
                { l: "Преимущество казино", v: "3%" },
                { l: "Возврат игроку", v: "97%" },
                { l: "Генератор", v: "SHA-256" },
                { l: "Энтропия", v: "random.org" },
                { l: "Карты", v: "deckofcards" },
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6a6a80]">{x.l}</span>
                  <span className="text-[11.5px] font-extrabold text-[#c8c8d8] tabular-nums">{x.v}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10.5px] text-[#4a4a5e] leading-relaxed px-1">
            Монеты виртуальные и не имеют денежной ценности. Играйте в удовольствие.
          </p>
        </div>
      </div>
    </div>
  );
}
