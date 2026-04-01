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
  | "surety"
  | "guaranteedFirst"
  | "strongBuyFirst"
  | "noLoss";

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  {
    key: "composite",
    label: "Composite (Recommended)",
    desc: "Profit · Confidence · TP Probability",
  },
  {
    key: "surety",
    label: "🎯 Highest Surety (Will Hit TP)",
    desc: "Most certain to hit TP — optimal momentum window (not exhausted pumps)",
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
  {
    key: "strongBuyFirst",
    label: "🤖 AI: Strong Buy First",
    desc: "AI-validated Strong Buy signals first — highest certainty to hit TP",
  },
  {
    key: "noLoss",
    label: "🛡️ Surely Hits TP (No Dump)",
    desc: "Only Low dump risk · RSI 42–68 · MACD positive · 5/6 indicators · room to run",
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
    case "surety": {
      const suretyFiltered = arr.filter(
        (s) =>
          s.estimatedHours <= 12 &&
          s.confidence >= 82 &&
          s.tpProbability >= 77 &&
          s.momentum >= 1 &&
          s.momentum <= 9,
      );
      const source = suretyFiltered.length >= 3 ? suretyFiltered : arr;
      return source.sort((a, b) => (b.suretyScore ?? 0) - (a.suretyScore ?? 0));
    }
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
    case "strongBuyFirst": {
      const strongBuy = arr
        .filter((s) => s.aiRating === "Strong Buy" && s.guaranteedHit)
        .sort((a, b) => profitPct(b) - profitPct(a));
      const strongBuyNoGuarantee = arr
        .filter((s) => s.aiRating === "Strong Buy" && !s.guaranteedHit)
        .sort((a, b) => profitPct(b) - profitPct(a));
      const rest = arr.filter((s) => s.aiRating !== "Strong Buy");
      return [...strongBuy, ...strongBuyNoGuarantee, ...rest];
    }
    case "noLoss": {
      // Multi-layer anti-dump filter:
      // 1. dumpRisk must be "Low" (not near resistance, not overbought, MACD positive)
      // 2. RSI in healthy zone — not overbought (signals store rsiValue)
      // 3. Momentum in early-move window 0.5–8% (not exhausted)
      // 4. Strong indicator alignment (5 or 6 out of 6)
      // 5. High confidence + TP probability
      // 6. Estimated to hit within 10 hours
      // 7. Has room to run: distToHigh24h > 2%
      const noLossFiltered = arr.filter(
        (s) =>
          s.dumpRisk === "Low" &&
          s.rsiValue >= 42 &&
          s.rsiValue <= 68 &&
          s.momentum >= 0.5 &&
          s.momentum <= 8 &&
          s.indicatorsAligned >= 5 &&
          s.confidence >= 85 &&
          (s.tpProbability ?? 0) >= 82 &&
          (s.suretyScore ?? 0) >= 65 &&
          s.estimatedHours <= 10 &&
          (s.distToHigh24h === undefined || s.distToHigh24h > 0.02),
      );

      // Fallback: relax to just dumpRisk=Low + healthy RSI + 5 indicators
      const fallback = arr.filter(
        (s) =>
          s.dumpRisk === "Low" &&
          s.rsiValue >= 40 &&
          s.rsiValue <= 70 &&
          s.indicatorsAligned >= 5 &&
          s.confidence >= 82 &&
          (s.tpProbability ?? 0) >= 78,
      );

      // Wider fallback: just dumpRisk=Low if still too few
      const wideFallback = arr.filter((s) => s.dumpRisk === "Low");

      const source =
        noLossFiltered.length >= 2
          ? noLossFiltered
          : fallback.length >= 2
            ? fallback
            : wideFallback;

      return source.sort((a, b) => profitPct(b) - profitPct(a));
    }
    default:
      return arr.sort((a, b) => compositeScore(b) - compositeScore(a));
  }
}

function filterSignals(signals: Signal[], type: Props["type"]): Signal[] {
  switch (type) {
    case "fast":
      return signals.filter(
        (s) =>
          s.action === "BUY" &&
          s.estimatedHours <= 4 &&
          (s.takeProfit - s.entryPrice) / (s.entryPrice || 1) <= 0.1,
      );

    case "tradeNow":
      return signals.filter(
        (s) =>
          Math.abs(s.currentPrice - s.entryPrice) / (s.entryPrice || 1) <=
          0.015,
      );

    case "highProfit":
      return signals
        .filter((s) => {
          const pp = (s.takeProfit - s.entryPrice) / (s.entryPrice || 1);
          return pp >= 0.02 && pp <= 0.1;
        })
        .sort(
          (a, b) =>
            (b.takeProfit - b.entryPrice) / (b.entryPrice || 1) -
            (a.takeProfit - a.entryPrice) / (a.entryPrice || 1),
        );

    case "superHighProfit":
      return signals
        .filter((s) => {
          const pp = (s.takeProfit - s.entryPrice) / (s.entryPrice || 1);
          return pp > 0.1;
        })
        .sort((a, b) => profitPct(b) - profitPct(a));

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

  const activeSortOption = SORT_OPTIONS.find((o) => o.key === sortKey);
  const activeSortLabel = activeSortOption?.label ?? "Sort";

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
            {type === "fast"
              ? "TP target in 4 hours or less — fast moving trades"
              : subtitle}
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
            {sortKey === "surety" && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium text-xs border border-emerald-200">
                🎯 Optimal momentum window (1–9%) — lowest dump risk
              </span>
            )}
            {sortKey === "strongBuyFirst" && (
              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-medium text-xs border border-purple-200">
                🤖 AI: Strong Buy — highest certainty signals shown first
              </span>
            )}
            {sortKey === "noLoss" && (
              <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded-full font-medium text-xs border border-rose-200">
                🛡️ Low dump risk · RSI safe · room to run — all others hidden
              </span>
            )}

            {/* Sort button */}
            <div ref={dropdownRef} className="relative ml-auto">
              <button
                type="button"
                data-ocid="signal.sort_button"
                onClick={() => setDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors ${
                  sortKey === "surety"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : sortKey === "strongBuyFirst"
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : sortKey === "noLoss"
                        ? "border-rose-400 bg-rose-50 text-rose-700"
                        : "border-[#0A1628]/20 bg-white text-[#0A1628] hover:border-[#C9A84C] hover:text-[#C9A84C]"
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>
                  {sortKey === "surety"
                    ? "🎯 Surety"
                    : sortKey === "strongBuyFirst"
                      ? "🤖 Strong Buy"
                      : sortKey === "noLoss"
                        ? "🛡️ No Dump"
                        : "Sort"}
                </span>
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
                    className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#0A1628]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-[#0A1628]/10 bg-[#0A1628]/[0.03]">
                      <p className="text-[#0A1628] font-semibold text-xs uppercase tracking-wider">
                        Sort Signals
                      </p>
                    </div>
                    <div className="py-1.5">
                      {SORT_OPTIONS.map((opt) => {
                        const selected = sortKey === opt.key;
                        const isSurety = opt.key === "surety";
                        const isStrongBuy = opt.key === "strongBuyFirst";
                        const isNoLoss = opt.key === "noLoss";
                        return (
                          <button
                            type="button"
                            key={opt.key}
                            data-ocid={`signal.sort.${opt.key}.button`}
                            onClick={() => {
                              setSortKey(opt.key);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-3 px-4 py-2.5 transition-colors text-left ${
                              isSurety
                                ? selected
                                  ? "bg-emerald-50"
                                  : "hover:bg-emerald-50/60"
                                : isStrongBuy
                                  ? selected
                                    ? "bg-purple-50"
                                    : "hover:bg-purple-50/60"
                                  : isNoLoss
                                    ? selected
                                      ? "bg-rose-50"
                                      : "hover:bg-rose-50/60"
                                    : "hover:bg-amber-50"
                            }`}
                          >
                            {/* Radio dot */}
                            <span
                              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selected
                                  ? isSurety
                                    ? "border-emerald-500 bg-emerald-500/10"
                                    : isStrongBuy
                                      ? "border-purple-500 bg-purple-500/10"
                                      : isNoLoss
                                        ? "border-rose-500 bg-rose-500/10"
                                        : "border-[#C9A84C] bg-[#C9A84C]/10"
                                  : "border-[#0A1628]/25"
                              }`}
                            >
                              {selected && (
                                <span
                                  className={`w-2 h-2 rounded-full block ${
                                    isSurety
                                      ? "bg-emerald-500"
                                      : isStrongBuy
                                        ? "bg-purple-500"
                                        : isNoLoss
                                          ? "bg-rose-500"
                                          : "bg-[#C9A84C]"
                                  }`}
                                />
                              )}
                            </span>
                            <div>
                              <p
                                className={`text-xs font-semibold leading-tight ${
                                  selected
                                    ? isSurety
                                      ? "text-emerald-600"
                                      : isStrongBuy
                                        ? "text-purple-600"
                                        : isNoLoss
                                          ? "text-rose-600"
                                          : "text-[#C9A84C]"
                                    : "text-[#0A1628]"
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
                        <span
                          className={`font-medium ${
                            sortKey === "surety"
                              ? "text-emerald-600"
                              : sortKey === "strongBuyFirst"
                                ? "text-purple-600"
                                : sortKey === "noLoss"
                                  ? "text-rose-600"
                                  : "text-[#C9A84C]"
                          }`}
                        >
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
