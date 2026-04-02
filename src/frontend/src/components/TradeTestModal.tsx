import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Signal } from "../services/signalEngine";
import {
  type TradeTestResult,
  computeTestResult,
  fetchLiveOHLC,
  runTradeChecks,
} from "../services/tradeTest";

export type { TradeTestResult };

interface TradeTestModalProps {
  signal: Signal;
  open: boolean;
  onClose: (result?: TradeTestResult) => void;
  onConfirm: () => void;
}

const STAGES = [
  "Fetching live OHLCV data from CoinGecko...",
  "Running 16 technical & AI checks...",
  "Analyzing sell pressure & dump vectors...",
  "Computing outcome probabilities & $10 simulation...",
];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function TradeTestModal({
  signal,
  open,
  onClose,
  onConfirm,
}: TradeTestModalProps) {
  const [stage, setStage] = useState(-1);
  const [results, setResults] = useState<TradeTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  const coinName = signal.symbol.split("-")[0];

  useEffect(() => {
    if (!open) {
      setStage(-1);
      setResults(null);
      setLoading(false);
      abortRef.current = false;
      return;
    }
    abortRef.current = false;
    runTest();
  }, [open]);

  async function runTest() {
    setLoading(true);
    setResults(null);

    setStage(0);
    const coinId = signal.coinId ?? coinName.toLowerCase();
    const live = await fetchLiveOHLC(coinId);
    if (abortRef.current) return;

    setStage(1);
    await delay(400);
    if (abortRef.current) return;
    const checks = runTradeChecks(signal, live);

    setStage(2);
    await delay(500);
    if (abortRef.current) return;

    setStage(3);
    await delay(600);
    if (abortRef.current) return;

    const liveRsi = live?.rsi ?? signal.rsiValue;
    const result = computeTestResult(signal, checks, liveRsi);
    setResults(result);
    setLoading(false);
  }

  function handleClose() {
    abortRef.current = true;
    onClose(results ?? undefined);
  }

  function handleConfirm() {
    abortRef.current = true;
    onConfirm();
    onClose(results ?? undefined);
  }

  const verdictColor =
    results?.verdict === "pass"
      ? "#16a34a"
      : results?.verdict === "uncertain"
        ? "#d97706"
        : "#dc2626";

  const verdictBg =
    results?.verdict === "pass"
      ? "linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(21,128,61,0.08) 100%)"
      : results?.verdict === "uncertain"
        ? "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)"
        : "linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(185,28,28,0.08) 100%)";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.80)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            style={{
              border: "2px solid #0A1628",
              boxShadow:
                "0 25px 60px rgba(10,22,40,0.40), 0 0 0 1px rgba(201,168,76,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-6 pt-5 pb-4 rounded-t-2xl sticky top-0 z-10"
              style={{
                background: "linear-gradient(135deg, #0A1628 0%, #14243e 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    🧪 Trade Test — $10 Simulation
                  </h2>
                  <p className="text-white/50 text-xs mt-0.5">
                    16-check live institutional analysis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-white/40 hover:text-white text-2xl leading-none transition-colors w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: "#C9A84C" }}
                >
                  {coinName.slice(0, 2)}
                </div>
                <div>
                  <span className="text-white font-bold text-sm">
                    {coinName}
                  </span>
                  <span className="text-white/50 text-xs ml-2">
                    {signal.symbol}
                  </span>
                </div>
                <span
                  className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  {signal.direction}
                </span>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Loading stages */}
              {loading && (
                <div className="space-y-3">
                  {STAGES.map((s, i) => (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: i <= stage ? 1 : 0.25, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          i < stage
                            ? "bg-green-500 text-white"
                            : i === stage
                              ? "border-2 border-[#C9A84C] animate-spin"
                              : "bg-gray-100"
                        }`}
                      >
                        {i < stage ? "✓" : ""}
                      </div>
                      <span
                        className={`text-sm ${
                          i === stage
                            ? "text-[#0A1628] font-semibold"
                            : i < stage
                              ? "text-gray-400 line-through"
                              : "text-gray-300"
                        }`}
                      >
                        {s}
                      </span>
                      {i === stage && (
                        <span className="ml-auto text-xs text-[#C9A84C] animate-pulse font-medium">
                          Running...
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {results && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Live data note */}
                  <div
                    className="text-[10px] px-3 py-1.5 rounded-lg text-center"
                    style={{
                      background: "rgba(201,168,76,0.08)",
                      color: "#92700D",
                      border: "1px solid rgba(201,168,76,0.2)",
                    }}
                  >
                    📡 Live OHLCV from CoinGecko — 16 checks — 4 critical gates
                  </div>

                  {/* Critical gate status */}
                  <div
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: results.passedCritical
                        ? "rgba(22,163,74,0.08)"
                        : "rgba(220,38,38,0.08)",
                      border: `1px solid ${
                        results.passedCritical
                          ? "rgba(22,163,74,0.3)"
                          : "rgba(220,38,38,0.3)"
                      }`,
                    }}
                  >
                    <span className="text-xl">
                      {results.passedCritical ? "🛡️" : "🚨"}
                    </span>
                    <div>
                      <div
                        className={`text-xs font-bold ${
                          results.passedCritical
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {results.passedCritical
                          ? "All 4 Critical Gates Passed"
                          : "Critical Gate FAILED — Trade Blocked"}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Critical checks: RSI Zone, Dump Risk, MACD, Sell
                        Pressure
                      </div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#0A1628]">
                        Technical Score
                      </span>
                      <span
                        className={`font-bold text-lg ${
                          results.weightedScore >= 0.8
                            ? "text-green-600"
                            : results.weightedScore >= 0.6
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      >
                        {results.score} / {results.maxScore}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(results.score / results.maxScore) * 100}%`,
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-3 rounded-full ${
                          results.weightedScore >= 0.8
                            ? "bg-green-500"
                            : results.weightedScore >= 0.6
                              ? "bg-amber-400"
                              : "bg-red-500"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Weighted score: {(results.weightedScore * 100).toFixed(0)}
                      % (critical checks have 2× weight)
                    </div>
                  </div>

                  {/* VERDICT */}
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="rounded-xl px-5 py-4 text-center"
                    style={{
                      background: verdictBg,
                      border: `2px solid ${verdictColor}66`,
                    }}
                  >
                    <div
                      className="text-2xl font-extrabold"
                      style={{ color: verdictColor }}
                    >
                      {results.verdict === "pass"
                        ? "✅ WILL HIT TP"
                        : results.verdict === "uncertain"
                          ? "⚠️ UNCERTAIN — RISKY"
                          : "❌ HIGH RISK — AVOID"}
                    </div>
                    <div className="text-sm mt-1 text-gray-600">
                      {results.verdict === "pass"
                        ? `${results.tpProbability.toFixed(1)}% TP probability — all critical gates passed`
                        : results.verdict === "uncertain"
                          ? `Only ${results.score}/${results.maxScore} checks passed — risky entry`
                          : `${
                              !results.passedCritical
                                ? "Critical check failed"
                                : `${results.maxScore - results.score} checks failed`
                            } — skip this trade`}
                    </div>
                  </motion.div>

                  {/* Outcome probabilities */}
                  <div
                    className="rounded-xl px-4 py-3 space-y-2"
                    style={{
                      background: "rgba(10,22,40,0.04)",
                      border: "1px solid rgba(10,22,40,0.1)",
                    }}
                  >
                    <div className="text-xs font-bold text-[#0A1628] mb-2 uppercase tracking-wider">
                      Outcome Probabilities
                    </div>
                    <OutcomeBar
                      label="TP Hit"
                      value={results.tpProbability}
                      color="#16a34a"
                    />
                    <OutcomeBar
                      label="SL Hit"
                      value={results.slProbability}
                      color="#dc2626"
                    />
                    <OutcomeBar
                      label="Dump"
                      value={results.dumpProbability}
                      color="#d97706"
                    />
                  </div>

                  {/* $10 Calculator */}
                  <div
                    className="rounded-xl px-4 py-4"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(10,22,40,0.05) 0%, rgba(201,168,76,0.06) 100%)",
                      border: "1px solid rgba(201,168,76,0.25)",
                    }}
                  >
                    <div className="text-xs font-bold text-[#0A1628] mb-3 uppercase tracking-wider">
                      💵 $10 Investment Calculator
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          💰 If TP Hit
                        </span>
                        <span className="font-bold text-green-600 text-base">
                          +${results.profitAtTP.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          💸 If SL Hit
                        </span>
                        <span className="font-bold text-red-500 text-base">
                          -${results.lossAtSL.toFixed(4)}
                        </span>
                      </div>
                      <div
                        className="flex justify-between items-center pt-2 mt-1"
                        style={{ borderTop: "1px solid rgba(201,168,76,0.25)" }}
                      >
                        <span className="text-sm font-semibold text-[#0A1628]">
                          📊 Expected Value
                        </span>
                        <span
                          className="font-extrabold text-base"
                          style={{
                            color:
                              results.expectedValue >= 0
                                ? "#C9A84C"
                                : "#dc2626",
                          }}
                        >
                          {results.expectedValue >= 0 ? "+" : ""}$
                          {results.expectedValue.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 16 Checks List */}
                  <div>
                    <div className="text-xs font-bold text-[#0A1628] mb-3 uppercase tracking-wider">
                      16 Technical Checks
                      <span className="ml-2 text-[10px] font-normal text-gray-400">
                        (🔴 = critical gate)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.checks.map((check, i) => (
                        <motion.div
                          key={check.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                          style={{
                            background: check.passed
                              ? "rgba(22,163,74,0.06)"
                              : check.weight === 2
                                ? "rgba(220,38,38,0.10)"
                                : "rgba(220,38,38,0.05)",
                            border: `1px solid ${
                              check.passed
                                ? "rgba(22,163,74,0.2)"
                                : check.weight === 2
                                  ? "rgba(220,38,38,0.35)"
                                  : "rgba(220,38,38,0.15)"
                            }`,
                          }}
                        >
                          <span className="text-base leading-none mt-0.5 shrink-0">
                            {check.passed
                              ? "✅"
                              : check.weight === 2
                                ? "🚫"
                                : "❌"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0A1628]">
                                {check.name}
                                {check.weight === 2 && (
                                  <span className="ml-1 text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">
                                    CRITICAL
                                  </span>
                                )}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                  check.passed
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-600"
                                }`}
                              >
                                {check.value}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                              {check.reason}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Failures summary */}
                  {results.verdict !== "pass" && (
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: "rgba(220,38,38,0.04)",
                        border: "1px solid rgba(220,38,38,0.15)",
                      }}
                    >
                      <div className="text-xs font-bold text-red-600 mb-2">
                        ⚠️ Why This Trade Was Blocked (
                        {results.checks.filter((c) => !c.passed).length}{" "}
                        failures)
                      </div>
                      <ul className="space-y-1">
                        {results.checks
                          .filter((c) => !c.passed)
                          .sort((a, b) => b.weight - a.weight)
                          .map((c) => (
                            <li
                              key={c.name}
                              className={`text-[10px] ${
                                c.weight === 2
                                  ? "text-red-600 font-semibold"
                                  : "text-red-400"
                              }`}
                            >
                              {c.weight === 2 ? "🚫" : "•"} {c.name}: {c.reason}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 pb-6 pt-2 flex gap-3"
              style={{ borderTop: "1px solid rgba(10,22,40,0.08)" }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#0A1628]/60 border border-gray-200 hover:border-gray-300 hover:text-[#0A1628] transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!results || results.verdict !== "pass"}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background:
                    results?.verdict === "pass" ? "#0A1628" : "#e5e7eb",
                  color: results?.verdict === "pass" ? "#C9A84C" : "#9ca3af",
                  cursor:
                    results?.verdict === "pass" ? "pointer" : "not-allowed",
                  boxShadow:
                    results?.verdict === "pass"
                      ? "0 4px 14px rgba(10,22,40,0.25)"
                      : "none",
                }}
              >
                {loading
                  ? "Testing..."
                  : results?.verdict === "pass"
                    ? "✅ Confirm & Enter Trade"
                    : results?.verdict === "uncertain"
                      ? "⚠️ Trade Locked (Uncertain)"
                      : results
                        ? "❌ Trade Locked (High Risk)"
                        : "Run Test First"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OutcomeBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-12 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ background: color }}
          className="h-2 rounded-full"
        />
      </div>
      <span className="text-xs font-bold w-12 text-right" style={{ color }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
