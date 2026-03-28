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

export async function fetchMarketCoins(): Promise<CoinData[]> {
  const MAX_PAGES = 20;
  const PER_PAGE = 100;
  const allCoins: CoinData[] = [];
  const seenSymbols = new Set<string>();
  let consecutiveFailures = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=${PER_PAGE}&page=${page}&sparkline=false`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) break;
        continue;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) break;
        continue;
      }
      consecutiveFailures = 0;
      for (const coin of data) {
        if (!coin.current_price || !coin.total_volume) continue;
        const sym = (coin.symbol as string).toUpperCase();
        if (seenSymbols.has(sym)) continue;
        seenSymbols.add(sym);
        const price = coin.current_price as number;
        const high24h = (coin.high_24h as number) ?? price * 1.03;
        const low24h = (coin.low_24h as number) ?? price * 0.97;
        allCoins.push({
          id: coin.id as string,
          symbol: sym,
          pairSymbol: `${sym}-USDT`,
          price,
          priceChange24h: (coin.price_change_percentage_24h as number) ?? 0,
          volume24h: coin.total_volume as number,
          marketCap: (coin.market_cap as number) ?? 0,
          high24h,
          low24h,
        });
      }
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) break;
    }
  }

  return allCoins;
}
