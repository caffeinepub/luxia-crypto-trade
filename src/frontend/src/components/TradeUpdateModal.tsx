import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  type CandlePatternResult,
  type ChartAIAnalysis,
  type ChartPatternResult,
  runChartPatternAnalysis,
} from "../services/chartPatternAnalysis";
import type { Signal } from "../services/signalEngine";
import {
  type CheckResult,
  type LiveOHLC,
  type TradeTestResult,
  computeTestResult,
  fetchLiveOHLC,
  runTradeChecks,
} from "../services/tradeTest";

interface TrackedTrade extends Signal {
  trackedAt: number;
  outcome?: "hit" | "missed";
}

interface TradeUpdateModalProps {
  trade: TrackedTrade;
  currentPrice: number;
  open: boolean;
  onClose: () => void;
}

const STAGES = [
  "Fetching fresh OHLCV data from CoinGecko...",
  "Running 20 live technical checks...",
  "Analyzing current position vs entry...",
  "Fetching 1h + 4h chart data...",
  "AI trader analyzing chart patterns...",
  "Computing final recommendation...",
];

type Verdict = "hold" | "caution" | "exit";

interface UpdateResult extends TradeTestResult {
  trackedVerdict: Verdict;
  pnlPct: number;
  tpDistPct: number;
  slDistPct: number;
  priceVelocity: number;
  profitAtTPFromCurrent: number;
  lossAtSLFromCurrent: number;
  expectedValueFromCurrent: number;
  chartAnalysis: ChartAIAnalysis | null;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildTrackedChecks(
  trade: TrackedTrade,
  currentPrice: number,
  live: LiveOHLC | null,
): CheckResult[] {
  const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const tpDistPct = ((trade.takeProfit - currentPrice) / currentPrice) * 100;
  const slDistPct = ((currentPrice - trade.stopLoss) / currentPrice) * 100;
  const priceVelocity = live?.priceVelocity ?? 0;

  return [
    {
      name: "Current P&L Position",
      passed: pnlPct > -1.5,
      value: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% from entry`,
      weight: 2,
      reason:
        pnlPct > 2
          ? `Currently +${pnlPct.toFixed(2)}% in profit \u2014 trade is performing well. TP approaching ✓`
          : pnlPct > 0
            ? `+${pnlPct.toFixed(2)}% above entry \u2014 slight profit, holding steady ✓`
            : pnlPct > -1.5
              ? `${pnlPct.toFixed(2)}% near entry \u2014 slight dip, within normal volatility range. Watch closely.`
              : `${pnlPct.toFixed(2)}% below entry \u2014 trade in notable loss. Risk of SL hit is elevated.`,
    },
    {
      name: "TP Distance Feasibility",
      passed: tpDistPct > 0 && tpDistPct <= 8,
      value: `${tpDistPct.toFixed(2)}% to TP`,
      weight: 2,
      reason:
        tpDistPct <= 0
          ? "Price has reached or exceeded TP level! Consider taking profit now."
          : tpDistPct <= 2
            ? `Only ${tpDistPct.toFixed(2)}% to TP \u2014 very close! Price should reach target soon ✓`
            : tpDistPct <= 5
              ? `${tpDistPct.toFixed(2)}% to TP \u2014 reasonable distance, target still achievable ✓`
              : tpDistPct <= 8
                ? `${tpDistPct.toFixed(2)}% to TP \u2014 somewhat far but achievable if momentum holds ✓`
                : `${tpDistPct.toFixed(2)}% to TP \u2014 TP is very far. May take much longer than expected or fail.`,
    },
    {
      name: "SL Proximity Safety",
      passed: slDistPct > 2,
      value: `${slDistPct.toFixed(2)}% from SL`,
      weight: 2,
      reason:
        slDistPct > 6
          ? `SL is ${slDistPct.toFixed(2)}% away \u2014 very safe buffer, normal volatility cannot touch it ✓`
          : slDistPct > 4
            ? `SL is ${slDistPct.toFixed(2)}% away \u2014 comfortable buffer ✓`
            : slDistPct > 2
              ? `SL is ${slDistPct.toFixed(2)}% away \u2014 acceptable but monitor closely`
              : `\u26a0\ufe0f SL DANGER: Only ${slDistPct.toFixed(2)}% from stop-loss! A single spike could stop you out. Consider exiting.`,
    },
    {
      name: "Trend Continuation",
      passed: priceVelocity > -0.5,
      value: `${priceVelocity >= 0 ? "+" : ""}${priceVelocity.toFixed(3)}% velocity`,
      weight: 1,
      reason:
        priceVelocity > 0.3
          ? `+${priceVelocity.toFixed(3)}% price velocity \u2014 coin actively moving toward TP right now ✓`
          : priceVelocity > 0
            ? `+${priceVelocity.toFixed(3)}% \u2014 slight upward motion continuing ✓`
            : priceVelocity > -0.5
              ? `${priceVelocity.toFixed(3)}% slight pullback \u2014 still within acceptable range. Monitor.`
              : `${priceVelocity.toFixed(3)}% \u2014 price is falling in last 4 candles. Trade setup may be breaking down.`,
    },
  ];
}

function deriveTrackedVerdict(
  base: TradeTestResult,
  currentPrice: number,
  trade: TrackedTrade,
  live: LiveOHLC | null,
): Verdict {
  const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const slDistPct = ((currentPrice - trade.stopLoss) / currentPrice) * 100;
  const priceVelocity = live?.priceVelocity ?? 0;

  if (!base.passedCritical) return "exit";
  if (slDistPct <= 2) return "exit";
  if (trade.dumpRisk === "High") return "exit";
  if (pnlPct < -3) return "exit";

  const tpDistPct = ((trade.takeProfit - currentPrice) / currentPrice) * 100;
  const normalPassed = base.checks.filter(
    (c) => c.weight === 1 && c.passed,
  ).length;
  const normalTotal = base.checks.filter((c) => c.weight === 1).length;
  if (
    base.passedCritical &&
    normalPassed >= Math.ceil(normalTotal * 0.75) &&
    (pnlPct > -0.5 || tpDistPct <= 4) &&
    priceVelocity > -0.3
  ) {
    return "hold";
  }

  return "caution";
}

function combineVerdicts(
  checksVerdict: Verdict,
  chartVerdict: "hold" | "caution" | "exit",
): Verdict {
  if (checksVerdict === "exit" && chartVerdict === "exit") return "exit";
  if (checksVerdict === "exit" && chartVerdict === "hold") return "caution";
  if (checksVerdict === "hold" && chartVerdict === "exit") return "caution";
  if (checksVerdict === "hold" && chartVerdict === "hold") return "hold";
  return "caution";
}

export default function TradeUpdateModal({
  trade,
  currentPrice,
  open,
  onClose,
}: TradeUpdateModalProps) {
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const abortRef = useRef(false);

  const coinName = trade.symbol.split("-")[0];
  const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;

  useEffect(() => {
    if (!open) {
      setStage(-1);
      setResult(null);
      setLoading(false);
      setChartLoading(false);
      abortRef.current = false;
      return;
    }
    abortRef.current = false;
    runAnalysis();
  }, [open]);

  async function runAnalysis() {
    setLoading(true);
    setChartLoading(true);
    setResult(null);

    setStage(0);
    const coinId = trade.coinId ?? coinName.toLowerCase();

    // Run OHLCV fetch + chart analysis in parallel
    const [live, chartAnalysis] = await Promise.all([
      fetchLiveOHLC(coinId).then((res) => {
        setStage(1);
        return res;
      }),
      (async () => {
        setStage(3);
        await delay(200);
        setStage(4);
        const ca = await runChartPatternAnalysis(
          coinId,
          coinName,
          currentPrice,
          trade.entryPrice,
          trade.takeProfit,
          trade.stopLoss,
        );
        setChartLoading(false);
        return ca;
      })(),
    ]);

    if (abortRef.current) return;

    await delay(400);
    if (abortRef.current) return;
    const baseChecks = runTradeChecks(trade, live);
    const trackedChecks = buildTrackedChecks(trade, currentPrice, live);
    const allChecks = [...baseChecks, ...trackedChecks];

    setStage(2);
    await delay(500);
    if (abortRef.current) return;

    setStage(5);
    await delay(400);
    if (abortRef.current) return;

    const liveRsi = live?.rsi ?? trade.rsiValue;
    const base = computeTestResult(trade, allChecks, liveRsi);
    const checksVerdict = deriveTrackedVerdict(base, currentPrice, trade, live);
    const finalVerdict = chartAnalysis
      ? combineVerdicts(checksVerdict, chartAnalysis.verdict)
      : checksVerdict;

    const tpDistPct = ((trade.takeProfit - currentPrice) / currentPrice) * 100;
    const slDistPct = ((currentPrice - trade.stopLoss) / currentPrice) * 100;
    const priceVelocity = live?.priceVelocity ?? 0;

    const profitAtTPFromCurrent = 10 * (tpDistPct / 100);
    const lossAtSLFromCurrent = 10 * (slDistPct / 100);
    const expectedValueFromCurrent =
      profitAtTPFromCurrent * (base.tpProbability / 100) -
      lossAtSLFromCurrent * (base.slProbability / 100);

    setResult({
      ...base,
      trackedVerdict: finalVerdict,
      pnlPct,
      tpDistPct,
      slDistPct,
      priceVelocity,
      profitAtTPFromCurrent,
      lossAtSLFromCurrent,
      expectedValueFromCurrent,
      chartAnalysis,
    });
    setLoading(false);
  }

  const verdictConfig: Record<
    Verdict,
    { color: string; bg: string; label: string; icon: string }
  > = {
    hold: {
      color: "#16a34a",
      bg: "rgba(22,163,74,0.08)",
      label: "HOLD \u2014 ON TRACK TO HIT TP",
      icon: "\u2705",
    },
    caution: {
      color: "#d97706",
      bg: "rgba(217,119,6,0.08)",
      label: "HOLD WITH CAUTION",
      icon: "\u26a0\ufe0f",
    },
    exit: {
      color: "#dc2626",
      bg: "rgba(220,38,38,0.08)",
      label: "EXIT NOW \u2014 HIGH RISK",
      icon: "\ud83d\udea8",
    },
  };

  const vc = result ? verdictConfig[result.trackedVerdict] : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            background: "rgba(10,22,40,0.7)",
            backdropFilter: "blur(6px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: "#fff",
              boxShadow: "0 24px 64px rgba(10,22,40,0.45)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-start justify-between shrink-0"
              style={{ background: "#0A1628" }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-base">
                    {coinName}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(201,168,76,0.15)",
                      color: "#C9A84C",
                    }}
                  >
                    {trade.symbol}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        pnlPct >= 0
                          ? "rgba(22,163,74,0.15)"
                          : "rgba(220,38,38,0.15)",
                      color: pnlPct >= 0 ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {pnlPct >= 0 ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </span>
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: "rgba(201,168,76,0.7)" }}
                >
                  Professional Chart + Technical Analysis
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/50 hover:text-white transition-colors text-xl leading-none mt-0.5"
              >
                \u00d7
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Loading stages */}
              {loading && (
                <div className="space-y-2">
                  {STAGES.map((s, idx) => (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: idx <= stage ? 1 : 0.25, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center gap-2.5"
                    >
                      <div
                        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                        style={{
                          background:
                            idx < stage
                              ? "#16a34a"
                              : idx === stage
                                ? "#C9A84C"
                                : "#e5e7eb",
                        }}
                      >
                        {idx < stage ? (
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                            aria-label="Done"
                            role="img"
                          >
                            <path
                              d="M1.5 4L3.5 6L6.5 2"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : idx === stage ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Number.POSITIVE_INFINITY,
                              duration: 0.8,
                              ease: "linear",
                            }}
                            className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full"
                          />
                        ) : null}
                      </div>
                      <span
                        className="text-xs"
                        style={{
                          color:
                            idx === stage
                              ? "#0A1628"
                              : idx < stage
                                ? "#16a34a"
                                : "#9ca3af",
                        }}
                      >
                        {s}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Results */}
              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Position summary */}
                  <div
                    className="rounded-xl p-4 grid grid-cols-2 gap-3"
                    style={{
                      background: "rgba(10,22,40,0.04)",
                      border: "1px solid rgba(10,22,40,0.08)",
                    }}
                  >
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        Current Price
                      </div>
                      <div className="text-sm font-bold text-[#0A1628]">
                        ${currentPrice.toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        Entry Price
                      </div>
                      <div className="text-sm font-bold text-[#0A1628]">
                        ${trade.entryPrice.toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        P&L
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{
                          color: result.pnlPct >= 0 ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {result.pnlPct >= 0 ? "+" : ""}
                        {result.pnlPct.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        To TP
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{ color: "#C9A84C" }}
                      >
                        {result.tpDistPct.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        SL Buffer
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{
                          color: result.slDistPct > 3 ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {result.slDistPct.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                        Velocity
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{
                          color:
                            result.priceVelocity >= 0 ? "#16a34a" : "#f59e0b",
                        }}
                      >
                        {result.priceVelocity >= 0 ? "+" : ""}
                        {result.priceVelocity.toFixed(3)}%
                      </div>
                    </div>
                  </div>

                  {/* Critical gates banner */}
                  <div
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: result.passedCritical
                        ? "rgba(22,163,74,0.08)"
                        : "rgba(220,38,38,0.08)",
                      border: `1px solid ${
                        result.passedCritical
                          ? "rgba(22,163,74,0.25)"
                          : "rgba(220,38,38,0.25)"
                      }`,
                    }}
                  >
                    <span className="text-lg">
                      {result.passedCritical ? "\ud83d\udd12" : "\ud83d\udeab"}
                    </span>
                    <div>
                      <div
                        className="text-xs font-bold"
                        style={{
                          color: result.passedCritical ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {result.passedCritical
                          ? "ALL CRITICAL GATES PASSED"
                          : "CRITICAL GATE FAILED"}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        RSI Zone \u00b7 Dump Risk \u00b7 MACD \u00b7 Sell
                        Pressure \u00b7 P&L \u00b7 TP Distance \u00b7 SL Safety
                      </div>
                    </div>
                  </div>

                  {/* BIG VERDICT */}
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="rounded-2xl px-5 py-5 text-center"
                    style={{
                      background: vc!.bg,
                      border: `2px solid ${vc!.color}`,
                    }}
                  >
                    <div className="text-3xl mb-1">{vc!.icon}</div>
                    <div
                      className="text-xl font-black tracking-tight"
                      style={{ color: vc!.color }}
                    >
                      {vc!.label}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1.5">
                      Score: {result.score}/{result.maxScore} checks passed
                      \u00b7 Weighted: {(result.weightedScore * 100).toFixed(0)}
                      %
                    </div>
                  </motion.div>

                  {/* Outcome probabilities */}
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{
                      background: "rgba(10,22,40,0.03)",
                      border: "1px solid rgba(10,22,40,0.07)",
                    }}
                  >
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Outcome Probabilities
                    </div>
                    <OutcomeBar
                      label="TP Hit"
                      value={result.tpProbability}
                      color="#16a34a"
                    />
                    <OutcomeBar
                      label="SL Hit"
                      value={result.slProbability}
                      color="#dc2626"
                    />
                    <OutcomeBar
                      label="Dump"
                      value={result.dumpProbability}
                      color="#f59e0b"
                    />
                  </div>

                  {/* PROFESSIONAL CHART ANALYSIS */}
                  {result.chartAnalysis ? (
                    <ChartAnalysisPanel analysis={result.chartAnalysis} />
                  ) : (
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{ border: "1px solid rgba(201,168,76,0.2)" }}
                    >
                      <div
                        className="px-4 py-3 flex items-center gap-2"
                        style={{ background: "#0A1628" }}
                      >
                        <span className="text-base">\ud83d\udcca</span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Professional Chart Analysis
                        </span>
                        <span
                          className="text-[10px] ml-auto"
                          style={{ color: "rgba(201,168,76,0.6)" }}
                        >
                          Not available
                        </span>
                      </div>
                    </div>
                  )}

                  {/* $10 calculator from current price */}
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "rgba(201,168,76,0.06)",
                      border: "1px solid rgba(201,168,76,0.2)",
                    }}
                  >
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                      style={{ color: "#C9A84C" }}
                    >
                      $10 Trade Simulation (from current price)
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">
                          If TP Hit
                        </div>
                        <div className="text-sm font-bold text-green-600">
                          +${result.profitAtTPFromCurrent.toFixed(3)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">
                          If SL Hit
                        </div>
                        <div className="text-sm font-bold text-red-500">
                          -${result.lossAtSLFromCurrent.toFixed(3)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">
                          Exp. Value
                        </div>
                        <div
                          className="text-sm font-bold"
                          style={{
                            color:
                              result.expectedValueFromCurrent >= 0
                                ? "#16a34a"
                                : "#dc2626",
                          }}
                        >
                          {result.expectedValueFromCurrent >= 0 ? "+" : ""}$
                          {result.expectedValueFromCurrent.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* All 20 checks */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      All 20 Checks \u2014 {result.score}/{result.maxScore}{" "}
                      Passed
                    </div>
                    <div className="space-y-1.5">
                      {result.checks.map((check, idx) => (
                        <motion.div
                          key={check.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.025 }}
                          className="rounded-lg px-3 py-2 flex items-start gap-2.5"
                          style={{
                            background: check.passed
                              ? "rgba(22,163,74,0.06)"
                              : check.weight === 2
                                ? "rgba(220,38,38,0.08)"
                                : "rgba(220,38,38,0.04)",
                            border: `1px solid ${
                              check.passed
                                ? "rgba(22,163,74,0.15)"
                                : check.weight === 2
                                  ? "rgba(220,38,38,0.25)"
                                  : "rgba(220,38,38,0.12)"
                            }`,
                          }}
                        >
                          <span className="text-xs mt-0.5 shrink-0">
                            {check.passed
                              ? "\u2705"
                              : check.weight === 2
                                ? "\ud83d\udeab"
                                : "\u274c"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="text-[11px] font-semibold"
                                style={{
                                  color: check.passed
                                    ? "#16a34a"
                                    : check.weight === 2
                                      ? "#dc2626"
                                      : "#b91c1c",
                                }}
                              >
                                {check.name}
                              </span>
                              {check.weight === 2 && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: "rgba(220,38,38,0.12)",
                                    color: "#dc2626",
                                  }}
                                >
                                  CRITICAL
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">
                                {check.value}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                              {check.reason}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Failed checks summary */}
                  {result.trackedVerdict !== "hold" &&
                    result.checks.filter((c) => !c.passed).length > 0 && (
                      <div
                        className="rounded-xl p-3"
                        style={{
                          background: "rgba(220,38,38,0.05)",
                          border: "1px solid rgba(220,38,38,0.15)",
                        }}
                      >
                        <div className="text-[10px] font-bold text-red-600 mb-1.5">
                          Failed Checks (
                          {result.checks.filter((c) => !c.passed).length}{" "}
                          failures)
                        </div>
                        <ul className="space-y-1">
                          {result.checks
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
                                {c.weight === 2 ? "\ud83d\udeab" : "\u2022"}{" "}
                                {c.name}: {c.reason}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                </motion.div>
              )}

              {/* Chart analysis loading skeleton */}
              {chartLoading && !loading && <ChartAnalysisSkeleton />}
            </div>

            {/* Footer */}
            <div
              className="px-6 pb-5 pt-3 flex gap-3 shrink-0"
              style={{ borderTop: "1px solid rgba(10,22,40,0.08)" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#0A1628]/60 border border-gray-200 hover:border-gray-300 hover:text-[#0A1628] transition-all"
              >
                Close
              </button>
              {result && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: vc!.color,
                    color: "#fff",
                    boxShadow: `0 4px 14px ${vc!.color}55`,
                  }}
                >
                  {result.trackedVerdict === "hold"
                    ? "\u2705 Hold \u2014 Stay In Trade"
                    : result.trackedVerdict === "caution"
                      ? "\u26a0\ufe0f Monitor Closely"
                      : "\ud83d\udea8 Exit Trade Now"}
                </button>
              )}
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
}: { label: string; value: number; color: string }) {
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

function PatternBadge({
  pattern,
}: { pattern: CandlePatternResult | ChartPatternResult }) {
  const type = pattern.type;
  const strength = "strength" in pattern ? pattern.strength : 2;
  const bg =
    type === "bullish"
      ? "rgba(22,163,74,0.1)"
      : type === "bearish"
        ? "rgba(220,38,38,0.1)"
        : "rgba(107,114,128,0.1)";
  const color =
    type === "bullish" ? "#16a34a" : type === "bearish" ? "#dc2626" : "#6b7280";
  const icon =
    type === "bullish"
      ? "\ud83d\udfe2"
      : type === "bearish"
        ? "\ud83d\udd34"
        : "\u26aa";
  const tf = "timeframe" in pattern ? ` ${pattern.timeframe}` : "";

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background: bg, color, border: `1px solid ${color}30` }}
    >
      {icon} {pattern.name}
      {tf}
      {"strength" in pattern && strength === 3 ? " \u2605" : ""}
    </span>
  );
}

function ChartAnalysisPanel({ analysis }: { analysis: ChartAIAnalysis }) {
  const verdictConfig = {
    hold: {
      color: "#16a34a",
      label: "HOLD \u2014 Strong Bullish Structure",
      icon: "\u2705",
    },
    caution: {
      color: "#d97706",
      label: "CAUTION \u2014 Mixed Signals",
      icon: "\u26a0\ufe0f",
    },
    exit: {
      color: "#dc2626",
      label: "EXIT \u2014 Bearish Pressure",
      icon: "\ud83d\udea8",
    },
  };
  const vc = verdictConfig[analysis.verdict];
  const allPatterns = [
    ...analysis.patterns1h,
    ...analysis.patterns4h,
    ...analysis.chartPatterns.map((p) => ({
      ...p,
      strength: 2 as const,
      timeframe: undefined as any,
    })),
  ];
  const confluencePct = analysis.confluenceScore;
  const bullishPct = Math.min(100, confluencePct);
  const label4h =
    confluencePct > 65 ? "BULLISH" : confluencePct < 40 ? "BEARISH" : "NEUTRAL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(201,168,76,0.25)" }}
    >
      {/* Panel header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "#0A1628" }}
      >
        <span className="text-base">\ud83d\udcca</span>
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          Professional Chart Analysis
        </span>
        <span
          className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
        >
          Groq Llama 3.3-70b
        </span>
      </div>

      <div
        className="p-4 space-y-4"
        style={{ background: "rgba(10,22,40,0.02)" }}
      >
        {/* Multi-timeframe confluence */}
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Multi-Timeframe Confluence
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">1H Chart</span>
                <span
                  className="text-[10px] font-bold"
                  style={{
                    color:
                      bullishPct > 60
                        ? "#16a34a"
                        : bullishPct < 40
                          ? "#dc2626"
                          : "#d97706",
                  }}
                >
                  {bullishPct > 60
                    ? "BULLISH"
                    : bullishPct < 40
                      ? "BEARISH"
                      : "NEUTRAL"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bullishPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-2 rounded-full"
                  style={{
                    background:
                      bullishPct > 60
                        ? "#16a34a"
                        : bullishPct < 40
                          ? "#dc2626"
                          : "#d97706",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">4H Chart</span>
                <span
                  className="text-[10px] font-bold"
                  style={{
                    color:
                      confluencePct > 60
                        ? "#16a34a"
                        : confluencePct < 40
                          ? "#dc2626"
                          : "#d97706",
                  }}
                >
                  {label4h}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${confluencePct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                  className="h-2 rounded-full"
                  style={{
                    background:
                      confluencePct > 60
                        ? "#16a34a"
                        : confluencePct < 40
                          ? "#dc2626"
                          : "#d97706",
                  }}
                />
              </div>
            </div>
          </div>
          <div
            className="mt-2 text-center text-[11px] font-bold"
            style={{ color: "#C9A84C" }}
          >
            Confluence Score: {confluencePct}/100
          </div>
        </div>

        {/* Detected patterns */}
        {allPatterns.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Detected Patterns
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allPatterns.map((p, i) => (
                <PatternBadge key={`${p.name}-${i}`} pattern={p} />
              ))}
            </div>
          </div>
        )}

        {/* AI narrative */}
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            AI Trader Analysis
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              background: "#0A1628",
              border: "1px solid rgba(201,168,76,0.3)",
            }}
          >
            <p
              className="text-[12px] leading-relaxed italic"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              "{analysis.narrative}"
            </p>
          </div>
        </div>

        {/* TP Outlook */}
        {analysis.tpOutlook && (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.2)",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "#C9A84C" }}
            >
              TP Outlook:{" "}
            </span>
            <span className="text-[11px] text-gray-700">
              {analysis.tpOutlook}
            </span>
          </div>
        )}

        {/* Risk factors */}
        {analysis.riskFactors.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              \u26a0\ufe0f Risk Factors
            </div>
            <ul className="space-y-1">
              {analysis.riskFactors.map((r) => (
                <li
                  key={r}
                  className="text-[11px] text-gray-600 flex items-start gap-1.5"
                >
                  <span className="text-amber-500 shrink-0 mt-0.5">\u2022</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chart Verdict */}
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-2.5"
          style={{
            background: `${vc.color}12`,
            border: `1.5px solid ${vc.color}50`,
          }}
        >
          <span>{vc.icon}</span>
          <div>
            <div className="text-[11px] font-black" style={{ color: vc.color }}>
              CHART VERDICT: {vc.label}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Key Pattern: {analysis.keyPattern} \u00b7 Confidence:{" "}
              {analysis.confidence}%
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChartAnalysisSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(201,168,76,0.2)" }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "#0A1628" }}
      >
        <span className="text-base">\ud83d\udcca</span>
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          Professional Chart Analysis
        </span>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.4 }}
          className="ml-auto text-[10px]"
          style={{ color: "#C9A84C" }}
        >
          Analyzing...
        </motion.div>
      </div>
      <div
        className="p-4 space-y-3"
        style={{ background: "rgba(10,22,40,0.02)" }}
      >
        {[80, 60, 90].map((w, idx) => (
          <motion.div
            key={w}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 1.4,
              delay: idx * 0.2,
            }}
            className="h-3 rounded-full bg-gray-200"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}
