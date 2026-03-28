import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { recordOutcome } from "../services/aiLearning";
import { fetchCoinGeckoPageViaBackend } from "../services/backendStorage";
import { type Signal, generateSignals } from "../services/signalEngine";
import { useCredits } from "./CreditContext";

interface ScanContextValue {
  signals: Signal[];
  scanning: boolean;
  progress: { scanned: number; total: number };
  totalSessionScans: number;
  rescan: () => void;
  lastScan: Date | null;
  updateSignalPrice: (id: string, price: number) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, total: 5000 });
  const [totalSessionScans, setTotalSessionScans] = useState(0);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const scanningRef = useRef(false);
  const rescanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { spendCredit } = useCredits();

  const updateSignalPrice = useCallback((id: string, price: number) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, currentPrice: price } : s)),
    );
  }, []);

  const rescan = useCallback(async () => {
    if (scanningRef.current) return;

    const allowed = spendCredit();
    if (!allowed) {
      toast.error(
        "No credits remaining — contact the founder to purchase more",
        { duration: 5000 },
      );
      return;
    }

    scanningRef.current = true;
    setScanning(true);
    setProgress({ scanned: 0, total: 5000 });

    try {
      const MAX_PAGES = 50;
      const PER_PAGE = 100;
      const allCoins: import("../services/marketData").CoinData[] = [];
      const seenSymbols = new Set<string>();
      let consecutiveFailures = 0;

      for (let page = 1; page <= MAX_PAGES; page++) {
        let data: any[] = [];

        // Try backend route first (avoids CORS/rate limits)
        try {
          const backendData = await fetchCoinGeckoPageViaBackend(page);
          if (Array.isArray(backendData) && backendData.length > 0) {
            data = backendData;
          }
        } catch {}

        // Fallback to direct fetch if backend returned nothing
        if (data.length === 0) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=${PER_PAGE}&page=${page}&sparkline=false`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
              const fetched = await res.json();
              if (Array.isArray(fetched)) data = fetched;
            }
          } catch {}
        }

        if (data.length === 0) {
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
          allCoins.push({
            id: coin.id as string,
            symbol: sym,
            pairSymbol: `${sym}-USDT`,
            price: coin.current_price as number,
            priceChange24h: (coin.price_change_percentage_24h as number) ?? 0,
            volume24h: coin.total_volume as number,
            marketCap: (coin.market_cap as number) ?? 0,
            high24h:
              (coin.high_24h as number) ??
              (coin.current_price as number) * 1.03,
            low24h:
              (coin.low_24h as number) ?? (coin.current_price as number) * 0.97,
          });
        }
        setProgress({ scanned: page * PER_PAGE, total: 5000 });
      }

      const generated = generateSignals(allCoins);
      setSignals(generated);
      setProgress({ scanned: allCoins.length, total: 5000 });
      setLastScan(new Date());
      setTotalSessionScans((prev) => prev + 1);
    } catch {
      // keep previous signals
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  }, [spendCredit]);

  // Initial scan on mount only
  useEffect(() => {
    rescan();
  }, [rescan]);

  // Live price monitor — fetch real prices from CoinGecko every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (signals.length === 0) return;

      const coinIds = [...new Set(signals.map((s) => s.coinId))].slice(0, 50);
      if (coinIds.length === 0) return;

      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const priceData = await res.json();

        setSignals((prev) => {
          const toRemove: string[] = [];
          const updated = prev.map((signal) => {
            const realPrice = priceData[signal.coinId]?.usd;
            if (!realPrice) return signal;

            const isLong = signal.direction === "LONG";

            if (
              (isLong && realPrice >= signal.takeProfit) ||
              (!isLong && realPrice <= signal.takeProfit)
            ) {
              recordOutcome({
                id: signal.id,
                symbol: signal.symbol,
                direction: signal.direction,
                confidence: signal.confidence,
                tpProbability: signal.tpProbability,
                outcome: "hit",
                timestamp: Date.now(),
              });
              toast.success(
                `🎯 ${signal.symbol} hit Take Profit! Finding new signal...`,
              );
              toRemove.push(signal.id);
              if (rescanTimeoutRef.current)
                clearTimeout(rescanTimeoutRef.current);
              rescanTimeoutRef.current = setTimeout(() => rescan(), 3000);
              return signal;
            }

            if (
              (isLong && realPrice <= signal.stopLoss) ||
              (!isLong && realPrice >= signal.stopLoss)
            ) {
              recordOutcome({
                id: signal.id,
                symbol: signal.symbol,
                direction: signal.direction,
                confidence: signal.confidence,
                tpProbability: signal.tpProbability,
                outcome: "missed",
                timestamp: Date.now(),
              });
              toast.error(
                `⚠️ ${signal.symbol} hit Stop Loss. AI learning from this...`,
              );
              toRemove.push(signal.id);
              return signal;
            }

            return { ...signal, currentPrice: realPrice };
          });

          if (toRemove.length > 0) {
            return updated.filter((s) => !toRemove.includes(s.id));
          }
          return updated;
        });
      } catch {
        // Keep current prices if fetch fails
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      if (rescanTimeoutRef.current) clearTimeout(rescanTimeoutRef.current);
    };
  }, [signals, rescan]);

  return (
    <ScanContext.Provider
      value={{
        signals,
        scanning,
        progress,
        totalSessionScans,
        rescan,
        lastScan,
        updateSignalPrice,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be inside ScanProvider");
  return ctx;
}
