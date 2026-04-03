export interface CoinData {
  id: string;
  symbol: string;
  pairSymbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
}

const COINGECKO_BASES = [
  "https://api.coingecko.com/api/v3",
  "https://api.coingecko.com/api/v3",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(page: number, retries = 3): Promise<CoinData[]> {
  const PER_PAGE = 250;
  const url = `${COINGECKO_BASES[0]}/coins/markets?vs_currency=usd&order=volume_desc&per_page=${PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 429) {
        await sleep(attempt * 2000);
        continue;
      }
      if (!res.ok) {
        if (attempt < retries) {
          await sleep(1000);
          continue;
        }
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return [];

      return data
        .filter(
          (coin: Record<string, unknown>) =>
            coin.current_price && coin.total_volume,
        )
        .map((coin: Record<string, unknown>) => {
          const sym = ((coin.symbol as string) ?? "").toUpperCase();
          const price = coin.current_price as number;
          const high24h = (coin.high_24h as number) ?? price * 1.03;
          const low24h = (coin.low_24h as number) ?? price * 0.97;
          return {
            id: coin.id as string,
            symbol: sym,
            pairSymbol: `${sym}-USDT`,
            price,
            priceChange24h: (coin.price_change_percentage_24h as number) ?? 0,
            volume24h: coin.total_volume as number,
            marketCap: (coin.market_cap as number) ?? 0,
            high24h,
            low24h,
          };
        });
    } catch {
      if (attempt < retries) await sleep(1000 * attempt);
    }
  }
  return [];
}

export async function fetchMarketCoins(
  onProgress?: (loaded: number) => void,
): Promise<CoinData[]> {
  const MAX_PAGES = 40;
  const allCoins: CoinData[] = [];
  const seenSymbols = new Set<string>();
  let emptyPages = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageCoins = await fetchPage(page);

    if (pageCoins.length === 0) {
      emptyPages++;
      if (emptyPages >= 2) break;
      await sleep(1500);
      continue;
    }

    emptyPages = 0;
    for (const coin of pageCoins) {
      if (!seenSymbols.has(coin.symbol)) {
        seenSymbols.add(coin.symbol);
        allCoins.push(coin);
      }
    }

    if (onProgress) onProgress(allCoins.length);

    if (page < MAX_PAGES) await sleep(700);
  }

  return allCoins;
}

/**
 * Fetch real 24h OHLCV candles from CoinGecko for a given coinId.
 * Returns null on failure so callers can gracefully fall back to synthetic data.
 */
export async function fetchRealOHLCV(coinId: string): Promise<Array<{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data: number[][] = await res.json();
    if (!Array.isArray(data) || data.length < 5) return null;
    return data.map((c) => ({
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: 0,
    }));
  } catch {
    return null;
  }
}
