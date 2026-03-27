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
import { type Signal, generateSignals } from "../services/signalEngine";

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
  const [progress, setProgress] = useState({ scanned: 0, total: 2000 });
  const [totalSessionScans, setTotalSessionScans] = useState(0);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const scanningRef = useRef(false);
  const rescanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSignalPrice = useCallback((id: string, price: number) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === id ? { ...s, currentPrice: price } : s)),
    );
  }, []);

  const rescan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setProgress({ scanned: 0, total: 2000 });

    try {
      const MAX_PAGES = 20;
      const PER_PAGE = 100;
      const allCoins: import("../services/marketData").CoinData[] = [];
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
            allCoins.push({
              id: coin.id as string,
              symbol: sym,
              pairSymbol: `${sym}-USDT`,
              price: coin.current_price as number,
              priceChange24h: (coin.price_change_percentage_24h as number) ?? 0,
              volume24h: coin.total_volume as number,
              marketCap: (coin.market_cap as number) ?? 0,
            });
          }
          setProgress({ scanned: page * PER_PAGE, total: 2000 });
        } catch {
          consecutiveFailures++;
          if (consecutiveFailures >= 3) break;
        }
      }

      const generated = generateSignals(allCoins);
      setSignals(generated);
      setProgress({ scanned: allCoins.length, total: 2000 });
      setLastScan(new Date());
      setTotalSessionScans((prev) => prev + 1);
    } catch {
      // keep previous signals
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  }, []);

  // Initial scan on mount only
  useEffect(() => {
    rescan();
  }, [rescan]);

  // Live price monitor — check TP/SL every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals((prev) => {
        const toRemove: string[] = [];
        const updated = prev.map((signal) => {
          // Simulate small price movement (noise)
          const noise = 1 + (Math.random() - 0.48) * 0.008;
          const updatedPrice =
            (signal.currentPrice ?? signal.entryPrice) * noise;
          const isLong = signal.direction === "LONG";

          // TP hit detection
          if (
            (isLong && updatedPrice >= signal.takeProfit) ||
            (!isLong && updatedPrice <= signal.takeProfit)
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
            // Schedule rescan after removal
            if (rescanTimeoutRef.current)
              clearTimeout(rescanTimeoutRef.current);
            rescanTimeoutRef.current = setTimeout(() => rescan(), 3000);
            return signal;
          }

          // SL hit detection
          if (
            (isLong && updatedPrice <= signal.stopLoss) ||
            (!isLong && updatedPrice >= signal.stopLoss)
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

          return { ...signal, currentPrice: updatedPrice };
        });

        if (toRemove.length > 0) {
          return updated.filter((s) => !toRemove.includes(s.id));
        }
        return updated;
      });
    }, 30000);

    return () => {
      clearInterval(interval);
      if (rescanTimeoutRef.current) clearTimeout(rescanTimeoutRef.current);
    };
  }, [rescan]);

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
