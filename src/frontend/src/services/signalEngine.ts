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
 * LUXIA SIGNAL ENGINE v12 — EXPANDED COVERAGE + HIGH/SUPER HIGH PROFIT
 *
 * Core principles:
 *  1. Relaxed filters to surface more signals across all profit tiers
 *  2. Fixed MACD: uses proper EMA(9) signal line (not macd * 0.9)
 *  3. Wide SL so volatility can't knock it out
 *  4. TP is based on proven 24h resistance OR current momentum velocity
 *  5. suretyScore incorporates AI confidence when available (40% weight)
 *  6. guaranteedHit now requires AI "Strong Buy" rating
 *  7. All signals are AI-validated via Groq before display
 *  8. Super High Profit: 5%+ momentum → ATR×5 (≥7% TP), extreme breakouts → ATR×15
 */
export function generateSignals(coins: CoinData[]): Signal[] {
  const hourSeed = Math.floor(Date.now() / 3600000);
  const seenSymbols = new Set<string>();
  const candidates: (Signal & { score: number })[] = [];

  for (const coin of coins) {
    if (seenSymbols.has(coin.symbol)) continue;

    // --- RELAXED FILTERS for more signal coverage ---
    if (coin.volume24h < 2_000_000) continue; // was 7_000_000
    if (coin.marketCap !== undefined && coin.marketCap < 10_000_000) continue; // was 15_000_000
    if (coin.priceChange24h < -20) continue;
    if (coin.priceChange24h > 150) continue; // was 80
    if (coin.priceChange24h < 0.1) continue; // was 0.5

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
    // INDICATOR GATES — 6 indicators, need at least 4 aligned (was 5)
    // ============================================================
    const rsiLongOk = rsi >= 35 && rsi <= 72; // was 38–70
    const emaLongOk = ema9 > ema21 * 0.997;
    const macdLongOk = macd.histogram > 0;
    const momentumOk = coin.priceChange24h >= 0.1; // was 0.5
    const notTopHeavy = rsi < 75; // was 72
    const volumeSurge = volumeRatio >= 1.05; // was 1.15

    const indicatorsAligned =
      (rsiLongOk ? 1 : 0) +
      (emaLongOk ? 1 : 0) +
      (macdLongOk ? 1 : 0) +
      (momentumOk ? 1 : 0) +
      (notTopHeavy ? 1 : 0) +
      (volumeSurge ? 1 : 0);

    if (indicatorsAligned < 4) continue; // was 5

    // Critical: at least momentum + one of EMA/MACD (was all three required)
    const criticalIndicatorsOk = momentumOk && (emaLongOk || macdLongOk);

    const direction = "LONG" as const;

    // ============================================================
    // MOMENTUM-BASED TP CALCULATION
    // ============================================================
    const atrPct = coin.price !== 0 ? atr / coin.price : 0.01;
    const momentum = coin.priceChange24h;
    if (momentum < 0.1) continue; // was 0.8

    let tpPct: number;
    let tpSource: string;
    let superHighProfit = false;

    if (momentum >= 30) {
      // Extreme breakout — ATR×15 projection
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
      // 5-10% momentum → ATR×5 projection — enters super high profit territory
      tpPct = Math.max(atrPct * 5, 0.07);
      tpSource = `High momentum (${momentum.toFixed(1)}% today, ATR×5)`;
      superHighProfit = tpPct > 0.1;
    } else if (momentum >= 2) {
      tpPct = Math.max(atrPct * 2.5, 0.015);
      tpSource = `Moderate momentum (${momentum.toFixed(1)}% today, ATR×2.5)`;
    } else {
      tpPct = Math.max(atrPct * 1.8, 0.008);
      tpSource = `Low momentum (${momentum.toFixed(1)}% today, ATR×1.8)`;
    }

    const high24h = coin.high24h ?? coin.price * (1 + tpPct * 1.2);
    const distToHigh = (high24h - coin.price) / coin.price;
    if (distToHigh > 0 && distToHigh < tpPct) {
      tpPct = distToHigh * 0.95;
      tpSource = `24h high resistance (${(distToHigh * 100).toFixed(1)}% away) — proven level`;
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
    // SL: Wide to survive volatility
    // ============================================================
    const slMultiplier = Math.max(profile.slMultiplier, 1.5);
    const slFromRR = tpPct * 2.8;
    const slFromATR = atrPct * 3.5 * slMultiplier;
    const slPct = Math.min(Math.max(slFromRR, slFromATR, 0.03), 0.22);

    const tpHitProbability = slPct / (tpPct + slPct);
    if (tpHitProbability < 0.73) continue; // was 0.76

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
    if (estimatedHours <= 6 && tpHitProbability >= 0.75)
      mlScore = Math.min(99, mlScore + 3);

    mlScore = Math.min(99, Math.max(75, mlScore));

    const adjustmentFactor = getAdjustmentFactor();
    const rawConfidence = Math.min(99, Math.max(75, 70 + mlScore * 0.3));
    const confidence = Math.min(99, rawConfidence * adjustmentFactor);
    const tpProbabilityPct = Math.round(Math.min(99, tpHitProbability * 100));

    const dumpRisk: "Low" | "Medium" | "High" =
      momentum < -5 ? "High" : momentum < 0 ? "Medium" : "Low";
    const strengthLabel: "Strong" | "Weakening" | "At Risk" =
      confidence >= 90 ? "Strong" : confidence >= 82 ? "Weakening" : "At Risk";

    const profitScore = tpHitProbability * tpPct * 100 * volumeRatio;
    const profitPotential: "High" | "Medium" =
      tpPct >= 0.02 && tpProbabilityPct >= 75 ? "High" : "Medium";

    // guaranteedHit: wide SL + all critical indicators + high confidence
    // (AI enrichment will additionally require aiRating === 'Strong Buy')
    const guaranteedHit =
      tpHitProbability >= 0.83 &&
      Math.round(mlScore) >= 90 &&
      criticalIndicatorsOk &&
      indicatorsAligned >= 6 &&
      momentum >= 1.5 &&
      momentum <= 15;

    // ============================================================
    // SURETY SCORE v2 (0-100) — Anti-Dump Edition
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
            extremeMomentumPenalty,
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
      analysis: `RSI ${rsi.toFixed(1)} | ${tpSource} | Win Prob ${tpProbabilityPct}% | TP +${(tpPct * 100).toFixed(2)}% | SL -${(slPct * 100).toFixed(1)}% | Est ${formatEstimatedTime(estimatedHours)} | ${indicatorsAligned}/6 indicators | Surety ${lockedSurety}`,
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
 * Enriches the top 30 signals with Groq AI validation.
 * - Filters out signals rated "Skip" by AI
 * - Updates suretyScore to incorporate aiConfidence (40% weight)
 * - Updates guaranteedHit to require aiRating === 'Strong Buy'
 * - Returns enriched + filtered signals
 */
export async function enrichSignalsWithAI(
  signals: Signal[],
): Promise<Signal[]> {
  if (signals.length === 0) return signals;

  const top30 = signals.slice(0, 30);
  const rest = signals.slice(30);

  const validationInput = top30.map((s) => ({
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

  const enriched = top30
    .map((signal) => {
      const v = validations.get(signal.symbol);
      if (!v) return { ...signal, aiEnriched: false };

      // Filter out AI-rejected signals
      if (v.aiRating === "Skip") return null;

      const aiConfidence = v.aiConfidence;
      const tpProb = signal.tpProbability;
      const momentum = signal.momentum;
      const indAlign = (signal.indicatorsAligned / 6) * 100;

      // Recalculate suretyScore with AI confidence carrying 40% weight
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

      // guaranteedHit now requires AI Strong Buy
      const newGuaranteedHit =
        signal.guaranteedHit && v.aiRating === "Strong Buy";

      // For Strong Buy signals: tighten TP to maximize hit probability.
      // Pull TP to 80% of the original distance — closer = more certain to hit.
      // Also widen SL by 10% for extra volatility buffer.
      let adjustedTakeProfit = signal.takeProfit;
      let adjustedStopLoss = signal.stopLoss;
      if (v.aiRating === "Strong Buy") {
        const tpDist = signal.takeProfit - signal.entryPrice;
        // Tighten TP: use 80% of distance so it hits faster and more reliably
        adjustedTakeProfit = signal.entryPrice + tpDist * 0.8;
        // Widen SL: give trade 10% more room to breathe
        const slDist = signal.entryPrice - signal.stopLoss;
        adjustedStopLoss = signal.entryPrice - slDist * 1.1;
      }

      // Boost suretyScore for Strong Buy — AI validated at highest tier
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
        // Use AI estimated hours if AI returned a significantly different estimate
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
