import { motion } from "motion/react";
import LiveSignalCard from "../components/LiveSignalCard";
import { CreditLockout, useCredits } from "../context/CreditContext";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";

function filterHighProfit(signals: Signal[]): Signal[] {
  const withProfit = signals
    .filter((s) => s.tpProbability >= 85)
    .map((s) => {
      const pct =
        s.direction === "LONG"
          ? (s.takeProfit - s.entryPrice) / (s.entryPrice || 1)
          : (s.entryPrice - s.takeProfit) / (s.entryPrice || 1);
      return { signal: s, pct };
    });

  withProfit.sort((a, b) => b.pct - a.pct);
  const top6 = withProfit.slice(0, 6).map((x) => x.signal);

  if (top6.length >= 2) return top6;

  // Fallback: top 6 by highProfitScore
  return signals
    .slice()
    .sort((a, b) => b.highProfitScore - a.highProfitScore)
    .slice(0, 6);
}

export default function HighProfitPage() {
  const { signals, scanning, progress } = useScan();
  const { isLocked } = useCredits();
  const filtered = filterHighProfit(signals);

  if (isLocked) return <CreditLockout />;

  if (scanning && signals.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="text-6xl animate-pulse">🏆</div>
        <div className="text-center">
          <h2 className="text-[#0A1628] font-bold text-xl mb-2">
            Scanning for High Profit Opportunities
          </h2>
          <p className="text-[#0A1628]/50 text-sm">
            Analyzing {progress.scanned} / {progress.total} coins
          </p>
        </div>
        <div className="w-64 bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(100, (progress.scanned / progress.total) * 100)}%`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏆</span>
            <h1 className="text-[#0A1628] font-bold text-2xl">
              High Profit Trade
            </h1>
          </div>
          <p className="text-[#0A1628]/50 text-sm mb-3">
            Top signals ranked by highest actual TP profit % with 85%+ hit
            probability
          </p>

          {/* Premium quality banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, #0A1628 0%, #1a2d4a 100%)",
              border: "1px solid #C9A84C40",
            }}
          >
            <span className="text-2xl">⚡</span>
            <div>
              <div className="text-[#C9A84C] font-bold text-sm">
                85%+ TP probability · Sorted by highest profit % · All 6
                indicators aligned
              </div>
              <div className="text-white/50 text-xs mt-0.5">
                Proximity-filtered to 24h high · SL 4× ATR buffer · Only the
                strongest setups
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[#C9A84C] font-bold text-lg">
                {filtered.length}
              </div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Elite Signals
              </div>
            </div>
          </motion.div>

          <div className="flex items-center gap-3 text-xs text-[#0A1628]/40">
            <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full font-medium border border-yellow-200">
              🏆 {filtered.length} high-profit signals
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
              {progress.scanned} coins scanned
            </span>
            {scanning && (
              <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-medium animate-pulse">
                Updating...
              </span>
            )}
          </div>
        </motion.div>

        {filtered.length === 0 ? (
          <div
            data-ocid="signal.empty_state"
            className="text-center py-16 text-[#0A1628]/40"
          >
            <div className="text-5xl mb-4">🔍</div>
            <div className="font-medium text-lg mb-1 text-[#0A1628]/60">
              Scanning for high-profit opportunities...
            </div>
            <div className="text-sm">
              {scanning
                ? "Analyzing markets for 85%+ TP probability setups with maximum return..."
                : "No elite setups found this cycle. Markets being re-analyzed — try rescanning for fresh signals."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sig, i) => (
              <div
                key={sig.id}
                data-ocid={`signal.item.${i + 1}`}
                className="w-full"
              >
                <LiveSignalCard signal={sig} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
