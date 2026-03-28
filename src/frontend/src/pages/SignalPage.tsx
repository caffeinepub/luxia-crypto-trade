import { motion } from "motion/react";
import LiveSignalCard from "../components/LiveSignalCard";
import { CreditLockout, useCredits } from "../context/CreditContext";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";

interface Props {
  type: "fast" | "tradeNow" | "active" | "highProfit";
  title: string;
  subtitle: string;
  icon: string;
}

function filterSignals(signals: Signal[], type: Props["type"]): Signal[] {
  switch (type) {
    case "tradeNow":
      return signals.filter(
        (s) =>
          Math.abs(s.currentPrice - s.entryPrice) / (s.entryPrice || 1) <=
          0.015,
      );
    case "active":
      return signals.filter((s) => s.confidence >= 85);
    case "highProfit":
      return signals
        .slice()
        .sort(
          (a, b) =>
            (b.takeProfit - b.entryPrice) / (b.entryPrice || 1) -
            (a.takeProfit - a.entryPrice) / (a.entryPrice || 1),
        )
        .slice(0, 6);
    case "fast":
      return signals.filter(
        (s) =>
          s.action === "BUY" &&
          s.estimatedHours <= 6 &&
          (s.takeProfit - s.entryPrice) / (s.entryPrice || 1) <= 0.1,
      );
    default:
      return signals;
  }
}

export default function SignalPage({ type, title, subtitle, icon }: Props) {
  const { signals, scanning, progress } = useScan();
  const { isLocked } = useCredits();
  const filtered = filterSignals(signals, type);

  if (isLocked) return <CreditLockout />;

  if (scanning && signals.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="text-6xl animate-pulse">{icon}</div>
        <div className="text-center">
          <h2 className="text-[#0A1628] font-bold text-xl mb-2">
            Scanning Markets
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
        <p className="text-[#0A1628]/30 text-xs">
          Please wait while we fetch live market data...
        </p>
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
            <span className="text-3xl">{icon}</span>
            <h1 className="text-[#0A1628] font-bold text-2xl">{title}</h1>
          </div>
          <p className="text-[#0A1628]/50 text-sm mb-3">
            {type === "fast" ? "TP target in under 6 hours" : subtitle}
          </p>
          <div className="flex items-center gap-3 text-xs text-[#0A1628]/40">
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
              {filtered.length} signals found
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
            <div className="text-5xl mb-4">{icon}</div>
            <div className="font-medium text-lg mb-1">
              No signals available yet
            </div>
            <div className="text-sm">
              {scanning
                ? "Scanning in progress..."
                : "Markets are being analyzed. Try rescanning."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sig, i) => (
              <div key={sig.id} className="w-full">
                <LiveSignalCard signal={sig} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
