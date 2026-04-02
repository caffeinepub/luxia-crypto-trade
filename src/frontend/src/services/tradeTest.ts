import type { Signal } from "./signalEngine";

export interface CheckResult {
  name: string;
  passed: boolean;
  value: string;
  reason: string;
  weight: number; // 1 = normal, 2 = critical
}

export interface TradeTestResult {
  checks: CheckResult[];
  score: number;
  maxScore: number;
  weightedScore: number;
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
  passedCritical: boolean;
}

export interface LiveOHLC {
  rsi: number;
  macdHistogram: number;
  ema9: number;
  ema21: number;
  volumeRatio: number;
  priceVelocity: number; // % change in last 4 candles
  sellPressure: number; // 0-1, higher = more selling
  recentHigh: number;
  recentLow: number;
  closes: number[];
}

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

function calcStochRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const rsiValues: number[] = [];
  for (let i = period; i <= closes.length; i++) {
    rsiValues.push(calcRSI(closes.slice(0, i), Math.min(period, i - 1)));
  }
  const minRsi = Math.min(...rsiValues);
  const maxRsi = Math.max(...rsiValues);
  if (maxRsi === minRsi) return 50;
  const lastRsi = rsiValues[rsiValues.length - 1];
  return ((lastRsi - minRsi) / (maxRsi - minRsi)) * 100;
}

function calcBollingerPosition(closes: number[], period = 20): number {
  // Returns position within Bollinger Bands: 0=lower, 0.5=mid, 1=upper
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const last = closes[closes.length - 1];
  if (upper === lower) return 0.5;
  return Math.max(0, Math.min(1, (last - lower) / (upper - lower)));
}

function calcVolumeWeightedMomentum(closes: number[]): number {
  // Weighted momentum: recent candles matter more
  if (closes.length < 5) return 0;
  const recent = closes.slice(-5);
  const weights = [0.1, 0.15, 0.2, 0.25, 0.3];
  let weightedChange = 0;
  for (let i = 1; i < recent.length; i++) {
    weightedChange +=
      weights[i] * ((recent[i] - recent[i - 1]) / recent[i - 1]) * 100;
  }
  return weightedChange;
}

export async function fetchLiveOHLC(coinId: string): Promise<LiveOHLC | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data: number[][] = await res.json();
    if (!data || data.length < 15) return null;
    const closes = data.map((d) => d[4]);
    const highs = data.map((d) => d[2]);
    const lows = data.map((d) => d[3]);
    const rsi = calcRSI(closes);
    const macdHistogram = calcMACDHistogram(closes);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    // Volume proxy: price range vs average range
    const ranges = data.map((d) => d[2] - d[3]);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const lastRange = ranges[ranges.length - 1];
    const volumeRatio = avgRange > 0 ? Math.min(4, lastRange / avgRange) : 1;
    // Price velocity: last 4 candles
    const last4 = closes.slice(-4);
    const priceVelocity =
      ((last4[last4.length - 1] - last4[0]) / last4[0]) * 100;
    // Sell pressure: count down-closes in last 6 candles
    const last6 = closes.slice(-6);
    let downCount = 0;
    for (let i = 1; i < last6.length; i++) {
      if (last6[i] < last6[i - 1]) downCount++;
    }
    const sellPressure = downCount / (last6.length - 1);
    const recentHigh = Math.max(...highs.slice(-8));
    const recentLow = Math.min(...lows.slice(-8));
    return {
      rsi,
      macdHistogram,
      ema9,
      ema21,
      volumeRatio,
      priceVelocity,
      sellPressure,
      recentHigh,
      recentLow,
      closes,
    };
  } catch {
    return null;
  }
}

export function runTradeChecks(
  signal: Signal,
  live: LiveOHLC | null,
): CheckResult[] {
  const rsi = live?.rsi ?? signal.rsiValue;
  const macdH = live?.macdHistogram ?? signal.macdHistogram;
  const ema9 = live?.ema9 ?? signal.ema9;
  const ema21 = live?.ema21 ?? signal.ema21;
  const volumeRatio = live?.volumeRatio ?? signal.volumeRatio;
  const momentum = signal.momentum;
  const dumpRisk = signal.dumpRisk;
  const distToHigh24h = signal.distToHigh24h ?? 0.05;
  const tpDist = (signal.takeProfit - signal.entryPrice) / signal.entryPrice;
  const slDist = (signal.entryPrice - signal.stopLoss) / signal.entryPrice;
  const atrPct = signal.atr / signal.entryPrice;
  const priceVelocity = live?.priceVelocity ?? 0;
  const sellPressure = live?.sellPressure ?? 0;
  const closes = live?.closes ?? [];
  const bollingerPos = closes.length > 20 ? calcBollingerPosition(closes) : 0.5;
  const stochRsi = closes.length > 14 ? calcStochRSI(closes) : 50;
  const weightedMom =
    closes.length > 5 ? calcVolumeWeightedMomentum(closes) : momentum;

  return [
    // CRITICAL checks (weight=2): these alone can kill the trade
    {
      name: "RSI Zone (Critical)",
      passed: rsi >= 42 && rsi <= 68,
      value: `RSI ${rsi.toFixed(1)}`,
      weight: 2,
      reason:
        rsi < 42
          ? `RSI ${rsi.toFixed(1)} — oversold territory, may not recover. Wait for RSI > 42 before entering.`
          : rsi > 68
            ? `RSI ${rsi.toFixed(1)} — overbought! High reversal risk. Coin likely to pull back before any TP hit.`
            : `RSI ${rsi.toFixed(1)} — in ideal 42–68 buy zone. Safe to enter ✓`,
    },
    {
      name: "Dump Risk Gate (Critical)",
      passed: dumpRisk === "Low",
      value: `Risk: ${dumpRisk}`,
      weight: 2,
      reason:
        dumpRisk === "Low"
          ? "Low dump risk — all 5 dump factors checked: no exhaustion, not near resistance, healthy RSI, positive MACD, no extreme pump ✓"
          : dumpRisk === "Medium"
            ? "Medium dump risk — 2-3 dump factors triggered. Coin shows reversal signals. High chance of dump before TP."
            : "HIGH dump risk — 4+ dump factors triggered. Strong reversal indicators. This trade will likely dump.",
    },
    {
      name: "MACD Histogram (Critical)",
      passed: macdH > 0,
      value: `Histogram ${macdH.toFixed(6)}`,
      weight: 2,
      reason:
        macdH > 0
          ? `Positive histogram (${macdH.toFixed(6)}) — bullish momentum confirmed. Buyers in control ✓`
          : `Negative histogram (${macdH.toFixed(6)}) — bearish momentum. Sellers winning. Price likely to fall.`,
    },
    {
      name: "Sell Pressure (Critical)",
      passed: sellPressure < 0.5,
      value: `${(sellPressure * 100).toFixed(0)}% down-closes`,
      weight: 2,
      reason:
        sellPressure < 0.35
          ? `Only ${(sellPressure * 100).toFixed(0)}% of recent candles closed down — strong buy pressure ✓`
          : sellPressure < 0.5
            ? `${(sellPressure * 100).toFixed(0)}% of candles down — moderate sell activity, acceptable ✓`
            : `${(sellPressure * 100).toFixed(0)}% of recent candles closed down — sellers dominating. Pullback likely.`,
    },
    // NORMAL checks (weight=1)
    {
      name: "EMA Alignment",
      passed: ema9 > ema21,
      value: `EMA9 ${ema9 > ema21 ? ">" : "<"} EMA21`,
      weight: 1,
      reason:
        ema9 > ema21
          ? "EMA9 above EMA21 — bullish trend alignment confirmed ✓"
          : "EMA9 below EMA21 — death cross pattern. Bearish trend. Not safe to enter.",
    },
    {
      name: "Volume Strength",
      passed: volumeRatio >= 1.2,
      value: `${volumeRatio.toFixed(2)}x avg`,
      weight: 1,
      reason:
        volumeRatio >= 1.5
          ? `Volume ${volumeRatio.toFixed(2)}x above average — very strong buyer participation ✓`
          : volumeRatio >= 1.2
            ? `Volume ${volumeRatio.toFixed(2)}x above average — solid buyer participation ✓`
            : `Volume only ${volumeRatio.toFixed(2)}x average — weak, move not backed by buyers. Risk of failure.`,
    },
    {
      name: "Momentum Window",
      passed: momentum >= 0.5 && momentum <= 9,
      value: `${momentum.toFixed(2)}% 24h`,
      weight: 1,
      reason:
        momentum < 0.5
          ? `Only ${momentum.toFixed(2)}% momentum — coin is stagnant. Will take too long to reach TP.`
          : momentum > 12
            ? `${momentum.toFixed(2)}% momentum — coin is exhausted! Pump already extended. Reversal imminent.`
            : momentum > 9
              ? `${momentum.toFixed(2)}% momentum — slightly extended but manageable. Monitor closely.`
              : `${momentum.toFixed(2)}% momentum — in ideal 0.5–9% zone. Active but not exhausted ✓`,
    },
    {
      name: "Price Velocity (Last 4 Candles)",
      passed: priceVelocity > 0,
      value: `${priceVelocity >= 0 ? "+" : ""}${priceVelocity.toFixed(3)}%`,
      weight: 1,
      reason:
        priceVelocity > 0.2
          ? `+${priceVelocity.toFixed(3)}% recent velocity — coin actively moving toward TP right now ✓`
          : priceVelocity > 0
            ? `+${priceVelocity.toFixed(3)}% velocity — slight upward motion. May gain speed ✓`
            : `${priceVelocity.toFixed(3)}% velocity — coin moving DOWN in last 4 candles. Pullback in progress.`,
    },
    {
      name: "Resistance Room",
      passed: distToHigh24h > 0.03,
      value: `${(distToHigh24h * 100).toFixed(2)}% to 24h high`,
      weight: 1,
      reason:
        distToHigh24h > 0.06
          ? `${(distToHigh24h * 100).toFixed(2)}% space before 24h high — excellent room to run ✓`
          : distToHigh24h > 0.03
            ? `${(distToHigh24h * 100).toFixed(2)}% before 24h high resistance — sufficient room ✓`
            : `Only ${(distToHigh24h * 100).toFixed(2)}% before 24h high — hitting resistance soon. TP may be blocked.`,
    },
    {
      name: "Bollinger Band Position",
      passed: bollingerPos < 0.75,
      value: `${(bollingerPos * 100).toFixed(0)}% of band`,
      weight: 1,
      reason:
        bollingerPos < 0.4
          ? `Price at ${(bollingerPos * 100).toFixed(0)}% of Bollinger Band — near lower band, good entry zone ✓`
          : bollingerPos < 0.75
            ? `Price at ${(bollingerPos * 100).toFixed(0)}% of Bollinger Band — mid-range, acceptable ✓`
            : `Price at ${(bollingerPos * 100).toFixed(0)}% of Bollinger Band — near upper band! Overbought relative to recent range.`,
    },
    {
      name: "Stochastic RSI",
      passed: stochRsi >= 20 && stochRsi <= 75,
      value: `StochRSI ${stochRsi.toFixed(1)}`,
      weight: 1,
      reason:
        stochRsi < 20
          ? `StochRSI ${stochRsi.toFixed(1)} — deeply oversold. Potential reversal coming, but too early.`
          : stochRsi > 80
            ? `StochRSI ${stochRsi.toFixed(1)} — overbought! Strong reversal signal. Likely to correct before TP.`
            : `StochRSI ${stochRsi.toFixed(1)} — healthy range, not overbought ✓`,
    },
    {
      name: "ATR vs TP Realism",
      passed: atrPct > 0 && tpDist <= atrPct * 3,
      value: `TP ${(tpDist * 100).toFixed(2)}% | ATR×3: ${(atrPct * 3 * 100).toFixed(2)}%`,
      weight: 1,
      reason:
        tpDist <= atrPct * 2
          ? `TP at ${(tpDist * 100).toFixed(2)}% — very realistic target within ATR×2. High chance of hitting ✓`
          : tpDist <= atrPct * 3
            ? `TP at ${(tpDist * 100).toFixed(2)}% — within ATR×3 range. Realistic target ✓`
            : `TP at ${(tpDist * 100).toFixed(2)}% exceeds ATR×3 (${(atrPct * 3 * 100).toFixed(2)}%). Target may be too far for current volatility.`,
    },
    {
      name: "AI Validation",
      passed: signal.aiRating === "Strong Buy" || signal.aiRating === "Buy",
      value: `AI: ${signal.aiRating ?? "Not rated"}`,
      weight: 1,
      reason:
        signal.aiRating === "Strong Buy"
          ? "AI: STRONG BUY — Groq AI (Llama 3.3-70b) rates this the highest certainty ✓"
          : signal.aiRating === "Buy"
            ? "AI: BUY — Groq AI confirms this is a valid positive signal ✓"
            : signal.aiRating === "Hold"
              ? "AI: HOLD — AI is not confident enough. Entry not recommended."
              : signal.aiRating === "Skip"
                ? "AI: SKIP — AI rejected this signal outright. Do not enter."
                : "Signal not yet AI-validated. No external AI confirmation.",
    },
    {
      name: "Trend Structure (HH/HL)",
      passed: signal.trendStructure === "HH/HL",
      value: signal.trendStructure,
      weight: 1,
      reason:
        signal.trendStructure === "HH/HL"
          ? "Higher Highs + Higher Lows confirmed — clear uptrend in place ✓"
          : "No HH/HL pattern detected — trend is choppy or unclear. No structural confirmation.",
    },
    {
      name: "Weighted Momentum Trend",
      passed: weightedMom > 0,
      value: `${weightedMom >= 0 ? "+" : ""}${weightedMom.toFixed(3)}%`,
      weight: 1,
      reason:
        weightedMom > 0.1
          ? `Weighted momentum +${weightedMom.toFixed(3)}% — recent candles show accelerating upward move ✓`
          : weightedMom > 0
            ? "Slight positive weighted momentum. Price edging up ✓"
            : `Negative weighted momentum (${weightedMom.toFixed(3)}%) — recent candles trending down. Risk of SL hit.`,
    },
    {
      name: "Risk:Reward Ratio",
      passed: signal.rrRatio >= 1.5,
      value: `R:R ${signal.rrRatio.toFixed(2)}`,
      weight: 1,
      reason:
        signal.rrRatio >= 3
          ? `R:R ${signal.rrRatio.toFixed(2)} — exceptional setup, massive profit potential vs risk ✓`
          : signal.rrRatio >= 2
            ? `R:R ${signal.rrRatio.toFixed(2)} — excellent risk/reward ratio ✓`
            : signal.rrRatio >= 1.5
              ? `R:R ${signal.rrRatio.toFixed(2)} — meets minimum institutional R:R requirement ✓`
              : `R:R ${signal.rrRatio.toFixed(2)} — below 1.5 minimum. Risk exceeds potential reward.`,
    },
    {
      name: "SL Width Safety",
      passed: slDist >= tpDist * 2.5,
      value: `SL ${(slDist * 100).toFixed(2)}% wide`,
      weight: 1,
      reason:
        slDist >= tpDist * 3
          ? `SL ${(slDist * 100).toFixed(2)}% wide — very robust. Normal volatility cannot touch this ✓`
          : slDist >= tpDist * 2.5
            ? `SL ${(slDist * 100).toFixed(2)}% wide — sufficient to survive normal price noise ✓`
            : `SL too tight (${(slDist * 100).toFixed(2)}%). Regular market volatility could stop you out before TP.`,
    },
  ];
}

export function computeTestResult(
  signal: Signal,
  checks: CheckResult[],
  liveRsi: number,
): TradeTestResult {
  const passed = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  // Weighted score
  const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
  const passedWeight = checks
    .filter((c) => c.passed)
    .reduce((a, c) => a + c.weight, 0);
  const weightedScore = passedWeight / totalWeight;

  // Critical checks must ALL pass
  const criticalChecks = checks.filter((c) => c.weight === 2);
  const passedCritical = criticalChecks.every((c) => c.passed);

  // Dump probability
  let dumpProb = 0;
  if (liveRsi > 65) dumpProb += 18;
  if (signal.momentum > 8) dumpProb += 15;
  const distToHigh24h = signal.distToHigh24h ?? 0.05;
  if (distToHigh24h < 0.03) dumpProb += 22;
  if (signal.dumpRisk === "Medium") dumpProb += 18;
  else if (signal.dumpRisk === "High") dumpProb += 45;
  if (signal.macdHistogram < 0) dumpProb += 18;
  if (signal.trendStructure === "unclear") dumpProb += 10;
  const dumpProbability = Math.min(90, dumpProb);

  // TP probability based on weighted score and checks
  const baseTP = passedCritical
    ? 55 + weightedScore * 40
    : 30 + weightedScore * 25;
  const tpProbability = Math.min(97, Math.max(20, baseTP));
  const slProbability = Math.max(
    3,
    Math.min(75, 100 - tpProbability - dumpProbability / 2),
  );

  const tpDist = (signal.takeProfit - signal.entryPrice) / signal.entryPrice;
  const slDist = (signal.entryPrice - signal.stopLoss) / signal.entryPrice;
  const profitAtTP = 10 * tpDist;
  const lossAtSL = 10 * slDist;
  const expectedValue =
    profitAtTP * (tpProbability / 100) - lossAtSL * (slProbability / 100);

  // Verdict: must pass all 4 critical checks + 9/12 normal checks
  const normalPassed = checks.filter((c) => c.weight === 1 && c.passed).length;
  const normalTotal = checks.filter((c) => c.weight === 1).length;
  let verdict: "pass" | "uncertain" | "fail";
  if (passedCritical && normalPassed >= Math.ceil(normalTotal * 0.75)) {
    verdict = "pass";
  } else if (passedCritical && normalPassed >= Math.ceil(normalTotal * 0.5)) {
    verdict = "uncertain";
  } else {
    verdict = "fail";
  }

  return {
    checks,
    score: passed,
    maxScore: totalChecks,
    weightedScore,
    dumpProbability,
    tpProbability,
    slProbability,
    profitAtTP,
    lossAtSL,
    expectedValue,
    verdict,
    liveRsi,
    liveMacd: signal.macdHistogram,
    liveVolume: signal.volumeRatio,
    passedCritical,
  };
}

/** Run full test on a signal. Returns result. */
export async function runFullTest(signal: Signal): Promise<TradeTestResult> {
  const coinId = signal.coinId ?? signal.symbol.split("-")[0].toLowerCase();
  const live = await fetchLiveOHLC(coinId);
  const checks = runTradeChecks(signal, live);
  const liveRsi = live?.rsi ?? signal.rsiValue;
  return computeTestResult(signal, checks, liveRsi);
}
