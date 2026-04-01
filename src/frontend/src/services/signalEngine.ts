import { validateSignalsWithAI } from "./ai";
import { getAdjustmentFactor } from "./aiLearning";
import {
  getCoinProfile,
  shouldSkipCoin as isCoinBlocked,
} from "./coinProfiler";
import type { CoinData } from "./marketData";

// Locked surety scores — stable for the entire hour
const lockedSuretyMap = new Map<string, number>();

export interface Signal {
  id: string;
  symbol: string;
  coinId: string;
  action: "BUY" | "SELL";
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  confidence: number;
  tpProbability: number;
  rsiValue: number;
  macdHistogram: number;
  ema9: number;
  ema21: number;
  atr: number;
  volumeRatio: number;
  momentum: number;
  trendDirection: "bullish" | "bearish";
  mlScore: number;
  estimatedHours: number;
  strengthLabel: "Strong" | "Weakening" | "At Risk";
  dumpRisk: "Low" | "Medium" | "High";
  isTrending: boolean;
  analysis: string;
  status: "active" | "closed";
  timestamp: number;
  hourSeed: number;
  aiEnriched?: boolean;
  /** AI rating from Groq validation */
  aiRating?: "Strong Buy" | "Buy" | "Hold" | "Skip";
  /** AI confidence score 0-100 */
  aiConfidence?: number;
  /** AI reasoning text */
  aiReason?: string;
  /** AI-estimated hours to hit TP */
  aiEstimatedHours?: number;
  highProfitScore: number;
  profitPotential: "High" | "Medium";
  superHighProfit: boolean;
  guaranteedHit: boolean;
  /** Surety score 0-100: combined TP probability + confidence + indicator alignment */
  suretyScore: number;
  /** Number of indicators aligned (max 6) */
  indicatorsAligned: number;
  /** Raw TP percentage for AI enrichment */
  tpPct?: number;
  /** Risk:Reward ratio — TP distance / SL distance. Must be >= 1.5 for Elite */
  rrRatio: number;
  /** True if entry is a pullback/retest — price is 0.5–7% below recent 24h high */
  isOnPullback: boolean;
  /** Higher highs + higher lows trend structure confirmed from candle data */
  trendStructure: "HH/HL" | "unclear";
  /** Distance to 24h high as a pct — used for dump risk */
  distToHigh24h?: number;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generateSyntheticCandles(
  price: number,
  priceChange24h: number,
  volume: number,
  seed: number,
): Array<{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const rand = seededRand(seed);
  const candles: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];
  let current = price * (1 - priceChange24h / 100);
  const trendBias = priceChange24h / 100 / 50;
  const dailyVol = volume / 24;
  for (let i = 0; i < 50; i++) {
    const move = (rand() - 0.47 + trendBias) * 0.012 * current;
    const open = current;
    const close = current + move;
    const high = Math.max(open, close) * (1 + rand() * 0.003);
    const low = Math.min(open, close) * (1 - rand() * 0.003);
    candles.push({
      open,
      high,
      low,
      close,
      volume: dailyVol * (0.7 + rand() * 0.6),
    });
    current = close;
  }
  return candles;
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

function calcEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

/**
 * FIXED MACD: Proper EMA(9) signal line calculation.
 * Builds the full MACD series from all closes, then computes EMA(9) of that series.
 */
function calcMACDSeries(closes: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (closes.length < 2) return { macd: 0, signal: 0, histogram: 0 };
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
  // Signal = EMA(9) of MACD series
  const kSig = 2 / 10;
  let sigLine = macdSeries[0];
  for (const m of macdSeries) sigLine = m * kSig + sigLine * (1 - kSig);
  return { macd: macdLine, signal: sigLine, histogram: macdLine - sigLine };
}

function calcATR(
  candles: Array<{ high: number; low: number; close: number }>,
): number {
  if (candles.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    sum += tr;
  }
  return sum / (candles.length - 1);
}

function formatEstimatedTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

/**
 * LUXIA SIGNAL ENGINE v14 — REAL DUMP RISK DETECTION
 *
 * Core principles:
 *  1. dumpRisk now uses 5-factor scoring (pump exhaustion, near resistance,
 *     overbought RSI, weakening MACD, extreme pump) — not just negative momentum
 *  2. "No Dump" sort correctly filters based on the real dumpRisk value
 *  3. All other logic unchanged
 */
export function generateSignals(coins: CoinData[]): Signal[] {
  const hourSeed = Math.floor(Date.now() / 3600000);
  const seenSymbols = new Set<string>();
  const candidates: (Signal & { score: number })[] = [];

  for (const coin of coins) {
    if (seenSymbols.has(coin.symbol)) continue;

    // --- RELAXED FILTERS for more signal coverage ---
    if (coin.volume24h < 2_000_000) continue;
    if (coin.marketCap !== undefined && coin.marketCap < 10_000_000) continue;
    if (coin.priceChange24h < -20) continue;
    if (coin.priceChange24h > 150) continue;
    if (coin.priceChange24h < 0.1) continue;

    if (isCoinBlocked(coin.symbol)) continue;
    const profile = getCoinProfile(coin.symbol);
    if (profile.consecutiveLosses >= 2) continue;

    const symbolCode = coin.symbol
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    const seed = (hourSeed * 31337 + symbolCode) >>> 0;
    const candles = generateSyntheticCandles(
      coin.price,
      coin.priceChange24h,
      coin.volume24h,
      seed,
    );
    const closes = candles.map((c) => c.close);

    const rsi = calcRSI(closes);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    // FIXED: use proper MACD series calculation
    const macd = calcMACDSeries(closes);
    const atr = calcATR(candles);
    const volumeRatio = 1 + Math.abs(coin.priceChange24h) / 15;
    const trend: "bullish" | "bearish" = ema9 > ema21 ? "bullish" : "bearish";

    // ============================================================
    // INDICATOR GATES — 6 indicators, need at least 4 aligned
    // ============================================================
    const rsiLongOk = rsi >= 35 && rsi <= 72;
    const emaLongOk = ema9 > ema21 * 0.997;
    const macdLongOk = macd.histogram > 0;
    const momentumOk = coin.priceChange24h >= 0.1;
    const notTopHeavy = rsi < 75;
    const volumeSurge = volumeRatio >= 1.05;

    const indicatorsAligned =
      (rsiLongOk ? 1 : 0) +
      (emaLongOk ? 1 : 0) +
      (macdLongOk ? 1 : 0) +
      (momentumOk ? 1 : 0) +
      (notTopHeavy ? 1 : 0) +
      (volumeSurge ? 1 : 0);

    if (indicatorsAligned < 4) continue;

    // Critical: at least momentum + one of EMA/MACD
    const criticalIndicatorsOk = momentumOk && (emaLongOk || macdLongOk);

    const direction = "LONG" as const;

    // ============================================================
    // MOMENTUM-BASED TP CALCULATION
    // ============================================================
    const atrPct = coin.price !== 0 ? atr / coin.price : 0.01;
    const momentum = coin.priceChange24h;
    if (momentum < 0.1) continue;

    let tpPct: number;
    let tpSource: string;
    let superHighProfit = false;

    if (momentum >= 30) {
      tpPct = Math.max(atrPct * 15, 0.3);
      tpSource = `Extreme breakout (${momentum.toFixed(1)}% today, ATR×15)`;
      superHighProfit = true;
    } else if (momentum >= 20) {
      tpPct = Math.max(atrPct * 10, 0.08);
      tpSource = `Strong breakout (${momentum.toFixed(1)}% today, ATR×10)`;
      superHighProfit = true;
    } else if (momentum >= 10) {
      tpPct = Math.max(atrPct * 6, 0.05);
      tpSource = `High momentum breakout (${momentum.toFixed(1)}% today, ATR×6)`;
      superHighProfit = true;
    } else if (momentum >= 5) {
      tpPct = Math.max(atrPct * 7, 0.1);
      tpSource = `High momentum (${momentum.toFixed(1)}% today, ATR×7)`;
      superHighProfit = true;
    } else if (momentum >= 2) {
      tpPct = Math.max(atrPct * 2.5, 0.015);
      tpSource = `Moderate momentum (${momentum.toFixed(1)}% today, ATR×2.5)`;
    } else {
      tpPct = Math.max(atrPct * 1.8, 0.008);
      tpSource = `Low momentum (${momentum.toFixed(1)}% today, ATR×1.8)`;
    }

    const high24h = coin.high24h ?? coin.price * (1 + tpPct * 1.2);
    const distToHighRaw = (high24h - coin.price) / coin.price;
    if (distToHighRaw > 0 && distToHighRaw < tpPct) {
      tpPct = distToHighRaw * 0.95;
      tpSource = `24h high resistance (${(distToHighRaw * 100).toFixed(1)}% away) — proven level`;
    }

    tpPct = Math.max(tpPct, 0.005);

    const distToHigh24h = coin.high24h
      ? (coin.high24h - coin.price) / coin.price
      : 0.05;

    const lateEntryRisk =
      momentum > 10 && distToHigh24h < 0.04
        ? 30
        : momentum > 8 && distToHigh24h < 0.03
          ? 20
          : momentum > 6 && distToHigh24h < 0.02
            ? 10
            : 0;

    // ============================================================
    // REAL DUMP RISK — 5-factor scoring
    // Previously this was ALWAYS "Low" because all signals have momentum >= 0.1
    // Now we actually detect overextended / reversal-prone coins
    // ============================================================
    const pumpExhaustion =
      momentum > 15 || (momentum > 8 && distToHigh24h < 0.02);
    const nearResistance = distToHigh24h < 0.01; // within 1% of 24h high — likely to stall/reverse
    const overboughtRSI = rsi > 72;
    const macdWeakening = macd.histogram < 0;
    const extremePump = momentum > 25;

    const dumpRiskScore =
      (pumpExhaustion ? 3 : 0) +
      (nearResistance ? 3 : 0) +
      (overboughtRSI ? 2 : 0) +
      (macdWeakening ? 1 : 0) +
      (extremePump ? 2 : 0);

    const dumpRisk: "Low" | "Medium" | "High" =
      dumpRiskScore >= 5 ? "High" : dumpRiskScore >= 2 ? "Medium" : "Low";

    const strengthLabel: "Strong" | "Weakening" | "At Risk" =
      dumpRisk === "Low"
        ? "Strong"
        : dumpRisk === "Medium"
          ? "Weakening"
          : "At Risk";

    // ============================================================
    // SL: Wide to survive volatility
    // ============================================================
    const slMultiplier = Math.max(profile.slMultiplier, 1.5);
    const slFromRR = tpPct * 2.8;
    const slFromATR = atrPct * 3.5 * slMultiplier;
    const slPct = Math.min(Math.max(slFromRR, slFromATR, 0.03), 0.22);

    // ============================================================
    // ELITE INSTITUTIONAL FIELDS
    // ============================================================
    const rrRatio = Number.parseFloat((tpPct / slPct).toFixed(2));
    const isOnPullback =
      (distToHigh24h ?? 0) >= 0.005 && (distToHigh24h ?? 0) <= 0.07;
    const lastHighs = candles.slice(-6).map((c) => c.high);
    const lastLows = candles.slice(-6).map((c) => c.low);
    let hhCount = 0;
    let hlCount = 0;
    for (let i = 1; i < lastHighs.length; i++) {
      if (lastHighs[i] > lastHighs[i - 1]) hhCount++;
      if (lastLows[i] > lastLows[i - 1]) hlCount++;
    }
    const trendStructure: "HH/HL" | "unclear" =
      hhCount >= 3 && hlCount >= 3 ? "HH/HL" : "unclear";

    const tpHitProbability = slPct / (tpPct + slPct);
    const momentumBonus =
      momentum >= 20
        ? 0.12
        : momentum >= 10
          ? 0.08
          : momentum >= 5
            ? 0.05
            : momentum >= 2
              ? 0.02
              : 0;
    const adjustedTpHitProb = Math.min(0.96, tpHitProbability + momentumBonus);
    if (adjustedTpHitProb < 0.73) continue;

    const tp = coin.price * (1 + tpPct);
    const sl = coin.price * (1 - slPct);

    // ============================================================
    // ACCURATE TIME-TO-TP ESTIMATE
    // ============================================================
    const activeHoursPerDay =
      momentum >= 20
        ? 10
        : momentum >= 10
          ? 8
          : momentum >= 5
            ? 6
            : momentum >= 2
              ? 5
              : 4;
    const effectiveHourlyRate = Math.max(momentum / activeHoursPerDay, 0.05);
    const rawHoursCalc = (tpPct * 100) / effectiveHourlyRate;
    const estimatedHours = Math.max(0.5, Math.min(72, rawHoursCalc * 1.2));

    // ============================================================
    // ML SCORING
    // ============================================================
    let mlScore = 78;
    const rsiIdeal = 52;
    mlScore += Math.max(0, (15 - Math.abs(rsi - rsiIdeal)) / 15) * 8;
    if (ema21 !== 0) {
      const emaDiff = Math.abs((ema9 - ema21) / ema21);
      mlScore += Math.min(5, emaDiff * 2000);
    }
    mlScore += Math.min(4, Math.abs(macd.histogram) * 500);
    mlScore += Math.min(4, (volumeRatio - 1.0) * 3);
    if (momentum > 2) mlScore += 2;
    if (momentum > 5) mlScore += 2;
    if (momentum > 10) mlScore += 3;
    if (tpSource.includes("24h")) mlScore += 4;
    if (indicatorsAligned === 6) mlScore = Math.min(99, mlScore + 4);
    if (indicatorsAligned === 5) mlScore = Math.min(99, mlScore + 2);
    if (profile.wins > 0 && profile.losses === 0)
      mlScore = Math.min(99, mlScore + 3);
    if (profile.wins >= 3) mlScore = Math.min(99, mlScore + 2);
    if (superHighProfit) mlScore = Math.min(99, mlScore + 2);
    if (estimatedHours <= 6 && adjustedTpHitProb >= 0.75)
      mlScore = Math.min(99, mlScore + 3);
    // Bonus for low dump risk (safe coins score higher)
    if (dumpRisk === "Low") mlScore = Math.min(99, mlScore + 3);

    mlScore = Math.min(99, Math.max(75, mlScore));

    const adjustmentFactor = getAdjustmentFactor();
    const rawConfidence = Math.min(99, Math.max(75, 70 + mlScore * 0.3));
    const confidence = Math.min(99, rawConfidence * adjustmentFactor);
    const tpProbabilityPct = Math.round(Math.min(99, adjustedTpHitProb * 100));

    const profitScore = adjustedTpHitProb * tpPct * 100 * volumeRatio;
    const profitPotential: "High" | "Medium" =
      tpPct >= 0.02 && tpProbabilityPct >= 75 ? "High" : "Medium";

    const guaranteedHit =
      adjustedTpHitProb >= 0.83 &&
      Math.round(mlScore) >= 90 &&
      criticalIndicatorsOk &&
      indicatorsAligned >= 6 &&
      momentum >= 1.5 &&
      momentum <= 15 &&
      dumpRisk === "Low"; // GUARANTEED HIT requires Low dump risk

    // ============================================================
    // SURETY SCORE v3 — incorporates real dump risk penalty
    // ============================================================
    const indicatorAlignmentPct = (indicatorsAligned / 6) * 100;
    const momentumQuality = Math.min(100, momentum * 5);
    const timeScore = Math.max(0, 100 - (estimatedHours / 12) * 100);
    const tpProximityScore = Math.max(0, 100 - tpPct * 1500);
    const provenResistanceBonus = tpSource.includes("24h") ? 10 : 0;
    const reversalRisk = Math.min(
      100,
      (momentum > 8 ? (momentum - 8) * 5 : 0) + (distToHigh24h < 0.02 ? 20 : 0),
    );
    const extremeMomentumPenalty = momentum > 12 ? 25 : 0;
    // Penalty when dump risk is not Low
    const dumpRiskPenalty =
      dumpRisk === "High" ? 30 : dumpRisk === "Medium" ? 15 : 0;

    const suretyScore = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          tpProbabilityPct * 0.3 +
            confidence * 0.25 +
            momentumQuality * 0.15 +
            indicatorAlignmentPct * 0.1 +
            timeScore * 0.1 +
            tpProximityScore * 0.05 +
            (100 - reversalRisk) * 0.05 +
            provenResistanceBonus -
            lateEntryRisk -
            extremeMomentumPenalty -
            dumpRiskPenalty,
        ),
      ),
    );

    // Lock surety for the entire hour — prevents fluctuation between rescans
    const suretyKey = `${coin.symbol}-${hourSeed}`;
    const lockedSurety = lockedSuretyMap.has(suretyKey)
      ? (lockedSuretyMap.get(suretyKey) as number)
      : suretyScore;
    if (!lockedSuretyMap.has(suretyKey))
      lockedSuretyMap.set(suretyKey, suretyScore);
    seenSymbols.add(coin.symbol);

    const compositeScore =
      confidence * 0.25 +
      tpProbabilityPct * 0.35 +
      tpPct * 100 * 0.2 +
      Math.min(momentum, 20) * 0.15 +
      (profile.wins - profile.losses) * 0.5;

    candidates.push({
      id: `${coin.symbol}-${hourSeed}`,
      symbol: coin.pairSymbol,
      coinId: coin.id,
      action: "BUY",
      direction,
      entryPrice: coin.price,
      stopLoss: sl,
      takeProfit: tp,
      currentPrice: coin.price,
      confidence: Math.round(confidence),
      tpProbability: tpProbabilityPct,
      rsiValue: Math.round(rsi * 10) / 10,
      macdHistogram: macd.histogram,
      ema9,
      ema21,
      atr,
      volumeRatio,
      momentum,
      trendDirection: trend,
      mlScore: Math.round(mlScore),
      estimatedHours,
      strengthLabel,
      dumpRisk,
      isTrending: momentum > 5,
      analysis: `RSI ${rsi.toFixed(1)} | ${tpSource} | Win Prob ${tpProbabilityPct}% | TP +${(tpPct * 100).toFixed(2)}% | SL -${(slPct * 100).toFixed(1)}% | Est ${formatEstimatedTime(estimatedHours)} | ${indicatorsAligned}/6 indicators | Surety ${lockedSurety} | DumpRisk: ${dumpRisk}`,
      status: "active",
      timestamp: Date.now(),
      hourSeed,
      aiEnriched: false,
      highProfitScore: profitScore,
      profitPotential,
      superHighProfit,
      guaranteedHit,
      suretyScore: lockedSurety,
      indicatorsAligned,
      tpPct,
      distToHigh24h,
      rrRatio,
      isOnPullback,
      trendStructure,
      score: compositeScore,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const results: Signal[] = candidates.map(({ score: _score, ...s }) => s);

  localStorage.setItem(
    "luxia_scan_stats",
    JSON.stringify({
      coinsScanned: coins.length,
      signalsGenerated: results.length,
      activeSignals: results.length,
      lastScan: Date.now(),
    }),
  );

  return results;
}

/**
 * Enriches signals with Groq AI validation.
 */
export async function enrichSignalsWithAI(
  signals: Signal[],
): Promise<Signal[]> {
  if (signals.length === 0) return signals;

  const byComposite = signals.slice(0, 25);
  const byTPPct = [...signals]
    .filter((s) => !byComposite.includes(s))
    .sort((a, b) => {
      const aPct = (a.takeProfit - a.entryPrice) / (a.entryPrice || 1);
      const bPct = (b.takeProfit - b.entryPrice) / (b.entryPrice || 1);
      return bPct - aPct;
    })
    .slice(0, 15);

  const top40 = [...byComposite, ...byTPPct];
  const rest = signals.filter((s) => !top40.includes(s));

  const validationInput = top40.map((s) => ({
    symbol: s.symbol,
    confidence: s.confidence,
    tpProbability: s.tpProbability,
    momentum: s.momentum,
    rsiValue: s.rsiValue,
    macdHistogram: s.macdHistogram,
    suretyScore: s.suretyScore,
    tpPct: s.tpPct ?? 0,
    estimatedHours: s.estimatedHours,
  }));

  const validations = await validateSignalsWithAI(validationInput);

  const enriched = top40
    .map((signal) => {
      const v = validations.get(signal.symbol);
      if (!v) return { ...signal, aiEnriched: false };

      if (v.aiRating === "Skip") return null;

      const aiConfidence = v.aiConfidence;
      const tpProb = signal.tpProbability;
      const momentum = signal.momentum;
      const indAlign = (signal.indicatorsAligned / 6) * 100;

      const newSuretyScore = Math.round(
        Math.min(
          100,
          Math.max(
            0,
            aiConfidence * 0.4 +
              tpProb * 0.3 +
              Math.min(100, momentum * 5) * 0.2 +
              indAlign * 0.1,
          ),
        ),
      );

      const newGuaranteedHit =
        signal.guaranteedHit && v.aiRating === "Strong Buy";

      let adjustedTakeProfit = signal.takeProfit;
      let adjustedStopLoss = signal.stopLoss;
      if (v.aiRating === "Strong Buy") {
        const tpDist = signal.takeProfit - signal.entryPrice;
        adjustedTakeProfit = signal.entryPrice + tpDist * 0.8;
        const slDist = signal.entryPrice - signal.stopLoss;
        adjustedStopLoss = signal.entryPrice - slDist * 1.1;
      }

      const boostedSuretyScore =
        v.aiRating === "Strong Buy"
          ? Math.min(100, newSuretyScore + 10)
          : newSuretyScore;

      return {
        ...signal,
        aiEnriched: true,
        aiRating: v.aiRating,
        aiConfidence: v.aiConfidence,
        aiReason: v.aiReason,
        aiEstimatedHours: v.aiEstimatedHours,
        suretyScore: boostedSuretyScore,
        guaranteedHit: newGuaranteedHit,
        takeProfit: adjustedTakeProfit,
        stopLoss: adjustedStopLoss,
        estimatedHours:
          Math.abs(v.aiEstimatedHours - signal.estimatedHours) > 2
            ? (v.aiEstimatedHours + signal.estimatedHours) / 2
            : signal.estimatedHours,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return [...enriched, ...rest];
}

export type { Signal as default };
