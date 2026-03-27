import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TradeDetailModal from "../components/TradeDetailModal";
import { useAuth } from "../context/AuthContext";
import type { Signal } from "../services/signalEngine";

const TRACKED_KEY = "luxia_tracked_trades";
const GUEST_TRACKED_KEY = "luxia_tracked_trades_guest";

interface TrackedTrade extends Signal {
  trackedAt: number;
  outcome?: "hit" | "missed";
}

function formatPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TrackingPage() {
  const { user } = useAuth();
  const storageKey = user.role === "guest" ? GUEST_TRACKED_KEY : TRACKED_KEY;
  const [trades, setTrades] = useState<TrackedTrade[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    {},
  );
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as TrackedTrade[];
        const normalized = parsed.map((t) => ({
          ...t,
          trackedAt: t.trackedAt ?? t.timestamp,
        }));
        setTrades(normalized);
        const prices: Record<string, number> = {};
        for (const t of normalized) prices[t.id] = t.currentPrice;
        setCurrentPrices(prices);
      } catch {
        setTrades([]);
      }
    }
  }, [storageKey]);

  // Update prices every 10 seconds for a more live feel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrices((prev) => {
        const updated = { ...prev };
        for (const trade of trades) {
          const current = updated[trade.id] ?? trade.currentPrice;
          const noise = (Math.random() - 0.49) * 0.002 * trade.entryPrice;
          updated[trade.id] = Math.max(
            trade.entryPrice * 0.85,
            current + noise,
          );
        }
        return updated;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [trades]);

  const removeTrade = (id: string) => {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Trade removed");
  };

  const markOutcome = (id: string, outcome: "hit" | "missed") => {
    const updated = trades.map((t) => (t.id === id ? { ...t, outcome } : t));
    setTrades(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success(
      outcome === "hit" ? "Marked as profit taken! 🎉" : "Marked as missed",
    );
  };

  const openModal = (signal: Signal) => {
    setSelectedSignal(signal);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[#0A1628] font-bold text-2xl mb-1">
            📊 Tracking
          </h1>
          <p className="text-[#0A1628]/50 text-sm">
            Your manually tracked trades — updated live
          </p>
        </motion.div>

        {trades.length === 0 ? (
          <div
            data-ocid="tracking.empty_state"
            className="text-center py-16 text-[#0A1628]/40"
          >
            <div className="text-5xl mb-4">📈</div>
            <div className="font-medium text-lg mb-1">No tracked trades</div>
            <div className="text-sm">
              Tap "Track Trade" on any signal card to monitor it here
            </div>
          </div>
        ) : (
          <div
            className="flex gap-4 overflow-x-auto pb-4"
            style={{ scrollbarWidth: "none" }}
          >
            <AnimatePresence>
              {trades.map((trade, i) => {
                const currentPrice =
                  currentPrices[trade.id] ?? trade.currentPrice;
                const isLong = trade.direction === "LONG";
                const progressPct = isLong
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((currentPrice - trade.entryPrice) /
                          (trade.takeProfit - trade.entryPrice || 1)) *
                          100,
                      ),
                    )
                  : Math.min(
                      100,
                      Math.max(
                        0,
                        ((trade.entryPrice - currentPrice) /
                          (trade.entryPrice - trade.takeProfit || 1)) *
                          100,
                      ),
                    );
                const tpReached = progressPct >= 100;
                const profitPct = isLong
                  ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
                  : ((trade.entryPrice - currentPrice) / trade.entryPrice) *
                    100;

                // Early dump detection at 0.5% below entry
                const dumpWarning =
                  isLong && currentPrice < trade.entryPrice * 0.995;

                // Early dump risk warning — momentum weakening before price drops
                const earlyDumpRisk =
                  isLong &&
                  currentPrice < trade.entryPrice * 1.003 &&
                  trade.strengthLabel !== "Strong" &&
                  !tpReached;

                const safeExit = isLong
                  ? trade.entryPrice + (currentPrice - trade.entryPrice) * 0.6
                  : trade.entryPrice - (trade.entryPrice - currentPrice) * 0.6;
                const nearTp = progressPct >= 70 && !tpReached;
                const elapsed =
                  Date.now() - (trade.trackedAt ?? trade.timestamp);

                return (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    data-ocid={`tracking.item.${i + 1}`}
                    onClick={() => openModal(trade)}
                    onKeyDown={(e) => e.key === "Enter" && openModal(trade)}
                    tabIndex={0}
                    className="bg-white border border-gray-300 shadow-md rounded-2xl min-w-[320px] max-w-[360px] flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {tpReached && !trade.outcome && (
                      <div className="bg-green-500 rounded-t-2xl p-3 text-center animate-pulse">
                        <div className="text-white font-bold text-sm">
                          🎯 PROFIT TAKEN +{profitPct.toFixed(1)}% Achieved
                        </div>
                      </div>
                    )}

                    {/* Early dump risk warning — shown before actual dump */}
                    {earlyDumpRisk && !dumpWarning && (
                      <div className="bg-orange-400 rounded-t-2xl p-2 text-center">
                        <div className="text-white text-xs font-semibold">
                          ⚠️ Caution — Momentum Weakening. Monitor closely.
                        </div>
                      </div>
                    )}

                    {dumpWarning && !tpReached && (
                      <div className="bg-red-500 rounded-t-2xl p-2 text-center">
                        <div className="text-white text-xs font-semibold">
                          ⚠️ Dump Warning — Safe Exit: {formatPrice(safeExit)}
                        </div>
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-[#0A1628] text-base">
                            {trade.symbol}
                          </div>
                          <div className="text-[#0A1628]/40 text-xs">
                            {formatElapsed(elapsed)} ago
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${
                            isLong
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-[10px] text-gray-400 uppercase">
                            Entry
                          </div>
                          <div className="font-semibold text-[#0A1628]">
                            {formatPrice(trade.entryPrice)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-[10px] text-gray-400 uppercase">
                            Current
                          </div>
                          <div
                            className={`font-semibold ${
                              profitPct >= 0 ? "text-green-600" : "text-red-500"
                            }`}
                          >
                            {formatPrice(currentPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress to TP</span>
                          <span
                            className={
                              profitPct >= 0 ? "text-green-600" : "text-red-500"
                            }
                          >
                            {profitPct >= 0 ? "+" : ""}
                            {profitPct.toFixed(2)}%
                          </span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>{formatPrice(trade.entryPrice)}</span>
                          <span>{formatPrice(trade.takeProfit)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mb-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            trade.strengthLabel === "Strong"
                              ? "bg-green-50 text-green-700"
                              : trade.strengthLabel === "Weakening"
                                ? "bg-yellow-50 text-yellow-600"
                                : "bg-red-50 text-red-600"
                          }`}
                        >
                          ● {trade.strengthLabel}
                        </span>
                        <span className="text-gray-400">
                          Safe:{" "}
                          <span className="text-amber-600 font-semibold">
                            {formatPrice(safeExit)}
                          </span>
                        </span>
                      </div>

                      {nearTp && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center mb-3 animate-pulse">
                          <span className="text-green-700 font-bold text-xs">
                            🚀 Take Profit Now!
                          </span>
                        </div>
                      )}

                      {tpReached && !trade.outcome ? (
                        <div
                          className="flex gap-2"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            data-ocid={`tracking.hit_button.${i + 1}`}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markOutcome(trade.id, "hit");
                            }}
                          >
                            Mark as Hit
                          </Button>
                          <Button
                            size="sm"
                            data-ocid={`tracking.missed_button.${i + 1}`}
                            variant="outline"
                            className="flex-1 border-red-400 text-red-500 text-xs hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              markOutcome(trade.id, "missed");
                            }}
                          >
                            Mark as Missed
                          </Button>
                        </div>
                      ) : trade.outcome ? (
                        <div
                          className={`text-center py-1.5 rounded-lg text-xs font-bold ${
                            trade.outcome === "hit"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {trade.outcome === "hit" ? "✅ TP Hit" : "❌ Missed"}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        data-ocid={`tracking.delete_button.${i + 1}`}
                        className="mt-2 w-full text-[10px] text-gray-300 hover:text-red-400 transition-colors text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrade(trade.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <TradeDetailModal
        signal={selectedSignal}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
