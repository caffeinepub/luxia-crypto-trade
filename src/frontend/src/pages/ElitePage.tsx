import { ChevronDown, Crown, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import LiveSignalCard from "../components/LiveSignalCard";
import { CreditLockout, useCredits } from "../context/CreditContext";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";

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
      const fallback = arr.filter(
        (s) =>
          s.dumpRisk === "Low" &&
          s.rsiValue >= 40 &&
          s.rsiValue <= 70 &&
          s.indicatorsAligned >= 5 &&
          s.confidence >= 82 &&
          (s.tpProbability ?? 0) >= 78,
      );
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

function filterElite(signals: Signal[]): Signal[] {
  const filtered = signals.filter(
    (s) =>
      s.confidence >= 90 &&
      (s.tpProbability ?? 0) >= 88 &&
      (s.suretyScore ?? 0) >= 78 &&
      s.indicatorsAligned >= 5 &&
      s.dumpRisk === "Low" &&
      s.momentum >= 0.5 &&
      s.momentum <= 9 &&
      s.rsiValue >= 42 &&
      s.rsiValue <= 68 &&
      (s.distToHigh24h === undefined || s.distToHigh24h > 0.015) &&
      (s.aiRating === undefined ||
        s.aiRating === "Strong Buy" ||
        s.aiRating === "Buy"),
  );

  // Sort by composite score and return top 6
  return filtered
    .sort((a, b) => compositeScore(b) - compositeScore(a))
    .slice(0, 6);
}

export default function ElitePage() {
  const { signals, scanning, progress, rescan } = useScan();
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

  const eliteSignals = filterElite(signals);
  const sorted = sortSignals(eliteSignals, sortKey);

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  if (isLocked) return <CreditLockout />;

  if (scanning && signals.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="text-6xl animate-pulse">👑</div>
        <div className="text-center">
          <h2 className="text-[#0A1628] font-bold text-xl mb-2">
            Scanning for Elite Setups
          </h2>
          <p className="text-[#0A1628]/50 text-sm">
            Analyzing {progress.scanned} / {progress.total} coins — applying
            institutional filters
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
          Filtering A+ institutional setups only...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Premium Banner */}
      <div className="bg-[#0A1628] px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Crown + Title */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center shadow-lg">
              <Crown size={20} className="text-[#0A1628]" />
            </div>
            <div>
              <h1 className="text-[#C9A84C] font-black text-2xl tracking-widest uppercase leading-none">
                ELITE SIGNALS
              </h1>
              <p className="text-[#C9A84C]/60 text-[11px] tracking-wider uppercase">
                Institutional A+ Setups Only — Maximum Certainty
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gold gradient separator */}
      <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-[#A07820]" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 mb-6"
        >
          <span className="inline-flex items-center gap-1.5 bg-[#C9A84C]/10 text-[#8B6914] border border-[#C9A84C]/30 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
            <Crown size={11} />
            A+ ONLY
          </span>
          <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full font-semibold text-xs">
            {sorted.length} elite signal{sorted.length !== 1 ? "s" : ""}
          </span>
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-semibold text-xs">
            {progress.scanned} coins scanned
          </span>
          {scanning && (
            <span className="bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full font-semibold text-xs animate-pulse">
              Updating...
            </span>
          )}

          {/* Sort dropdown */}
          <div ref={dropdownRef} className="relative ml-auto">
            <button
              type="button"
              data-ocid="elite.sort_button"
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors ${
                sortKey === "surety"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : sortKey === "strongBuyFirst"
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : sortKey === "noLoss"
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : "border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#8B6914] hover:border-[#C9A84C] hover:bg-[#C9A84C]/10"
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
                  data-ocid="elite.sort_panel"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#0A1628]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-[#0A1628]/10 bg-[#0A1628]/[0.03]">
                    <p className="text-[#0A1628] font-semibold text-xs uppercase tracking-wider">
                      Sort Elite Signals
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
                          data-ocid={`elite.sort.${opt.key}.button`}
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
        </motion.div>

        {/* NO TRADE empty state */}
        {sorted.length === 0 ? (
          <motion.div
            data-ocid="elite.empty_state"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16"
          >
            <div className="text-7xl mb-6">🚫</div>
            <h2 className="text-[#0A1628] font-black text-2xl mb-3 tracking-tight">
              NO TRADE — Market Conditions Not Ideal
            </h2>
            <p className="text-[#0A1628]/50 text-sm max-w-md mb-2">
              No A+ institutional setups found at this time. The market is not
              offering clean, high-certainty entries that meet all elite
              criteria.
            </p>
            <p className="text-[#0A1628]/35 text-xs max-w-sm mb-8">
              Our AI is waiting for the perfect entry. Come back after the next
              rescan.
            </p>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                data-ocid="elite.rescan.button"
                onClick={rescan}
                disabled={scanning}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0A1628] text-white font-bold text-sm tracking-wide hover:bg-[#0A1628]/85 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw
                  size={15}
                  className={scanning ? "animate-spin" : ""}
                />
                {scanning ? "Scanning..." : "Rescan Markets"}
              </button>
              <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl px-5 py-3 max-w-xs">
                <p className="text-[#8B6914] text-xs font-medium leading-relaxed">
                  💡 <strong>Elite criteria:</strong> 90%+ confidence, 88%+ TP
                  probability, 78+ surety score, 5/6 indicators aligned, low
                  dump risk, RSI 42–68
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {sorted.map((sig, i) => (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="relative"
                  data-ocid={`elite.item.${i + 1}`}
                >
                  {/* ELITE ribbon */}
                  <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 pointer-events-none">
                    <span>⭐</span>
                    <span>ELITE</span>
                  </div>
                  <LiveSignalCard signal={sig} index={i} />
                </motion.div>
              ))}
            </div>

            {/* Institutional disclaimer */}
            <div className="flex justify-center">
              <p className="text-[#0A1628]/30 text-xs text-center border-t border-[#0A1628]/8 pt-4 pb-2 max-w-md">
                ⚖️ Only 1–6 signals per session. Quality over quantity. Elite
                signals meet all institutional-grade entry criteria.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
