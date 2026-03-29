import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import LiveSignalCard from "../components/LiveSignalCard";
import { CreditLockout, useCredits } from "../context/CreditContext";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";

interface Props {
  type: "fast" | "tradeNow" | "active" | "highProfit" | "superHighProfit";
  title: string;
  subtitle: string;
  icon: string;
}

type SortKey =
  | "composite"
  | "profit"
  | "confidence"
  | "tpProbability"
  | "guaranteedFirst";

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  {
    key: "composite",
    label: "Composite (Recommended)",
    desc: "Profit · Confidence · TP Probability",
  },
  {
    key: "profit",
    label: "Highest Profit %",
    desc: "Largest gain if TP is hit",
  },
  {
    key: "confidence",
    label: "Highest Confidence",
    desc: "Strongest signal score",
  },
  {
    key: "tpProbability",
    label: "Best TP Probability",
    desc: "Most likely to hit take-profit",
  },
  {
    key: "guaranteedFirst",
    label: "Guaranteed Hits First",
    desc: "GUARANTEED HIT signals first, sorted by highest profit",
  },
];

function profitPct(s: Signal) {
  return (s.takeProfit - s.entryPrice) / (s.entryPrice || 1);
}

function compositeScore(s: Signal) {
  return (
    profitPct(s) * 0.4 +
    (s.confidence / 100) * 0.3 +
    ((s.tpProbability ?? 0) / 100) * 0.3
  );
}

function sortSignals(signals: Signal[], key: SortKey): Signal[] {
  const arr = signals.slice();
  switch (key) {
    case "profit":
      return arr.sort((a, b) => profitPct(b) - profitPct(a));
    case "confidence":
      return arr.sort((a, b) => b.confidence - a.confidence);
    case "tpProbability":
      return arr.sort(
        (a, b) => (b.tpProbability ?? 0) - (a.tpProbability ?? 0),
      );
    case "guaranteedFirst": {
      const guaranteed = arr
        .filter((s) => s.guaranteedHit)
        .sort((a, b) => profitPct(b) - profitPct(a));
      const rest = arr.filter((s) => !s.guaranteedHit);
      return [...guaranteed, ...rest];
    }
    default:
      return arr.sort((a, b) => compositeScore(b) - compositeScore(a));
  }
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
    case "superHighProfit":
      return signals
        .filter((s) => s.superHighProfit)
        .sort((a, b) => profitPct(b) - profitPct(a));
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
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const filtered = filterSignals(signals, type);
  const sorted = sortSignals(filtered, sortKey);

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

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

          {/* Stats + Sort row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium text-xs">
              {filtered.length} signals found
            </span>
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium text-xs">
              {progress.scanned} coins scanned
            </span>
            {scanning && (
              <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-medium text-xs animate-pulse">
                Updating...
              </span>
            )}

            {/* Sort button */}
            <div ref={dropdownRef} className="relative ml-auto">
              <button
                type="button"
                data-ocid="signal.sort_button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#0A1628]/20 bg-white text-[#0A1628] text-xs font-medium shadow-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors"
              >
                <SlidersHorizontal size={13} />
                <span>Sort</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    data-ocid="signal.sort_panel"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#0A1628]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-[#0A1628]/10 bg-[#0A1628]/[0.03]">
                      <p className="text-[#0A1628] font-semibold text-xs uppercase tracking-wider">
                        Sort Signals
                      </p>
                    </div>
                    <div className="py-1.5">
                      {SORT_OPTIONS.map((opt) => {
                        const selected = sortKey === opt.key;
                        return (
                          <button
                            type="button"
                            key={opt.key}
                            data-ocid={`signal.sort.${opt.key}.button`}
                            onClick={() => {
                              setSortKey(opt.key);
                              setDropdownOpen(false);
                            }}
                            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors text-left"
                          >
                            {/* Radio dot */}
                            <span
                              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selected
                                  ? "border-[#C9A84C] bg-[#C9A84C]/10"
                                  : "border-[#0A1628]/25"
                              }`}
                            >
                              {selected && (
                                <span className="w-2 h-2 rounded-full bg-[#C9A84C] block" />
                              )}
                            </span>
                            <div>
                              <p
                                className={`text-xs font-semibold leading-tight ${
                                  selected ? "text-[#C9A84C]" : "text-[#0A1628]"
                                }`}
                              >
                                {opt.label}
                              </p>
                              <p className="text-[10px] text-[#0A1628]/40 mt-0.5">
                                {opt.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="px-4 py-2 border-t border-[#0A1628]/10 bg-[#0A1628]/[0.02]">
                      <p className="text-[10px] text-[#0A1628]/30">
                        Active:{" "}
                        <span className="text-[#C9A84C] font-medium">
                          {activeSortLabel}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {sorted.length === 0 ? (
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
            {sorted.map((sig, i) => (
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
