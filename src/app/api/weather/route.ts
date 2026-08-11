import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Города (геокодер Open-Meteo недоступен из песочницы — используем встроенный список)
export const CITIES = [
  // ── Россия ──
  { key: "moscow", name: "Москва", country: "Россия", region: "ru", lat: 55.7558, lon: 37.6173, tz: "Europe/Moscow" },
  { key: "spb", name: "Санкт-Петербург", country: "Россия", region: "ru", lat: 59.9311, lon: 30.3609, tz: "Europe/Moscow" },
  { key: "novosibirsk", name: "Новосибирск", country: "Россия", region: "ru", lat: 55.0084, lon: 82.9357, tz: "Asia/Novosibirsk" },
  { key: "ekb", name: "Екатеринбург", country: "Россия", region: "ru", lat: 56.8389, lon: 60.6057, tz: "Asia/Yekaterinburg" },
  { key: "kazan", name: "Казань", country: "Россия", region: "ru", lat: 55.7963, lon: 49.1088, tz: "Europe/Moscow" },
  { key: "nnovgorod", name: "Нижний Новгород", country: "Россия", region: "ru", lat: 56.2965, lon: 43.9361, tz: "Europe/Moscow" },
  { key: "chelyabinsk", name: "Челябинск", country: "Россия", region: "ru", lat: 55.1644, lon: 61.4368, tz: "Asia/Yekaterinburg" },
  { key: "samara", name: "Самара", country: "Россия", region: "ru", lat: 53.1959, lon: 50.1002, tz: "Europe/Samara" },
  { key: "omsk", name: "Омск", country: "Россия", region: "ru", lat: 54.9885, lon: 73.3242, tz: "Asia/Omsk" },
  { key: "rostov", name: "Ростов-на-Дону", country: "Россия", region: "ru", lat: 47.2357, lon: 39.7015, tz: "Europe/Moscow" },
  { key: "ufa", name: "Уфа", country: "Россия", region: "ru", lat: 54.7388, lon: 55.9721, tz: "Asia/Yekaterinburg" },
  { key: "krasnoyarsk", name: "Красноярск", country: "Россия", region: "ru", lat: 56.0184, lon: 92.8672, tz: "Asia/Krasnoyarsk" },
  { key: "voronezh", name: "Воронеж", country: "Россия", region: "ru", lat: 51.6720, lon: 39.1843, tz: "Europe/Moscow" },
  { key: "perm", name: "Пермь", country: "Россия", region: "ru", lat: 58.0105, lon: 56.2502, tz: "Asia/Yekaterinburg" },
  { key: "volgograd", name: "Волгоград", country: "Россия", region: "ru", lat: 48.7080, lon: 44.5133, tz: "Europe/Volgograd" },
  { key: "krasnodar", name: "Краснодар", country: "Россия", region: "ru", lat: 45.0355, lon: 38.9753, tz: "Europe/Moscow" },
  { key: "saratov", name: "Саратов", country: "Россия", region: "ru", lat: 51.5336, lon: 46.0343, tz: "Europe/Saratov" },
  { key: "tyumen", name: "Тюмень", country: "Россия", region: "ru", lat: 57.1522, lon: 65.5272, tz: "Asia/Yekaterinburg" },
  { key: "tolyatti", name: "Тольятти", country: "Россия", region: "ru", lat: 53.5303, lon: 49.3461, tz: "Europe/Samara" },
  { key: "izhevsk", name: "Ижевск", country: "Россия", region: "ru", lat: 56.8527, lon: 53.2115, tz: "Europe/Samara" },
  { key: "barnaul", name: "Барнаул", country: "Россия", region: "ru", lat: 53.3479, lon: 83.7798, tz: "Asia/Barnaul" },
  { key: "irkutsk", name: "Иркутск", country: "Россия", region: "ru", lat: 52.2870, lon: 104.3050, tz: "Asia/Irkutsk" },
  { key: "khabarovsk", name: "Хабаровск", country: "Россия", region: "ru", lat: 48.4827, lon: 135.0838, tz: "Asia/Vladivostok" },
  { key: "vladivostok", name: "Владивосток", country: "Россия", region: "ru", lat: 43.1155, lon: 131.8855, tz: "Asia/Vladivostok" },
  { key: "yaroslavl", name: "Ярославль", country: "Россия", region: "ru", lat: 57.6261, lon: 39.8845, tz: "Europe/Moscow" },
  { key: "makhachkala", name: "Махачкала", country: "Россия", region: "ru", lat: 42.9849, lon: 47.5047, tz: "Europe/Moscow" },
  { key: "tomsk", name: "Томск", country: "Россия", region: "ru", lat: 56.4846, lon: 84.9476, tz: "Asia/Tomsk" },
  { key: "orenburg", name: "Оренбург", country: "Россия", region: "ru", lat: 51.7727, lon: 55.0988, tz: "Asia/Yekaterinburg" },
  { key: "kemerovo", name: "Кемерово", country: "Россия", region: "ru", lat: 55.3547, lon: 86.0873, tz: "Asia/Novokuznetsk" },
  { key: "novokuznetsk", name: "Новокузнецк", country: "Россия", region: "ru", lat: 53.7557, lon: 87.1099, tz: "Asia/Novokuznetsk" },
  { key: "ryazan", name: "Рязань", country: "Россия", region: "ru", lat: 54.6295, lon: 39.7415, tz: "Europe/Moscow" },
  { key: "astrakhan", name: "Астрахань", country: "Россия", region: "ru", lat: 46.3497, lon: 48.0408, tz: "Europe/Astrakhan" },
  { key: "penza", name: "Пенза", country: "Россия", region: "ru", lat: 53.2007, lon: 45.0046, tz: "Europe/Moscow" },
  { key: "lipetsk", name: "Липецк", country: "Россия", region: "ru", lat: 52.6088, lon: 39.5992, tz: "Europe/Moscow" },
  { key: "tula", name: "Тула", country: "Россия", region: "ru", lat: 54.1961, lon: 37.6182, tz: "Europe/Moscow" },
  { key: "kirov", name: "Киров", country: "Россия", region: "ru", lat: 58.6035, lon: 49.6679, tz: "Europe/Kirov" },
  { key: "cheboksary", name: "Чебоксары", country: "Россия", region: "ru", lat: 56.1439, lon: 47.2489, tz: "Europe/Moscow" },
  { key: "kaliningrad", name: "Калининград", country: "Россия", region: "ru", lat: 54.7104, lon: 20.4522, tz: "Europe/Kaliningrad" },
  { key: "sochi", name: "Сочи", country: "Россия", region: "ru", lat: 43.6028, lon: 39.7342, tz: "Europe/Moscow" },
  { key: "yakutsk", name: "Якутск", country: "Россия", region: "ru", lat: 62.0355, lon: 129.6755, tz: "Asia/Yakutsk" },
  { key: "murmansk", name: "Мурманск", country: "Россия", region: "ru", lat: 68.9585, lon: 33.0827, tz: "Europe/Moscow" },
  { key: "arkhangelsk", name: "Архангельск", country: "Россия", region: "ru", lat: 64.5401, lon: 40.5433, tz: "Europe/Moscow" },
  { key: "surgut", name: "Сургут", country: "Россия", region: "ru", lat: 61.2500, lon: 73.4167, tz: "Asia/Yekaterinburg" },
  { key: "sevastopol", name: "Севастополь", country: "Россия", region: "ru", lat: 44.6166, lon: 33.5254, tz: "Europe/Moscow" },
  { key: "grozny", name: "Грозный", country: "Россия", region: "ru", lat: 43.3169, lon: 45.6981, tz: "Europe/Moscow" },
  { key: "petropavlovsk", name: "Петропавловск-Камчатский", country: "Россия", region: "ru", lat: 53.0445, lon: 158.6475, tz: "Asia/Kamchatka" },
  { key: "yuzhno", name: "Южно-Сахалинск", country: "Россия", region: "ru", lat: 46.9591, lon: 142.7380, tz: "Asia/Sakhalin" },
  { key: "norilsk", name: "Норильск", country: "Россия", region: "ru", lat: 69.3558, lon: 88.1893, tz: "Asia/Krasnoyarsk" },
  { key: "ulanude", name: "Улан-Удэ", country: "Россия", region: "ru", lat: 51.8335, lon: 107.5841, tz: "Asia/Irkutsk" },
  { key: "stavropol", name: "Ставрополь", country: "Россия", region: "ru", lat: 45.0428, lon: 41.9734, tz: "Europe/Moscow" },
  // ── Мир ──
  { key: "minsk", name: "Минск", country: "Беларусь", region: "world", lat: 53.9006, lon: 27.559, tz: "Europe/Minsk" },
  { key: "almaty", name: "Алматы", country: "Казахстан", region: "world", lat: 43.2389, lon: 76.8897, tz: "Asia/Almaty" },
  { key: "tashkent", name: "Ташкент", country: "Узбекистан", region: "world", lat: 41.2995, lon: 69.2401, tz: "Asia/Tashkent" },
  { key: "tbilisi", name: "Тбилиси", country: "Грузия", region: "world", lat: 41.7151, lon: 44.8271, tz: "Asia/Tbilisi" },
  { key: "yerevan", name: "Ереван", country: "Армения", region: "world", lat: 40.1792, lon: 44.4991, tz: "Asia/Yerevan" },
  { key: "baku", name: "Баку", country: "Азербайджан", region: "world", lat: 40.4093, lon: 49.8671, tz: "Asia/Baku" },
  { key: "dubai", name: "Дубай", country: "ОАЭ", region: "world", lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" },
  { key: "istanbul", name: "Стамбул", country: "Турция", region: "world", lat: 41.0082, lon: 28.9784, tz: "Europe/Istanbul" },
  { key: "london", name: "Лондон", country: "Великобритания", region: "world", lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
  { key: "paris", name: "Париж", country: "Франция", region: "world", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" },
  { key: "berlin", name: "Берлин", country: "Германия", region: "world", lat: 52.52, lon: 13.405, tz: "Europe/Berlin" },
  { key: "newyork", name: "Нью-Йорк", country: "США", region: "world", lat: 40.7128, lon: -74.006, tz: "America/New_York" },
  { key: "tokyo", name: "Токио", country: "Япония", region: "world", lat: 35.6762, lon: 139.6503, tz: "Asia/Tokyo" },
  { key: "bali", name: "Бали", country: "Индонезия", region: "world", lat: -8.4095, lon: 115.1889, tz: "Asia/Makassar" },
];

// Расшифровка кодов погоды WMO
const WMO: Record<number, { text: string; icon: string }> = {
  0: { text: "Ясно", icon: "☀️" },
  1: { text: "Преимущественно ясно", icon: "🌤" },
  2: { text: "Переменная облачность", icon: "⛅" },
  3: { text: "Пасмурно", icon: "☁️" },
  45: { text: "Туман", icon: "🌫" },
  48: { text: "Изморозь", icon: "🌫" },
  51: { text: "Лёгкая морось", icon: "🌦" },
  53: { text: "Морось", icon: "🌦" },
  55: { text: "Сильная морось", icon: "🌧" },
  61: { text: "Небольшой дождь", icon: "🌦" },
  63: { text: "Дождь", icon: "🌧" },
  65: { text: "Сильный дождь", icon: "🌧" },
  71: { text: "Небольшой снег", icon: "🌨" },
  73: { text: "Снег", icon: "❄️" },
  75: { text: "Сильный снег", icon: "❄️" },
  77: { text: "Снежная крупа", icon: "🌨" },
  80: { text: "Ливень", icon: "🌦" },
  81: { text: "Сильный ливень", icon: "🌧" },
  82: { text: "Очень сильный ливень", icon: "⛈" },
  85: { text: "Снегопад", icon: "🌨" },
  86: { text: "Сильный снегопад", icon: "❄️" },
  95: { text: "Гроза", icon: "⛈" },
  96: { text: "Гроза с градом", icon: "⛈" },
  99: { text: "Сильная гроза с градом", icon: "⛈" },
};

function decode(code: number) {
  return WMO[code] ?? { text: "Неизвестно", icon: "🌡" };
}

export async function GET(request: NextRequest) {
  const cityKey = request.nextUrl.searchParams.get("city") || "moscow";
  const city = CITIES.find((c) => c.key === cityKey) ?? CITIES[0];

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,` +
      `wind_speed_10m,surface_pressure,cloud_cover` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
      `&timezone=${encodeURIComponent(city.tz)}&forecast_days=7`;

    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error("open-meteo failed");

    const d = await res.json();
    const cur = d.current || {};
    const daily = d.daily || {};
    const hourly = d.hourly || {};

    // Ближайшие 24 часа начиная с текущего
    const nowIso = String(cur.time || "").slice(0, 13);
    const startIdx = Math.max(
      0,
      (hourly.time || []).findIndex((t: string) => t.slice(0, 13) === nowIso)
    );

    const hours = (hourly.time || [])
      .slice(startIdx, startIdx + 24)
      .map((t: string, i: number) => {
        const code = hourly.weather_code?.[startIdx + i] ?? 0;
        return {
          time: t,
          temp: Math.round(hourly.temperature_2m?.[startIdx + i] ?? 0),
          precip: hourly.precipitation_probability?.[startIdx + i] ?? 0,
          ...decode(code),
        };
      });

    const days = (daily.time || []).map((t: string, i: number) => {
      const code = daily.weather_code?.[i] ?? 0;
      return {
        date: t,
        max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        precip: daily.precipitation_probability_max?.[i] ?? 0,
        sunrise: daily.sunrise?.[i] ?? "",
        sunset: daily.sunset?.[i] ?? "",
        ...decode(code),
      };
    });

    return NextResponse.json({
      city,
      current: {
        temp: Math.round(cur.temperature_2m ?? 0),
        feels: Math.round(cur.apparent_temperature ?? 0),
        humidity: cur.relative_humidity_2m ?? 0,
        wind: Math.round((cur.wind_speed_10m ?? 0) * 10) / 10,
        pressure: Math.round(cur.surface_pressure ?? 0),
        clouds: cur.cloud_cover ?? 0,
        isDay: cur.is_day === 1,
        ...decode(cur.weather_code ?? 0),
      },
      hours,
      days,
      cities: CITIES,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Weather error:", error);
    return NextResponse.json(
      { error: "Не удалось получить прогноз погоды. Попробуйте позже.", cities: CITIES },
      { status: 502 }
    );
  }
}
