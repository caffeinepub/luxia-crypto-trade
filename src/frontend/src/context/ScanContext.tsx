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
import { fetchMarketCoins } from "../services/marketData";
import {
  type Signal,
  enrichSignalsWithAI,
  generateSignals,
} from "../services/signalEngine";
import { useCredits } from "./CreditContext";

interface ScanContextValue {
  signals: Signal[];
  scanning: boolean;
  aiEnriching: boolean;
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
  const [aiEnriching, setAiEnriching] = useState(false);
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
    setAiEnriching(false);
    setProgress({ scanned: 0, total: 5000 });

    try {
      const coins = await fetchMarketCoins((loaded) => {
        setProgress({ scanned: loaded, total: 5000 });
      });

      if (coins.length === 0) {
        toast.error(
          "Could not fetch market data. Please try again in a moment.",
        );
        return;
      }

      const generated = generateSignals(coins);
      setProgress({ scanned: coins.length, total: coins.length });

      // Show preliminary signals immediately so UI isn't blank
      setSignals(generated);
      setScanning(false);

      if (generated.length === 0) {
        toast.info(
          `Scanned ${coins.length} coins — no signals passed filters this hour. Rescanning shortly.`,
        );
        setLastScan(new Date());
        setTotalSessionScans((prev) => prev + 1);
        return;
      }

      toast.success(
        `Found ${generated.length} signals from ${coins.length} coins — AI validating...`,
      );

      // Phase 2: AI enrichment
      setAiEnriching(true);
      try {
        const enriched = await enrichSignalsWithAI(generated);
        setSignals(enriched);
        const aiCount = enriched.filter((s) => s.aiEnriched).length;
        const skipped = generated.length - enriched.length;
        toast.success(
          `🤖 AI validated ${aiCount} signals${skipped > 0 ? `, filtered ${skipped} weak signals` : ""}`,
        );
      } catch {
        // Keep un-enriched signals if AI fails
        toast.info("AI enrichment unavailable — showing technical signals");
      } finally {
        setAiEnriching(false);
      }

      setLastScan(new Date());
      setTotalSessionScans((prev) => prev + 1);
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Scan failed. Retrying...");
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  }, [spendCredit]);

  const rescanRef = useRef(rescan);
  rescanRef.current = rescan;
  useEffect(() => {
    rescanRef.current();
  }, []);

  // Live price monitor — update prices from CoinGecko every 60 seconds
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
        aiEnriching,
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
