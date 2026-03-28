import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion } from "motion/react";
import { useState } from "react";
import LiveSignalCard from "../components/LiveSignalCard";
import { useScan } from "../context/ScanContext";
import type { CoinData } from "../services/marketData";
import type { Signal } from "../services/signalEngine";
import { generateSignals } from "../services/signalEngine";

type SearchState =
  | "idle"
  | "scanning"
  | "found"
  | "no_opportunity"
  | "not_found"
  | "rate_limited";

export default function SearchPage() {
  const { signals } = useScan();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<Signal | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanningLabel, setScanningLabel] = useState("");

  const doSearch = async () => {
    if (!query.trim()) return;
    const q = query.trim().toUpperCase();
    setState("scanning");
    setProgress(0);
    setResult(null);

    // Step 1: Check loaded signals first
    setScanningLabel(`Checking loaded signals for ${q}...`);
    setProgress(30);
    const found = signals.find(
      (s) =>
        s.symbol.toUpperCase().includes(q) ||
        s.coinId.toUpperCase().includes(q),
    );

    if (found) {
      setProgress(100);
      setState("found");
      setResult(found);
      return;
    }

    // Step 2: Live fetch
    setScanningLabel(`Scanning ${q} on CoinGecko...`);
    setProgress(60);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${q.toLowerCase()}&sparkline=false`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (res.status === 429) {
        setState("rate_limited");
        return;
      }

      if (!res.ok) {
        setState("not_found");
        return;
      }

      const data = await res.json();
      setScanningLabel(`Generating signal for ${q}...`);
      setProgress(85);

      if (!Array.isArray(data) || data.length === 0) {
        // Try by symbol search
        const res2 = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=250&page=1&sparkline=false",
          { signal: new AbortController().signal },
        );
        if (!res2.ok) {
          setState("not_found");
          return;
        }
        const data2 = await res2.json();
        const coin = (
          data2 as {
            symbol: string;
            current_price: number;
            total_volume: number;
            price_change_percentage_24h: number;
            market_cap: number;
            id: string;
          }[]
        ).find((c) => c.symbol.toUpperCase() === q);
        if (!coin) {
          setState("not_found");
          return;
        }
        const coinData: CoinData = {
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          pairSymbol: `${coin.symbol.toUpperCase()}-USDT`,
          price: coin.current_price,
          priceChange24h: coin.price_change_percentage_24h ?? 0,
          volume24h: coin.total_volume,
          marketCap: coin.market_cap ?? 0,
          high24h: (coin as any).high_24h ?? coin.current_price * 1.03,
          low24h: (coin as any).low_24h ?? coin.current_price * 0.97,
        };
        const sigs = generateSignals([coinData]);
        setProgress(100);
        if (sigs.length > 0) {
          setState("found");
          setResult(sigs[0]);
        } else {
          setState("no_opportunity");
        }
        return;
      }

      const raw = data[0] as {
        symbol: string;
        current_price: number;
        total_volume: number;
        price_change_percentage_24h: number;
        market_cap: number;
        id: string;
      };
      const coinData: CoinData = {
        id: raw.id,
        symbol: raw.symbol.toUpperCase(),
        pairSymbol: `${raw.symbol.toUpperCase()}-USDT`,
        price: raw.current_price,
        priceChange24h: raw.price_change_percentage_24h ?? 0,
        volume24h: raw.total_volume,
        marketCap: raw.market_cap ?? 0,
        high24h: (raw as any).high_24h ?? raw.current_price * 1.03,
        low24h: (raw as any).low_24h ?? raw.current_price * 0.97,
      };
      const sigs = generateSignals([coinData]);
      setProgress(100);
      if (sigs.length > 0) {
        setState("found");
        setResult(sigs[0]);
      } else {
        setState("no_opportunity");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState("rate_limited");
      } else {
        setState("not_found");
      }
    }
  };

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[#0A1628] font-bold text-2xl mb-1">🔍 Search</h1>
          <p className="text-[#0A1628]/50 text-sm">
            Find a trade signal for any crypto
          </p>
        </motion.div>

        <div className="flex gap-2 mb-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Enter coin name or symbol (e.g. BTC, ETH)"
            data-ocid="search.input"
            className="flex-1 border-gray-300 focus:border-[#C9A84C]"
          />
          <Button
            onClick={doSearch}
            disabled={state === "scanning"}
            data-ocid="search.button"
            className="bg-[#0A1628] text-white hover:bg-[#0A1628]/80"
          >
            Scan
          </Button>
        </div>

        {state === "scanning" && (
          <div className="mb-4">
            <div className="text-sm text-[#0A1628]/60 mb-2">
              {scanningLabel}
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {state === "found" && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {result.confidence < 85 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-yellow-700 text-sm font-medium">
                ⚠️ Low Confidence Signal — trade with caution
              </div>
            )}
            <LiveSignalCard signal={result} />
          </motion.div>
        )}

        {state === "no_opportunity" && (
          <div
            data-ocid="search.no_opportunity.card"
            className="text-center py-12 text-[#0A1628]/50"
          >
            <div className="text-4xl mb-3">📊</div>
            <div className="font-medium">No trade opportunity available</div>
            <div className="text-sm mt-1">
              This coin doesn't meet signal criteria right now
            </div>
          </div>
        )}

        {state === "not_found" && (
          <div
            data-ocid="search.not_found.card"
            className="text-center py-12 text-[#0A1628]/50"
          >
            <div className="text-4xl mb-3">❌</div>
            <div className="font-medium">Coin not found on BingX</div>
            <div className="text-sm mt-1">
              Make sure you entered the correct symbol
            </div>
          </div>
        )}

        {state === "rate_limited" && (
          <div
            data-ocid="search.rate_limited.card"
            className="text-center py-12 text-amber-600"
          >
            <div className="text-4xl mb-3">⏳</div>
            <div className="font-medium">Data Limit Reached</div>
            <div className="text-sm mt-1 text-[#0A1628]/50">
              Wait 30 seconds and try again
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
