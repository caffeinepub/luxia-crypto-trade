import { BINGX_BASE_URL } from "./config";

export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchAllTickers(): Promise<Ticker[]> {
  try {
    const res = await fetch(`${BINGX_BASE_URL}/openApi/swap/v2/quote/ticker`, {
      headers: { "X-BX-APIKEY": "" },
    });
    if (!res.ok) throw new Error("BingX error");
    const data = await res.json();
    if (data?.data && Array.isArray(data.data)) {
      return data.data.map(
        (t: {
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          volume: string;
        }) => ({
          symbol: t.symbol,
          lastPrice: Number.parseFloat(t.lastPrice) || 0,
          priceChangePercent: Number.parseFloat(t.priceChangePercent) || 0,
          volume: Number.parseFloat(t.volume) || 0,
        }),
      );
    }
    throw new Error("Invalid BingX response");
  } catch {
    return fetchCoinGeckoFallback();
  }
}

async function fetchCoinGeckoFallback(): Promise<Ticker[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1",
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const data = await res.json();
    return data.map(
      (c: {
        symbol: string;
        current_price: number;
        price_change_percentage_24h: number;
        total_volume: number;
      }) => ({
        symbol: `${c.symbol.toUpperCase()}-USDT`,
        lastPrice: c.current_price || 0,
        priceChangePercent: c.price_change_percentage_24h || 0,
        volume: c.total_volume || 0,
      }),
    );
  } catch {
    return getMockTickers();
  }
}

function getMockTickers(): Ticker[] {
  return [
    {
      symbol: "BTC-USDT",
      lastPrice: 68942,
      priceChangePercent: 2.84,
      volume: 48000000000,
    },
    {
      symbol: "ETH-USDT",
      lastPrice: 3521,
      priceChangePercent: 1.95,
      volume: 22000000000,
    },
    {
      symbol: "SOL-USDT",
      lastPrice: 182.5,
      priceChangePercent: 4.21,
      volume: 8500000000,
    },
    {
      symbol: "BNB-USDT",
      lastPrice: 598.3,
      priceChangePercent: 1.12,
      volume: 3200000000,
    },
    {
      symbol: "XRP-USDT",
      lastPrice: 0.624,
      priceChangePercent: -0.87,
      volume: 2900000000,
    },
    {
      symbol: "ADA-USDT",
      lastPrice: 0.489,
      priceChangePercent: 3.45,
      volume: 1800000000,
    },
    {
      symbol: "DOGE-USDT",
      lastPrice: 0.158,
      priceChangePercent: 6.72,
      volume: 4200000000,
    },
    {
      symbol: "AVAX-USDT",
      lastPrice: 38.4,
      priceChangePercent: 5.33,
      volume: 1500000000,
    },
    {
      symbol: "MATIC-USDT",
      lastPrice: 0.92,
      priceChangePercent: -1.22,
      volume: 1100000000,
    },
    {
      symbol: "LINK-USDT",
      lastPrice: 18.7,
      priceChangePercent: 7.81,
      volume: 980000000,
    },
    {
      symbol: "DOT-USDT",
      lastPrice: 8.92,
      priceChangePercent: 2.15,
      volume: 720000000,
    },
    {
      symbol: "UNI-USDT",
      lastPrice: 12.4,
      priceChangePercent: -0.45,
      volume: 650000000,
    },
    {
      symbol: "ATOM-USDT",
      lastPrice: 9.87,
      priceChangePercent: 3.88,
      volume: 590000000,
    },
    {
      symbol: "LTC-USDT",
      lastPrice: 88.3,
      priceChangePercent: 1.67,
      volume: 1200000000,
    },
    {
      symbol: "BCH-USDT",
      lastPrice: 495.2,
      priceChangePercent: 2.91,
      volume: 890000000,
    },
  ];
}

export async function fetchKlines(
  symbol: string,
  interval = "1h",
  limit = 100,
): Promise<Kline[]> {
  try {
    const res = await fetch(
      `${BINGX_BASE_URL}/openApi/swap/v2/quote/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    );
    if (!res.ok) throw new Error("Kline error");
    const data = await res.json();
    if (data?.data && Array.isArray(data.data)) {
      return data.data.map(
        (k: [number, string, string, string, string, string]) => ({
          openTime: k[0],
          open: Number.parseFloat(k[1]),
          high: Number.parseFloat(k[2]),
          low: Number.parseFloat(k[3]),
          close: Number.parseFloat(k[4]),
          volume: Number.parseFloat(k[5]),
        }),
      );
    }
    throw new Error("No kline data");
  } catch {
    return [];
  }
}
