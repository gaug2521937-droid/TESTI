import { NextRequest, NextResponse } from "next/server";

// Кеш курсов валют (5 минут)
interface RatesCache {
  data: Record<string, number> | null;
  timestamp: number;
}

const cache: RatesCache = {
  data: null,
  timestamp: 0,
};

const CACHE_DURATION = 30 * 1000; // 30 секунд

async function fetchExchangeRates(): Promise<Record<string, number>> {
  const apiKey = process.env.EXCHANGERATE_API_KEY || "ffdee74a9158c19ccba3080f";

  // Получаем курсы USD
  const exchangeResponse = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
  );

  let usdRub = 90;
  let eurRub = 98;
  let eurUsd = 1.09;

  if (exchangeResponse.ok) {
    const exchangeData = await exchangeResponse.json();
    if (exchangeData.result === "success") {
      usdRub = exchangeData.conversion_rates?.RUB || 90;
      eurUsd = exchangeData.conversion_rates?.EUR ? 1 / exchangeData.conversion_rates.EUR : 1.09;
      eurRub = usdRub * eurUsd;
    }
  }

  // Получаем криптовалюты через Binance
  let btcUsd = 65000;
  let tonUsd = 5.5;

  try {
    const [btcResponse, tonResponse] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT"),
    ]);

    if (btcResponse.ok) {
      const btcData = await btcResponse.json();
      btcUsd = parseFloat(btcData.price) || btcUsd;
    }

    if (tonResponse.ok) {
      const tonData = await tonResponse.json();
      tonUsd = parseFloat(tonData.price) || tonUsd;
    }
  } catch (error) {
    console.error("Binance API error:", error);
  }

  return {
    USD_RUB: usdRub,
    EUR_RUB: eurRub,
    EUR_USD: eurUsd,
    BTC_USD: btcUsd,
    TON_USD: tonUsd,
    RUB_USD: 1 / usdRub,
    RUB_EUR: 1 / eurRub,
    USD_EUR: 1 / eurUsd,
    USD_BTC: 1 / btcUsd,
    USD_TON: 1 / tonUsd,
  };
}

export async function GET() {
  try {
    // Проверяем кеш
    if (cache.data && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        rates: cache.data,
        cached: true,
        updatedAt: new Date(cache.timestamp).toISOString(),
      });
    }

    const rates = await fetchExchangeRates();
    cache.data = rates;
    cache.timestamp = Date.now();

    return NextResponse.json({
      rates,
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Rates fetch error:", error);

    // Если есть кешированные данные, возвращаем их
    if (cache.data) {
      return NextResponse.json({
        rates: cache.data,
        cached: true,
        updatedAt: new Date(cache.timestamp).toISOString(),
        warning: "Используются кешированные данные",
      });
    }

    return NextResponse.json(
      { error: "Не удалось получить курсы валют" },
      { status: 500 }
    );
  }
}

// Конвертер
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, amount } = body;

    if (!from || !to || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Укажите валюты и сумму" },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Введите корректную сумму" },
        { status: 400 }
      );
    }

    // Получаем свежие курсы
    let rates = cache.data;
    if (!rates || Date.now() - cache.timestamp >= CACHE_DURATION) {
      rates = await fetchExchangeRates();
      cache.data = rates;
      cache.timestamp = Date.now();
    }

    // Конвертируем через USD как базовую валюту
    const toUSD: Record<string, number> = {
      USD: 1,
      RUB: rates.RUB_USD,
      EUR: 1 / rates.EUR_USD,
      BTC: rates.BTC_USD,
      TON: rates.TON_USD,
    };

    const fromUSD: Record<string, number> = {
      USD: 1,
      RUB: rates.USD_RUB,
      EUR: rates.EUR_USD,
      BTC: 1 / rates.BTC_USD,
      TON: 1 / rates.TON_USD,
    };

    if (!(from in toUSD) || !(to in fromUSD)) {
      return NextResponse.json(
        { error: "Неподдерживаемая валюта" },
        { status: 400 }
      );
    }

    // Конвертируем: сумма -> USD -> целевая валюта
    let result: number;
    if (from === to) {
      result = numAmount;
    } else {
      const amountInUSD = from === "USD" ? numAmount : numAmount * toUSD[from];
      result = to === "USD" ? amountInUSD : amountInUSD * fromUSD[to];
    }

    return NextResponse.json({
      from,
      to,
      amount: numAmount,
      result,
      rate: result / numAmount,
    });
  } catch (error) {
    console.error("Convert error:", error);
    return NextResponse.json(
      { error: "Ошибка при конвертации" },
      { status: 500 }
    );
  }
}
