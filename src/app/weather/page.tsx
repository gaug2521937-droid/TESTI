"use client";

import { useState, useEffect, useCallback } from "react";

interface City { key: string; name: string; country: string; }
interface Cur {
  temp: number; feels: number; humidity: number; wind: number;
  pressure: number; clouds: number; isDay: boolean; text: string; icon: string;
}
interface Hour { time: string; temp: number; precip: number; text: string; icon: string; }
interface Day {
  date: string; max: number; min: number; precip: number;
  sunrise: string; sunset: string; text: string; icon: string;
}

export default function WeatherPage() {
  const [city, setCity] = useState("moscow");
  const [cities, setCities] = useState<City[]>([]);
  const [cur, setCur] = useState<Cur | null>(null);
  const [hours, setHours] = useState<Hour[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [cityInfo, setCityInfo] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/weather?city=${key}`);
      const d = await res.json();
      if (d.cities) setCities(d.cities);
      if (!res.ok) {
        setError(d.error || "Ошибка загрузки погоды");
        return;
      }
      setCur(d.current);
      setHours(d.hours || []);
      setDays(d.days || []);
      setCityInfo(d.city);
    } catch {
      setError("Не удалось загрузить прогноз");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(city);
  }, [city, load]);

  const maxTemp = Math.max(...hours.map((h) => h.temp), 1);
  const minTemp = Math.min(...hours.map((h) => h.temp), 0);
  const span = maxTemp - minTemp || 1;

  const dayName = (iso: string, i: number) => {
    if (i === 0) return "Сегодня";
    if (i === 1) return "Завтра";
    return new Date(iso).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="page-head animate-fade-in">
        <div className="status-pill">
          🌍 Open-Meteo · без API-ключей
        </div>
        <h1>
          <span className="gradient-text">Погода</span>
        </h1>
        <p className="text-[#9a9aa8]">Прогноз на 7 дней и почасовая динамика в 20 городах</p>
      </div>

      {/* Выбор города */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        {cities.map((c) => (
          <button
            key={c.key}
            onClick={() => setCity(c.key)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-all ${
              city === c.key
                ? "bg-gradient-to-r from-[#6c5ce7] to-[#5340c9] text-white border-transparent shadow-[0_6px_18px_-8px_rgba(108,92,231,1)]"
                : "bg-white/[0.04] text-[#a0a0b0] border-white/[0.07] hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {error && <div className="gash-alert gash-alert-danger mb-6">⚠️ {error}</div>}

      {loading ? (
        <div className="space-y-5">
          <div className="skeleton h-[210px]" />
          <div className="skeleton h-[150px]" />
          <div className="skeleton h-[280px]" />
        </div>
      ) : (
        cur && (
          <>
            {/* Текущая погода */}
            <div
              className="gash-card gash-card-static p-7 mb-5 animate-rise relative overflow-hidden"
              style={{
                background: cur.isDay
                  ? "linear-gradient(135deg, rgba(0,210,255,0.14), rgba(108,92,231,0.10)), #1e1e1e"
                  : "linear-gradient(135deg, rgba(108,92,231,0.18), rgba(20,20,40,0.4)), #1e1e1e",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-6 relative">
                <div className="flex items-center gap-5">
                  <div className="text-[76px] leading-none animate-float">{cur.icon}</div>
                  <div>
                    <p className="text-[13px] text-[#9a9aa8] font-semibold">
                      {cityInfo?.name}, {cityInfo?.country}
                    </p>
                    <div className="flex items-start gap-1">
                      <span className="text-[62px] font-extrabold text-white leading-none tabular-nums">
                        {cur.temp}
                      </span>
                      <span className="text-2xl font-bold text-[#a8a8b8] mt-2">°C</span>
                    </div>
                    <p className="text-[15px] font-bold text-[#c8c8d8] mt-1">{cur.text}</p>
                    <p className="text-[12.5px] text-[#7a7a8a] mt-0.5">
                      Ощущается как {cur.feels}°C
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 min-w-[210px]">
                  {[
                    { l: "Ветер", v: `${cur.wind} м/с`, i: "💨" },
                    { l: "Влажность", v: `${cur.humidity}%`, i: "💧" },
                    { l: "Давление", v: `${Math.round(cur.pressure * 0.75)} мм`, i: "🌡" },
                    { l: "Облачность", v: `${cur.clouds}%`, i: "☁️" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-xl bg-white/[0.05] border border-white/[0.07] p-2.5"
                    >
                      <div className="text-[10px] text-[#6a6a7a] font-bold uppercase tracking-wider">
                        {s.i} {s.l}
                      </div>
                      <div className="text-[14px] font-extrabold text-white mt-0.5">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Почасовой график */}
            <div className="gash-card gash-card-static p-5 mb-5 animate-fade-in">
              <h3 className="text-[15px] font-extrabold text-[#e8e8f0] mb-4">
                ⏰ Ближайшие 24 часа
              </h3>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {hours.map((h, i) => {
                  const height = 26 + ((h.temp - minTemp) / span) * 54;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5 min-w-[54px]">
                      <span className="text-[11px] font-extrabold text-white tabular-nums">
                        {h.temp}°
                      </span>
                      <div className="h-[84px] flex items-end">
                        <div
                          className="w-[30px] rounded-lg transition-all"
                          style={{
                            height,
                            background: "linear-gradient(180deg, #00d2ff, #6c5ce7)",
                            boxShadow: "0 0 14px -4px rgba(108,92,231,0.9)",
                          }}
                        />
                      </div>
                      <span className="text-base">{h.icon}</span>
                      {h.precip > 0 && (
                        <span className="text-[9.5px] text-[#00d2ff] font-bold">{h.precip}%</span>
                      )}
                      <span className="text-[10.5px] text-[#6a6a7a] font-semibold tabular-nums">
                        {new Date(h.time).toLocaleTimeString("ru-RU", { hour: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Прогноз на неделю */}
            <div className="gash-card gash-card-static p-5 animate-fade-in">
              <h3 className="text-[15px] font-extrabold text-[#e8e8f0] mb-4">📅 На 7 дней</h3>
              <div className="space-y-1.5">
                {days.map((d, i) => (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-[#6c5ce7]/35 transition-colors"
                  >
                    <span className="text-[13px] font-bold text-[#c8c8d8] w-[105px] flex-shrink-0 capitalize">
                      {dayName(d.date, i)}
                    </span>
                    <span className="text-xl flex-shrink-0">{d.icon}</span>
                    <span className="text-[12.5px] text-[#8a8a99] flex-1 min-w-0 truncate hidden sm:block">
                      {d.text}
                    </span>
                    {d.precip > 0 && (
                      <span className="gash-badge !text-[10px] bg-[#00d2ff]/12 text-[#00d2ff] border-[#00d2ff]/25 flex-shrink-0">
                        💧 {d.precip}%
                      </span>
                    )}
                    <span className="text-[11px] text-[#6a6a7a] hidden md:block flex-shrink-0">
                      ☀ {d.sunrise.slice(11, 16)} · 🌙 {d.sunset.slice(11, 16)}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 w-[92px] justify-end">
                      <span className="text-[13.5px] font-extrabold text-white tabular-nums">
                        {d.max}°
                      </span>
                      <div className="w-11 h-1.5 rounded-full bg-gradient-to-r from-[#00d2ff] to-[#ff5470]" />
                      <span className="text-[13px] font-bold text-[#7a7a8a] tabular-nums">
                        {d.min}°
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
