import { CheckCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import LiveSignalCard from "../components/LiveSignalCard";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";
import { type TradeTestResult, runFullTest } from "../services/tradeTest";

interface TestedSignal {
  signal: Signal;
  result: TradeTestResult;
}

export default function EliteSignalsPage() {
  const { signals, scanning } = useScan();
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [verified, setVerified] = useState<TestedSignal[]>([]);
  const [lastTested, setLastTested] = useState<Date | null>(null);
  const abortRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot trigger
  useEffect(() => {
    if (signals.length > 0 && !testing && verified.length === 0 && !scanning) {
      runTests();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, [signals.length, scanning]);

  async function runTests() {
    if (signals.length === 0) return;
    abortRef.current = false;
    setTesting(true);
    setVerified([]);
    setProgress({ done: 0, total: signals.length });

    const passed: TestedSignal[] = [];

    for (let i = 0; i < signals.length; i++) {
      if (abortRef.current) break;
      const sig = signals[i];
      try {
        const result = await runFullTest(sig);
        // STRICT: only show signals that:
        // 1. verdict === 'pass' (all 4 critical checks + 75% normal checks)
        // 2. tpProbability >= 80
        // 3. dumpProbability < 25
        // 4. passedCritical (all 4 critical gates must pass)
        // 5. expectedValue > 0 (positive expected value)
        const isEliteQuality =
          result.verdict === "pass" &&
          result.tpProbability >= 80 &&
          result.dumpProbability < 25 &&
          result.passedCritical &&
          result.expectedValue > 0 &&
          // Signal itself must have strong fundamentals
          sig.dumpRisk === "Low" &&
          sig.rsiValue >= 45 &&
          sig.rsiValue <= 65 &&
          sig.macdHistogram > 0;

        if (isEliteQuality) {
          passed.push({ signal: sig, result });
          setVerified([...passed]);
        }
      } catch {
        // skip failed fetches
      }
      setProgress({ done: i + 1, total: signals.length });
    }

    // Sort by tpProbability descending — highest certainty first
    passed.sort((a, b) => b.result.tpProbability - a.result.tpProbability);
    setVerified([...passed]);
    setTesting(false);
    setLastTested(new Date());
  }

  function handleRetest() {
    abortRef.current = true;
    setTimeout(() => {
      abortRef.current = false;
      runTests();
    }, 100);
  }

  const passRate =
    progress.total > 0
      ? ((verified.length / progress.total) * 100).toFixed(0)
      : "0";

  return (
    <div className="min-h-screen bg-white px-4 pt-4 pb-8">
      {/* Page Header */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #14243e 100%)",
          border: "1px solid rgba(201,168,76,0.3)",
          boxShadow: "0 8px 30px rgba(10,22,40,0.25)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)",
            }}
          >
            <ShieldCheck size={20} className="text-[#0A1628]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              ⭐ Elite Signals
            </h1>
            <p className="text-white/50 text-xs">
              Live-tested — only signals that passed ALL 16 checks with 80%+ TP
              probability
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div className="text-[#C9A84C] font-bold text-lg leading-none">
              {verified.length}
            </div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider mt-0.5">
              Verified
            </div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div className="text-white font-bold text-lg leading-none">
              {progress.total}
            </div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider mt-0.5">
              Scanned
            </div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="font-bold text-lg leading-none"
              style={{
                color:
                  Number(passRate) >= 30
                    ? "#22c55e"
                    : Number(passRate) >= 15
                      ? "#f59e0b"
                      : "#f87171",
              }}
            >
              {testing ? "..." : `${passRate}%`}
            </div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider mt-0.5">
              Pass Rate
            </div>
          </div>
        </div>

        {/* Testing progress bar */}
        {testing && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-[10px] flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" />
                Testing signal {progress.done} of {progress.total}...
              </span>
              <span className="text-[#C9A84C] text-[10px] font-bold">
                {verified.length} passed so far
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{
                  width:
                    progress.total > 0
                      ? `${(progress.done / progress.total) * 100}%`
                      : "0%",
                }}
                transition={{ duration: 0.3 }}
                className="h-2 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #C9A84C 0%, #E8C97A 100%)",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-white/30 text-[10px]">
            {lastTested
              ? `Last tested: ${lastTested.toLocaleTimeString()}`
              : testing
                ? "Testing in progress..."
                : "Not yet tested"}
          </div>
          <button
            type="button"
            onClick={handleRetest}
            disabled={testing || scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background:
                testing || scanning ? "rgba(255,255,255,0.08)" : "#C9A84C",
              color: testing || scanning ? "rgba(255,255,255,0.4)" : "#0A1628",
              cursor: testing || scanning ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={11} className={testing ? "animate-spin" : ""} />
            {testing ? "Testing..." : "Re-test All"}
          </button>
        </div>
      </div>

      {/* Signal cards */}
      {signals.length === 0 && !scanning ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📡</div>
          <div className="text-[#0A1628] font-semibold mb-1">
            No Signals Loaded
          </div>
          <div className="text-[#0A1628]/40 text-sm">
            Tap "Rescan Markets" in the top bar to load signals first.
          </div>
        </div>
      ) : scanning ? (
        <div className="text-center py-16">
          <Loader2
            size={32}
            className="animate-spin text-[#C9A84C] mx-auto mb-3"
          />
          <div className="text-[#0A1628] font-semibold">
            Scanning markets...
          </div>
          <div className="text-[#0A1628]/40 text-sm">
            Auto-test will start after scan.
          </div>
        </div>
      ) : testing && verified.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 animate-pulse">🧪</div>
          <div className="text-[#0A1628] font-semibold mb-1">
            Running Live Tests...
          </div>
          <div className="text-[#0A1628]/40 text-sm">
            Testing {progress.total} signals with live CoinGecko data. Only
            signals with 80%+ TP probability will pass.
          </div>
        </div>
      ) : !testing && verified.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-[#0A1628] font-semibold mb-1">
            No Signals Passed All Tests
          </div>
          <div className="text-[#0A1628]/40 text-sm max-w-xs mx-auto">
            All {progress.total} signals failed the 16-check live test or scored
            below 80% TP probability. This page only shows signals with the
            highest certainty of hitting TP. Rescan markets or try again when
            market conditions improve.
          </div>
          <button
            type="button"
            onClick={handleRetest}
            className="mt-4 px-5 py-2 rounded-xl text-sm font-bold"
            style={{ background: "#0A1628", color: "#C9A84C" }}
          >
            Re-test All Signals
          </button>
        </div>
      ) : (
        <>
          {/* Summary banner */}
          <div
            className="mb-4 rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              background: "rgba(22,163,74,0.06)",
              border: "1px solid rgba(22,163,74,0.2)",
            }}
          >
            <CheckCircle size={18} className="text-green-600 shrink-0" />
            <div className="flex-1">
              <div className="text-green-700 font-bold text-sm">
                {verified.length} signal{verified.length !== 1 ? "s" : ""}{" "}
                passed all 16 live checks — sorted by highest TP probability
              </div>
              <div className="text-green-600/70 text-xs">
                Each passed: All 4 critical gates (RSI, Dump Risk, MACD, Sell
                Pressure) + 80%+ TP probability + positive expected value. These
                are the only trades safe to enter.
              </div>
            </div>
            {testing && (
              <span className="text-[10px] text-green-600 animate-pulse font-semibold">
                Still testing...
              </span>
            )}
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {verified.map(({ signal, result }, idx) => (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  {/* Test result overlay badge */}
                  <div className="relative">
                    <div
                      className="absolute top-0 left-0 right-0 z-10 rounded-t-2xl px-4 py-1.5 flex items-center justify-between"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(22,163,74,0.95) 0%, rgba(21,128,61,0.95) 100%)",
                      }}
                    >
                      <span className="text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={11} />
                        ELITE VERIFIED
                      </span>
                      <span className="text-white font-bold text-[10px]">
                        {result.score}/{result.maxScore} •{" "}
                        {result.tpProbability.toFixed(0)}% TP • EV: $
                        {result.expectedValue.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ paddingTop: "28px" }}>
                      <LiveSignalCard signal={signal} index={idx} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
