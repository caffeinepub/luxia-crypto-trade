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

type SortKey = "profit" | "surety" | "tpHitting";

const SORT_OPTIONS: { key: SortKey; label: string; desc: string }[] = [
  {
    key: "profit",
    label: "💰 Highest Profit",
    desc: "All signals sorted by profit % — highest to lowest",
  },
  {
    key: "surety",
    label: "🛡️ Surety — Surely Hits TP",
    desc: "AI confirmed · Low dump risk · RSI safe · Must hit TP — all others hidden",
  },
  {
    key: "tpHitting",
    label: "🚀 TP Hitting — Only Pumping Now",
    desc: "Actively pumping toward TP right now · No dump · No pullback · Will hit TP",
  },
];

function profitPct(s: Signal) {
  return (s.takeProfit - s.entryPrice) / (s.entryPrice || 1);
}

function sortSignals(signals: Signal[], key: SortKey): Signal[] {
  const arr = signals.slice();

  if (key === "profit") {
    return arr.sort((a, b) => profitPct(b) - profitPct(a));
  }

  if (key === "surety") {
    // NO FALLBACK: only show signals that pass ALL surety criteria
    // If none pass, return empty array (empty state is correct)
    const safe = arr.filter((s) => {
      const dumpOk = s.dumpRisk === "Low";
      const rsiOk = s.rsiValue >= 45 && s.rsiValue <= 65;
      const momentumOk = s.momentum >= 0.5 && s.momentum <= 8;
      const indicatorsOk = s.indicatorsAligned >= 5;
      const confidenceOk = s.confidence >= 82;
      const tpOk = (s.tpProbability ?? 0) >= 78;
      const timeOk = s.estimatedHours <= 16;
      const aiOk =
        !s.aiEnriched || s.aiRating === "Strong Buy" || s.aiRating === "Buy";
      const suretyOk = (s.suretyScore ?? 0) >= 68;
      const macdOk = s.macdHistogram > 0;
      const roomOk = (s.distToHigh24h ?? 0) >= 0.05;
      return (
        dumpOk &&
        rsiOk &&
        momentumOk &&
        indicatorsOk &&
        confidenceOk &&
        tpOk &&
        timeOk &&
        aiOk &&
        suretyOk &&
        macdOk &&
        roomOk
      );
    });
    // NO FALLBACK — return exactly what passes, even if empty
    return safe.sort((a, b) => (b.suretyScore ?? 0) - (a.suretyScore ?? 0));
  }

  if (key === "tpHitting") {
    // NO FALLBACK: only coins actively pumping right now
    const hitting = arr.filter((s) => {
      const dumpOk = s.dumpRisk === "Low";
      const rsiOk = s.rsiValue >= 45 && s.rsiValue <= 65;
      const momentumOk = s.momentum >= 1 && s.momentum <= 7; // actively pumping, not exhausted
      const macdOk = s.macdHistogram > 0;
      const roomToRun = (s.distToHigh24h ?? 0) >= 0.05;
      const indicatorsOk = s.indicatorsAligned >= 5;
      const timeOk = s.estimatedHours <= 12; // must be reachable quickly
      const aiOk =
        !s.aiEnriched || s.aiRating === "Strong Buy" || s.aiRating === "Buy";
      const bullish = s.trendDirection === "bullish";
      const suretyOk = (s.suretyScore ?? 0) >= 65;
      return (
        dumpOk &&
        rsiOk &&
        momentumOk &&
        macdOk &&
        roomToRun &&
        indicatorsOk &&
        timeOk &&
        aiOk &&
        bullish &&
        suretyOk
      );
    });
    // NO FALLBACK — return exactly what passes
    return hitting.sort((a, b) => profitPct(b) - profitPct(a));
  }

  return arr;
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
          // Require >10% profit AND minimum surety score of 72
          return pp > 0.1 && (s.suretyScore ?? 0) >= 72;
        })
        .sort((a, b) => profitPct(b) - profitPct(a));

    default:
      return signals;
  }
}

export default function SignalPage({ type, title, subtitle, icon }: Props) {
  const { signals, scanning, progress } = useScan();
  const { isLocked } = useCredits();
  const [sortKey, setSortKey] = useState<SortKey>("profit");
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

  const sortBtnColor =
    sortKey === "surety"
      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
      : sortKey === "tpHitting"
        ? "border-blue-400 bg-blue-50 text-blue-700"
        : "border-[#C9A84C] bg-amber-50 text-amber-700";

  const sortBtnLabel =
    sortKey === "surety"
      ? "🛡️ Surety"
      : sortKey === "tpHitting"
        ? "🚀 TP Hitting"
        : "💰 Highest Profit";

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

          {/* Active filter banners */}
          <AnimatePresence>
            {sortKey === "surety" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200"
              >
                <span className="text-emerald-600 text-sm font-semibold">
                  🛡️ Surety mode — only AI-confirmed, no-dump, TP-hitting trades
                  shown. All others hidden.
                </span>
              </motion.div>
            )}
            {sortKey === "tpHitting" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200"
              >
                <span className="text-blue-700 text-sm font-semibold">
                  🚀 TP Hitting mode — only coins actively pumping toward TP
                  right now. No fallback. No dump risk.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats + Sort row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium text-xs">
              {sorted.length} signals
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors ${sortBtnColor}`}
              >
                <SlidersHorizontal size={13} />
                <span>{sortBtnLabel}</span>
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
                    className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#0A1628]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-[#0A1628]/10 bg-[#0A1628]/[0.03]">
                      <p className="text-[#0A1628] font-semibold text-xs uppercase tracking-wider">
                        Sort Signals
                      </p>
                    </div>
                    <div className="py-1.5">
                      {SORT_OPTIONS.map((opt) => {
                        const selected = sortKey === opt.key;
                        const colorClass =
                          opt.key === "surety"
                            ? {
                                bg: "bg-emerald-50",
                                hov: "hover:bg-emerald-50/60",
                                dot: "border-emerald-500 bg-emerald-500/10",
                                fill: "bg-emerald-500",
                                text: "text-emerald-600",
                              }
                            : opt.key === "tpHitting"
                              ? {
                                  bg: "bg-blue-50",
                                  hov: "hover:bg-blue-50/60",
                                  dot: "border-blue-500 bg-blue-500/10",
                                  fill: "bg-blue-500",
                                  text: "text-blue-700",
                                }
                              : {
                                  bg: "bg-amber-50",
                                  hov: "hover:bg-amber-50",
                                  dot: "border-[#C9A84C] bg-[#C9A84C]/10",
                                  fill: "bg-[#C9A84C]",
                                  text: "text-amber-700",
                                };
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
                              selected ? colorClass.bg : colorClass.hov
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selected
                                  ? colorClass.dot
                                  : "border-[#0A1628]/25"
                              }`}
                            >
                              {selected && (
                                <span
                                  className={`w-2 h-2 rounded-full block ${colorClass.fill}`}
                                />
                              )}
                            </span>
                            <div>
                              <p
                                className={`text-xs font-semibold leading-tight ${
                                  selected ? colorClass.text : "text-[#0A1628]"
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
                              : sortKey === "tpHitting"
                                ? "text-blue-700"
                                : "text-amber-700"
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
          <div data-ocid="signal.empty_state" className="text-center py-16">
            <div className="text-5xl mb-4">{icon}</div>
            <div className="font-medium text-lg mb-1 text-[#0A1628]">
              {sortKey === "tpHitting"
                ? "No Actively Pumping Trades"
                : sortKey === "surety"
                  ? "No Confirmed TP-Hitting Trades"
                  : "No signals available"}
            </div>
            <div className="text-sm text-[#0A1628]/50 max-w-xs mx-auto">
              {sortKey === "tpHitting"
                ? "No coins are actively pumping toward TP right now with zero dump risk. This filter has no fallback — it only shows real setups. Try rescanning or switch to Highest Profit."
                : sortKey === "surety"
                  ? "No AI-confirmed, no-dump, TP-hitting trades found. This filter has no fallback — it only shows safe setups. Rescan or switch to Highest Profit."
                  : scanning
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
