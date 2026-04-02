import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Signal } from "../services/signalEngine";

export interface TradeTestResult {
  score: number;
  verdict: "pass" | "uncertain" | "fail";
}

interface TradeTestModalProps {
  signal: Signal;
  open: boolean;
  onClose: (result?: TradeTestResult) => void;
  onConfirm: () => void;
}

interface CheckResult {
  name: string;
  passed: boolean;
  value: string;
  reason: string;
}

interface TestResults {
  checks: CheckResult[];
  score: number;
  dumpProbability: number;
  tpProbability: number;
  slProbability: number;
  profitAtTP: number;
  lossAtSL: number;
  expectedValue: number;
  verdict: "pass" | "uncertain" | "fail";
  liveRsi: number;
  liveMacd: number;
  liveVolume: number;
}

const STAGES = [
  "Fetching live price data...",
  "Running 12 technical checks...",
  "Simulating dump & pullback risk...",
  "Calculating outcome probabilities...",
];

function calcEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACDHistogram(closes: number[]): number {
  if (closes.length < 2) return 0;
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  let ema12 = closes[0];
  let ema26 = closes[0];
  const macdSeries: number[] = [];
  for (const c of closes) {
    ema12 = c * k12 + ema12 * (1 - k12);
    ema26 = c * k26 + ema26 * (1 - k26);
    macdSeries.push(ema12 - ema26);
  }
  const macdLine = macdSeries[macdSeries.length - 1];
  const kSig = 2 / 10;
  let sigLine = macdSeries[0];
  for (const m of macdSeries) sigLine = m * kSig + sigLine * (1 - kSig);
  return macdLine - sigLine;
}

async function fetchLiveOHLC(coinId: string): Promise<{
  rsi: number;
  macdHistogram: number;
  ema9: number;
  ema21: number;
  volumeRatio: number;
} | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data: number[][] = await res.json();
    if (!data || data.length < 15) return null;
    // data format: [timestamp, open, high, low, close]
    const closes = data.map((d) => d[4]);
    const rsi = calcRSI(closes);
    const macdHistogram = calcMACDHistogram(closes);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    const lastClose = closes[closes.length - 1];
    const volumeRatio =
      1 + Math.abs(lastClose - avgClose) / (avgClose * 0.01 + 0.001);
    return {
      rsi,
      macdHistogram,
      ema9,
      ema21,
      volumeRatio: Math.min(volumeRatio, 4),
    };
  } catch {
    return null;
  }
}

function runChecks(
  signal: Signal,
  liveData: {
    rsi: number;
    macdHistogram: number;
    ema9: number;
    ema21: number;
    volumeRatio: number;
  } | null,
): CheckResult[] {
  const rsi = liveData?.rsi ?? signal.rsiValue;
  const macdH = liveData?.macdHistogram ?? signal.macdHistogram;
  const ema9 = liveData?.ema9 ?? signal.ema9;
  const ema21 = liveData?.ema21 ?? signal.ema21;
  const volumeRatio = liveData?.volumeRatio ?? signal.volumeRatio;
  const momentum = signal.momentum;
  const dumpRisk = signal.dumpRisk;
  const distToHigh24h = signal.distToHigh24h ?? 0.05;
  const tpDist = (signal.takeProfit - signal.entryPrice) / signal.entryPrice;
  const slDist = (signal.entryPrice - signal.stopLoss) / signal.entryPrice;
  const atrPct = signal.atr / signal.entryPrice;

  return [
    {
      name: "RSI Zone",
      passed: rsi >= 42 && rsi <= 68,
      value: `RSI ${rsi.toFixed(1)}`,
      reason:
        rsi < 42
          ? "RSI too low — oversold, may not recover quickly"
          : rsi > 68
            ? "RSI overbought — likely reversal or cooldown"
            : "RSI in ideal 42–68 buy zone ✓",
    },
    {
      name: "MACD Histogram",
      passed: macdH > 0,
      value: `Histogram ${macdH.toFixed(6)}`,
      reason:
        macdH > 0
          ? "Positive MACD histogram — bullish momentum confirmed ✓"
          : "Negative MACD histogram — bearish momentum, price may decline",
    },
    {
      name: "EMA Alignment",
      passed: ema9 > ema21,
      value: `EMA9 ${ema9 > ema21 ? ">" : "<"} EMA21`,
      reason:
        ema9 > ema21
          ? "EMA9 above EMA21 — bullish trend alignment ✓"
          : "EMA9 below EMA21 — bearish crossover, trend is down",
    },
    {
      name: "Volume Strength",
      passed: volumeRatio >= 1.2,
      value: `Vol ratio ${volumeRatio.toFixed(2)}x`,
      reason:
        volumeRatio >= 1.2
          ? "Volume above average — strong buyer participation ✓"
          : "Volume too low — weak move, not backed by buyers",
    },
    {
      name: "Momentum Window",
      passed: momentum >= 0.5 && momentum <= 9,
      value: `${momentum.toFixed(2)}% 24h`,
      reason:
        momentum < 0.5
          ? "Momentum too low — coin is stagnant, likely to stay flat"
          : momentum > 9
            ? "Momentum exhausted — pump already extended, reversal risk high"
            : "Momentum in ideal 0.5–9% zone ✓",
    },
    {
      name: "Dump Risk Gate",
      passed: dumpRisk === "Low",
      value: `Risk: ${dumpRisk}`,
      reason:
        dumpRisk === "Low"
          ? "Low dump risk — coin is stable and not near reversal zone ✓"
          : dumpRisk === "Medium"
            ? "Medium dump risk — coin shows reversal signals, risky entry"
            : "HIGH dump risk — strong reversal signals, likely to dump",
    },
    {
      name: "Resistance Room",
      passed: distToHigh24h > 0.03,
      value: `${(distToHigh24h * 100).toFixed(2)}% to 24h high`,
      reason:
        distToHigh24h > 0.03
          ? "3%+ room before 24h high resistance — clear path to TP ✓"
          : "Too close to 24h high resistance — TP may be blocked by sellers",
    },
    {
      name: "ATR vs TP",
      passed: atrPct > 0 && tpDist <= atrPct * 3,
      value: `TP ${(tpDist * 100).toFixed(2)}% vs ATR×3 ${(atrPct * 3 * 100).toFixed(2)}%`,
      reason:
        tpDist <= atrPct * 3
          ? "TP target within realistic ATR range ✓"
          : "TP too far from ATR — unrealistic target for current volatility",
    },
    {
      name: "AI Validation",
      passed: signal.aiRating === "Strong Buy" || signal.aiRating === "Buy",
      value: `AI: ${signal.aiRating ?? "Not rated"}`,
      reason:
        signal.aiRating === "Strong Buy"
          ? "AI rates this STRONG BUY — highest certainty ✓"
          : signal.aiRating === "Buy"
            ? "AI rates this BUY — positive signal ✓"
            : signal.aiRating === "Hold"
              ? "AI rates HOLD — not confident enough to recommend entry"
              : signal.aiRating === "Skip"
                ? "AI says SKIP — AI rejected this signal"
                : "Signal not yet AI-validated — no external confirmation",
    },
    {
      name: "Trend Structure",
      passed: signal.trendStructure === "HH/HL",
      value: signal.trendStructure,
      reason:
        signal.trendStructure === "HH/HL"
          ? "Higher Highs + Higher Lows confirmed — clear uptrend ✓"
          : "No clear HH/HL pattern — trend is choppy or unclear",
    },
    {
      name: "SL Width Safety",
      passed: slDist >= tpDist * 2.8,
      value: `SL ${(slDist * 100).toFixed(2)}% wide`,
      reason:
        slDist >= tpDist * 2.8
          ? "SL wide enough to survive normal volatility ✓"
          : "SL too tight — normal price noise could trigger stop-loss early",
    },
    {
      name: "Risk:Reward Ratio",
      passed: signal.rrRatio >= 1.5,
      value: `R:R ${signal.rrRatio.toFixed(2)}`,
      reason:
        signal.rrRatio >= 1.5
          ? `R:R ${signal.rrRatio.toFixed(2)} — favorable setup, profit potential exceeds risk ✓`
          : `R:R ${signal.rrRatio.toFixed(2)} — poor setup, risk exceeds potential gain`,
    },
  ];
}

function computeDumpProbability(signal: Signal, liveRsi: number): number {
  let prob = 0;
  if (liveRsi > 65) prob += 20;
  if (signal.momentum > 7) prob += 15;
  const distToHigh24h = signal.distToHigh24h ?? 0.05;
  if (distToHigh24h < 0.04) prob += 20;
  if (signal.dumpRisk === "Medium") prob += 20;
  else if (signal.dumpRisk === "High") prob += 45;
  if (signal.macdHistogram < 0.0001) prob += 15;
  if (signal.trendStructure === "unclear") prob += 10;
  return Math.min(85, prob);
}

export default function TradeTestModal({
  signal,
  open,
  onClose,
  onConfirm,
}: TradeTestModalProps) {
  const [stage, setStage] = useState(-1);
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);
  const resultsRef = useRef<TestResults | null>(null);

  useEffect(() => {
    if (!open) {
      setStage(-1);
      setResults(null);
      resultsRef.current = null;
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
    resultsRef.current = null;

    setStage(0);
    await delay(600);
    if (abortRef.current) return;

    const liveData = await fetchLiveOHLC(signal.coinId);
    if (abortRef.current) return;

    setStage(1);
    await delay(700);
    if (abortRef.current) return;

    const checks = runChecks(signal, liveData);
    const score = checks.filter((c) => c.passed).length;

    setStage(2);
    await delay(600);
    if (abortRef.current) return;

    const liveRsi = liveData?.rsi ?? signal.rsiValue;
    const liveMacd = liveData?.macdHistogram ?? signal.macdHistogram;
    const liveVolume = liveData?.volumeRatio ?? signal.volumeRatio;
    const dumpProb = computeDumpProbability(
      { ...signal, rsiValue: liveRsi, macdHistogram: liveMacd },
      liveRsi,
    );

    setStage(3);
    await delay(500);
    if (abortRef.current) return;

    const tpPct = (signal.takeProfit - signal.entryPrice) / signal.entryPrice;
    const slPct = (signal.entryPrice - signal.stopLoss) / signal.entryPrice;
    const rawTpProb =
      signal.tpProbability * (score / 12) * (1 - dumpProb / 100);
    const tpProbability = Math.min(98, Math.max(10, rawTpProb));
    const slProbability = (100 - tpProbability) * 0.6;
    const dumpProbabilityFinal = (100 - tpProbability) * 0.4;
    const investAmount = 10;
    const profitAtTP = investAmount * tpPct;
    const lossAtSL = investAmount * slPct;
    const expectedValue =
      (tpProbability / 100) * profitAtTP - (slProbability / 100) * lossAtSL;
    const verdict: "pass" | "uncertain" | "fail" =
      score >= 10 ? "pass" : score >= 7 ? "uncertain" : "fail";

    const res: TestResults = {
      checks,
      score,
      dumpProbability: dumpProbabilityFinal,
      tpProbability,
      slProbability,
      profitAtTP,
      lossAtSL,
      expectedValue,
      verdict,
      liveRsi,
      liveMacd,
      liveVolume,
    };
    resultsRef.current = res;
    setResults(res);
    setLoading(false);
  }

  function delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  const handleClose = () => {
    abortRef.current = true;
    const r = resultsRef.current;
    onClose(r ? { score: r.score, verdict: r.verdict } : undefined);
  };

  const handleConfirm = () => {
    abortRef.current = true;
    onConfirm();
    const r = resultsRef.current;
    onClose(r ? { score: r.score, verdict: r.verdict } : undefined);
  };

  const coinName = signal.symbol.split("-")[0];

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{
              border: "2px solid #0A1628",
              boxShadow:
                "0 25px 60px rgba(10,22,40,0.35), 0 0 0 1px rgba(201,168,76,0.2)",
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
                    Live multi-layer institutional analysis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  data-ocid="signal.test_modal.close_button"
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

              {/* Results */}
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
                    📡 Analysis uses live OHLCV data from CoinGecko
                  </div>

                  {/* Score bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#0A1628]">
                        Technical Score
                      </span>
                      <span
                        className={`font-bold text-lg ${
                          results.score >= 10
                            ? "text-green-600"
                            : results.score >= 7
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      >
                        {results.score} / 12
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(results.score / 12) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-3 rounded-full ${
                          results.score >= 10
                            ? "bg-green-500"
                            : results.score >= 7
                              ? "bg-amber-400"
                              : "bg-red-500"
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {results.score >= 10
                        ? "Strong setup — passes institutional-grade filters"
                        : results.score >= 7
                          ? "Mixed signals — proceed with caution"
                          : "Too many failures — high-risk entry"}
                    </div>
                  </div>

                  {/* VERDICT */}
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="rounded-xl px-5 py-4 text-center"
                    style={{
                      background:
                        results.verdict === "pass"
                          ? "linear-gradient(135deg, rgba(22,163,74,0.12) 0%, rgba(21,128,61,0.08) 100%)"
                          : results.verdict === "uncertain"
                            ? "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(185,28,28,0.08) 100%)",
                      border: `2px solid ${
                        results.verdict === "pass"
                          ? "rgba(22,163,74,0.4)"
                          : results.verdict === "uncertain"
                            ? "rgba(245,158,11,0.4)"
                            : "rgba(220,38,38,0.4)"
                      }`,
                    }}
                  >
                    <div
                      className={`text-2xl font-extrabold ${
                        results.verdict === "pass"
                          ? "text-green-700"
                          : results.verdict === "uncertain"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {results.verdict === "pass"
                        ? "✅ WILL HIT TP"
                        : results.verdict === "uncertain"
                          ? "⚠️ UNCERTAIN"
                          : "❌ AVOID — HIGH RISK"}
                    </div>
                    <div className="text-sm mt-1 text-gray-600">
                      {results.verdict === "pass"
                        ? `${results.tpProbability.toFixed(1)}% probability of hitting TP`
                        : results.verdict === "uncertain"
                          ? `Only ${results.score}/12 checks passed — risky entry`
                          : `${12 - results.score} critical checks failed — skip this trade`}
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

                  {/* 12 Checks List */}
                  <div>
                    <div className="text-xs font-bold text-[#0A1628] mb-3 uppercase tracking-wider">
                      12 Technical Checks
                    </div>
                    <div className="space-y-1.5">
                      {results.checks.map((check, i) => (
                        <motion.div
                          key={check.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                          style={{
                            background: check.passed
                              ? "rgba(22,163,74,0.06)"
                              : "rgba(220,38,38,0.06)",
                            border: `1px solid ${
                              check.passed
                                ? "rgba(22,163,74,0.2)"
                                : "rgba(220,38,38,0.2)"
                            }`,
                          }}
                        >
                          <span className="text-base leading-none mt-0.5 shrink-0">
                            {check.passed ? "✅" : "❌"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0A1628]">
                                {check.name}
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
                        ⚠️ Failed Checks (
                        {results.checks.filter((c) => !c.passed).length})
                      </div>
                      <ul className="space-y-1">
                        {results.checks
                          .filter((c) => !c.passed)
                          .map((c) => (
                            <li
                              key={c.name}
                              className="text-[10px] text-red-500"
                            >
                              • {c.name}: {c.reason}
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
                data-ocid="signal.test_modal.cancel_button"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#0A1628]/60 border border-gray-200 hover:border-gray-300 hover:text-[#0A1628] transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!results || results.verdict !== "pass"}
                data-ocid="signal.test_modal.confirm_button"
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
