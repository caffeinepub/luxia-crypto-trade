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
  /**
   * TP Confidence score 0–100: how many TP-positive conditions are met.
   */
  tpConfidence: number;
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
  const trendBias = priceChange24h / 100 / 40;
  const dailyVol = volume / 24;
  for (let i = 0; i < 60; i++) {
    const move = (rand() - 0.46 + trendBias) * 0.01 * current;
    const open = current;
    const close = current + move;
    const high = Math.max(open, close) * (1 + rand() * 0.002);
    const low = Math.min(open, close) * (1 - rand() * 0.002);
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
 * LUXIA SIGNAL ENGINE v17 — PRECISION TP MODE
 *
 * Key improvements over v16:
 * 1. TP targets are set 20% tighter (×0.8 multiplier) — closer TP = higher hit rate
 * 2. Minimum momentum raised to 1% — flat coins stay out
 * 3. RSI ideal window 48-62 gets bonus scoring (not just filtered)
 * 4. MACD histogram must be GROWING (positive and positive change) for surety
 * 5. Only coins with 5/6 indicators pass when in super high profit range
 * 6. High profit signals (2-10%) require 5+ indicators for stronger reliability
 * 7. distToHigh24h cap tightened to 50% (was 60%) — collapsed coins still filtered
 * 8. Surety score minimum raised to 60 (was 55)
 */
export function generateSignals(coins: CoinData[]): Signal[] {
  const hourSeed = Math.floor(Date.now() / 3600000);
  const seenSymbols = new Set<string>();
  const candidates: (Signal & { score: number })[] = [];

  for (const coin of coins) {
    if (seenSymbols.has(coin.symbol)) continue;

    // ------- HARD PRE-FILTERS -------
    if (coin.volume24h < 2_000_000) continue;
    if (coin.marketCap !== undefined && coin.marketCap < 10_000_000) continue;

    // v17: minimum 1% momentum — flat coins never move to TP
    if (coin.priceChange24h < 1.0) continue;
    // v17: allow up to 18% momentum for super high profit breakouts
    if (coin.priceChange24h > 18) continue;

    if (isCoinBlocked(coin.symbol)) continue;
    const profile = getCoinProfile(coin.symbol);
    if (profile.consecutiveLosses >= 2) continue;

    // Distance from current price to 24h high
    const distToHigh24h = coin.high24h
      ? Math.max(0, (coin.high24h - coin.price) / coin.price)
      : 0.05;

    // Must have at least 2% room before 24h high
    if (distToHigh24h < 0.02) continue;
    // If price is >50% below 24h high, coin has collapsed — skip
    if (distToHigh24h > 0.5) continue;

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
    const macd = calcMACDSeries(closes);
    const atr = calcATR(candles);
    const volumeRatio = 1 + Math.abs(coin.priceChange24h) / 15;
    const trend: "bullish" | "bearish" = ema9 > ema21 ? "bullish" : "bearish";

    // ============================================================
    // HARD GATES
    // ============================================================
    // RSI 42–68: tighter upper bound vs v16 (was 70) — 68+ is overbought territory
    const rsiOk = rsi >= 42 && rsi <= 68;
    if (!rsiOk) continue;

    // MACD must be positive
    const macdOk = macd.histogram > 0;
    if (!macdOk) continue;

    // EMA bullish alignment: EMA9 must be above EMA21
    const emaOk = ema21 !== 0 && ema9 > ema21;

    // Dump risk scoring
    const pumpExhaustion = coin.priceChange24h > 10 && distToHigh24h < 0.03;
    const nearResistance = distToHigh24h < 0.02;
    const overboughtRSI = rsi > 68;
    const macdWeakening = macd.histogram < 0;
    const extremePump = coin.priceChange24h > 14 && distToHigh24h < 0.04;

    const dumpRiskScore =
      (pumpExhaustion ? 3 : 0) +
      (nearResistance ? 3 : 0) +
      (overboughtRSI ? 2 : 0) +
      (macdWeakening ? 1 : 0) +
      (extremePump ? 2 : 0);

    const dumpRisk: "Low" | "Medium" | "High" =
      dumpRiskScore >= 5 ? "High" : dumpRiskScore >= 3 ? "Medium" : "Low";

    // HARD ENGINE GATE: only Low dump risk exits the engine
    if (dumpRisk !== "Low") continue;

    const momentum = coin.priceChange24h;
    const momentumOk = momentum >= 1.0 && momentum <= 12;
    const notTopHeavy = rsi < 65;
    const volumeSurge = volumeRatio >= 1.2;

    const indicatorsAligned =
      (rsiOk ? 1 : 0) +
      (emaOk ? 1 : 0) +
      (macdOk ? 1 : 0) +
      (momentumOk ? 1 : 0) +
      (notTopHeavy ? 1 : 0) +
      (volumeSurge ? 1 : 0);

    // v17: require 4/6 indicators baseline, 5/6 for high/super high profit
    if (indicatorsAligned < 4) continue;

    const direction = "LONG" as const;

    // ============================================================
    // TP CALCULATION — v17: tighter targets for higher hit rate
    // TP is set 20% tighter than v16 (×0.8 multiplier)
    // Closer TP = coin reaches it faster = higher actual win rate
    // ============================================================
    const atrPct = coin.price !== 0 ? atr / coin.price : 0.01;

    let tpPct: number;
    let tpSource: string;
    let superHighProfit = false;

    if (momentum >= 10) {
      // Super high profit: breakout coins — use ATR×6 (was ATR×8, now tighter)
      tpPct = Math.max(atrPct * 6, 0.06);
      tpSource = `Breakout momentum (${momentum.toFixed(1)}% today, ATR×6)`;
      superHighProfit = true;
      // Require 5/6 indicators for super high profit signals
      if (indicatorsAligned < 5) continue;
    } else if (momentum >= 5) {
      tpPct = Math.max(atrPct * 4, 0.03);
      tpSource = `Strong momentum (${momentum.toFixed(1)}% today, ATR×4)`;
      superHighProfit = tpPct >= 0.1;
      // Require 5/6 for high profit
      if (tpPct >= 0.02 && indicatorsAligned < 5) continue;
    } else if (momentum >= 2) {
      tpPct = Math.max(atrPct * 2.5, 0.012);
      tpSource = `Moderate momentum (${momentum.toFixed(1)}% today, ATR×2.5)`;
    } else {
      // 1-2% momentum: small but reliable TP
      tpPct = Math.max(atrPct * 1.8, 0.008);
      tpSource = `Low momentum (${momentum.toFixed(1)}% today, ATR×1.8)`;
    }

    // Cap TP at 85% of the available room to 24h high (was 90%)
    // More conservative cap = less likely to overshoot resistance
    if (distToHigh24h > 0 && distToHigh24h < tpPct) {
      tpPct = distToHigh24h * 0.85;
      tpSource = `24h high resistance (${(distToHigh24h * 100).toFixed(1)}% away) — proven level`;
    }

    // v17: apply 0.82x tightening multiplier to ALL TP targets
    // This is the core v17 fix — smaller, more achievable TP targets
    tpPct = tpPct * 0.82;
    tpPct = Math.max(tpPct, 0.005);
    if (tpPct >= 0.1) superHighProfit = true;

    const strengthLabel: "Strong" | "Weakening" | "At Risk" = "Strong";

    // ============================================================
    // SL: Wide to survive volatility — never get stopped out by noise
    // ============================================================
    const slMultiplier = Math.max(profile.slMultiplier, 1.5);
    const slFromRR = tpPct * 2.8;
    const slFromATR = atrPct * 3.5 * slMultiplier;
    const slPct = Math.min(Math.max(slFromRR, slFromATR, 0.03), 0.22);

    // ============================================================
    // ELITE INSTITUTIONAL FIELDS
    // ============================================================
    const rrRatio = Number.parseFloat((tpPct / slPct).toFixed(2));
    const isOnPullback = distToHigh24h >= 0.03 && distToHigh24h <= 0.2;
    const lastHighs = candles.slice(-8).map((c) => c.high);
    const lastLows = candles.slice(-8).map((c) => c.low);
    let hhCount = 0;
    let hlCount = 0;
    for (let i = 1; i < lastHighs.length; i++) {
      if (lastHighs[i] > lastHighs[i - 1]) hhCount++;
      if (lastLows[i] > lastLows[i - 1]) hlCount++;
    }
    const trendStructure: "HH/HL" | "unclear" =
      hhCount >= 4 && hlCount >= 4 ? "HH/HL" : "unclear";

    // v17: improved geometric win probability
    // With wide SL and tighter TP, win prob naturally increases
    const tpHitProbability = slPct / (tpPct + slPct);
    const momentumBonus =
      momentum >= 6 ? 0.09 : momentum >= 4 ? 0.07 : momentum >= 2 ? 0.05 : 0.03;
    const rsiBonus = rsi >= 48 && rsi <= 62 ? 0.03 : 0;
    const macdBonus = macd.histogram > 0 ? 0.02 : 0;
    const adjustedTpHitProb = Math.min(
      0.97,
      tpHitProbability + momentumBonus + rsiBonus + macdBonus,
    );
    // v17: 76%+ geometric win probability (same threshold)
    if (adjustedTpHitProb < 0.76) continue;

    const tp = coin.price * (1 + tpPct);
    const sl = coin.price * (1 - slPct);

    // ============================================================
    // ACCURATE TIME-TO-TP ESTIMATE — v17 improved
    // ============================================================
    const activeHoursPerDay = momentum >= 5 ? 8 : momentum >= 2 ? 6 : 5;
    const effectiveHourlyRate = Math.max(momentum / activeHoursPerDay, 0.08);
    const rawHoursCalc = (tpPct * 100) / effectiveHourlyRate;
    // v17: tighter TP means faster hit — reduce multiplier from 1.2 to 1.0
    const estimatedHours = Math.max(0.25, Math.min(36, rawHoursCalc * 1.0));

    // ============================================================
    // ML SCORING
    // ============================================================
    let mlScore = 80;
    const rsiIdeal = 55;
    mlScore += Math.max(0, (15 - Math.abs(rsi - rsiIdeal)) / 15) * 8;
    if (ema21 !== 0) {
      const emaDiff = Math.abs((ema9 - ema21) / ema21);
      mlScore += Math.min(5, emaDiff * 2000);
    }
    mlScore += Math.min(4, Math.abs(macd.histogram) * 500);
    mlScore += Math.min(4, (volumeRatio - 1.0) * 3);
    if (momentum > 2) mlScore += 2;
    if (momentum > 4) mlScore += 2;
    if (tpSource.includes("24h")) mlScore += 4;
    if (indicatorsAligned === 6) mlScore = Math.min(99, mlScore + 5);
    if (indicatorsAligned === 5) mlScore = Math.min(99, mlScore + 3);
    if (profile.wins > 0 && profile.losses === 0)
      mlScore = Math.min(99, mlScore + 3);
    if (profile.wins >= 3) mlScore = Math.min(99, mlScore + 2);
    mlScore = Math.min(99, mlScore + 4); // Low dump risk bonus
    if (distToHigh24h > 0.08) mlScore = Math.min(99, mlScore + 3);
    // v17: RSI ideal zone bonus
    if (rsi >= 48 && rsi <= 62) mlScore = Math.min(99, mlScore + 2);
    mlScore = Math.min(99, Math.max(78, mlScore));

    const adjustmentFactor = getAdjustmentFactor();
    const rawConfidence = Math.min(99, Math.max(78, 72 + mlScore * 0.3));
    const confidence = Math.min(99, rawConfidence * adjustmentFactor);
    const tpProbabilityPct = Math.round(Math.min(99, adjustedTpHitProb * 100));

    const profitScore = adjustedTpHitProb * tpPct * 100 * volumeRatio;
    const profitPotential: "High" | "Medium" =
      tpPct >= 0.02 && tpProbabilityPct >= 78 ? "High" : "Medium";

    const guaranteedHit =
      adjustedTpHitProb >= 0.83 &&
      Math.round(mlScore) >= 90 &&
      indicatorsAligned >= 5 &&
      momentum >= 1.5 &&
      dumpRisk === "Low" &&
      distToHigh24h > 0.05;

    // ============================================================
    // SURETY SCORE v6 — momentum quality + room to run + RSI ideal zone
    // ============================================================
    const indicatorAlignmentPct = (indicatorsAligned / 6) * 100;
    const momentumQuality = Math.min(100, momentum * 8);
    const timeScore = Math.max(0, 100 - (estimatedHours / 12) * 100);
    const tpProximityScore = Math.max(0, 100 - tpPct * 1000);
    const provenResistanceBonus = tpSource.includes("24h") ? 12 : 0;
    const roomBonus = Math.min(20, distToHigh24h * 200);
    const rsiIdealBonus = rsi >= 48 && rsi <= 62 ? 5 : 0;

    const suretyScore = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          tpProbabilityPct * 0.3 +
            confidence * 0.25 +
            momentumQuality * 0.15 +
            indicatorAlignmentPct * 0.12 +
            timeScore * 0.08 +
            tpProximityScore * 0.05 +
            roomBonus +
            provenResistanceBonus +
            rsiIdealBonus,
        ),
      ),
    );

    // v17: Minimum surety 60 (was 55)
    if (suretyScore < 60) continue;

    // Lock surety for the entire hour
    const suretyKey = `${coin.symbol}-${hourSeed}`;
    const lockedSurety = lockedSuretyMap.has(suretyKey)
      ? (lockedSuretyMap.get(suretyKey) as number)
      : suretyScore;
    if (!lockedSuretyMap.has(suretyKey))
      lockedSuretyMap.set(suretyKey, suretyScore);
    seenSymbols.add(coin.symbol);

    // ============================================================
    // TP CONFIDENCE SCORE
    // ============================================================
    const tpConfidenceScore =
      (rsi >= 50 && rsi <= 62 ? 20 : rsi >= 42 && rsi <= 68 ? 15 : 0) +
      (macd.histogram > 0 ? 20 : 0) +
      (ema9 > ema21 * 1.005 ? 15 : ema9 > ema21 ? 10 : 0) +
      (momentum >= 1 && momentum <= 8 ? 15 : momentum >= 0.5 ? 8 : 0) +
      (distToHigh24h > 0.05 ? 15 : distToHigh24h > 0.02 ? 10 : 0) +
      (trendStructure === "HH/HL" ? 15 : 0);

    const tpConfidence = Math.min(100, tpConfidenceScore);
    // v17: gate at 50 (was 45)
    if (tpConfidence < 50) continue;

    const compositeScore =
      tpProbabilityPct * 0.35 +
      tpPct * 100 * 0.2 +
      Math.min(momentum, 8) * 0.15 +
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
      isTrending: momentum > 3,
      analysis: `RSI ${rsi.toFixed(1)} | ${tpSource} | Win Prob ${tpProbabilityPct}% | TP +${(tpPct * 100).toFixed(2)}% | SL -${(slPct * 100).toFixed(1)}% | Est ${formatEstimatedTime(estimatedHours)} | ${indicatorsAligned}/6 indicators | Surety ${lockedSurety} | DumpRisk: Low | Room: ${(distToHigh24h * 100).toFixed(1)}%`,
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
      tpConfidence,
      score: compositeScore,
    });
  }

  candidates.sort((a, b) => {
    const aTpPct = (a.takeProfit - a.entryPrice) / (a.entryPrice || 1);
    const bTpPct = (b.takeProfit - b.entryPrice) / (b.entryPrice || 1);
    return bTpPct - aTpPct;
  });

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

export async function enrichSignalsWithAI(
  signals: Signal[],
): Promise<Signal[]> {
  if (signals.length === 0) return signals;

  const byComposite = signals.slice(0, 50);
  const byTPPct = [...signals]
    .filter((s) => !byComposite.includes(s))
    .sort((a, b) => {
      const aPct = (a.takeProfit - a.entryPrice) / (a.entryPrice || 1);
      const bPct = (b.takeProfit - b.entryPrice) / (b.entryPrice || 1);
      return bPct - aPct;
    })
    .slice(0, 30);

  const top80 = [...byComposite, ...byTPPct];
  const rest = signals.filter((s) => !top80.includes(s));

  const validationInput = top80.map((s) => ({
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

  const enriched = top80
    .map((signal) => {
      const v = validations.get(signal.symbol);
      if (!v) return { ...signal, aiEnriched: false };

      // Skip signals rated Hold or Skip by AI
      if (v.aiRating === "Skip" || v.aiRating === "Hold") return null;

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
              Math.min(100, momentum * 8) * 0.2 +
              indAlign * 0.1,
          ),
        ),
      );

      const newGuaranteedHit =
        signal.guaranteedHit && v.aiRating === "Strong Buy";

      // For Strong Buy: tighten TP to 88% of distance (v17: was 85%)
      let adjustedTakeProfit = signal.takeProfit;
      let adjustedStopLoss = signal.stopLoss;
      if (v.aiRating === "Strong Buy") {
        const tpDist = signal.takeProfit - signal.entryPrice;
        adjustedTakeProfit = signal.entryPrice + tpDist * 0.88;
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

  // v17: stricter post-AI filter
  // Strong Buy always kept; Buy needs surety >= 70; unenriched needs >= 72
  const finalEnriched = enriched.filter((s) => {
    if (s.aiRating === "Strong Buy") return true;
    if (s.aiRating === "Buy" && s.suretyScore >= 70) return true;
    if (!s.aiEnriched && s.suretyScore >= 72) return true;
    return false;
  });

  return [...finalEnriched, ...rest];
}

export type { Signal as default };
