import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Signal, generateSignals } from "../services/signalEngine";

interface ScanContextValue {
  signals: Signal[];
  scanning: boolean;
  progress: { scanned: number; total: number };
  totalSessionScans: number;
  rescan: () => void;
  lastScan: Date | null;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ scanned: 0, total: 2000 });
  const [totalSessionScans, setTotalSessionScans] = useState(0);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const scanningRef = useRef(false);

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

  // Initial scan on mount only — no auto-scan interval
  useEffect(() => {
    rescan();
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
