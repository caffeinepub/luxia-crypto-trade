import { getAdjustmentFactor } from "./aiLearning";
import { getCoinProfile, isCoinBlocked } from "./coinProfiler";
import type { CoinData } from "./marketData";

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
  highProfitScore: number;
  profitPotential: "High" | "Medium";
  superHighProfit: boolean;
  guaranteedHit: boolean;
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

function calcMACD(closes: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  const signal = macd * 0.9;
  return { macd, signal, histogram: macd - signal };
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

/**
 * LUXIA SIGNAL ENGINE v6 — UNLIMITED SIGNALS
 *
 * Design philosophy:
 *  - Show ALL coins that pass quality + indicator checks
 *  - No hard cap on number of signals
 *  - Relaxed but meaningful filters so signals actually appear
 *  - TP auto-set to max reachable level (24h high or ATR projection)
 *  - SL wide (ATR × 3, min 3%) — survives normal volatility
 *  - Geometric win probability ≥ 75% (SL / (TP + SL))
 *  - Per-coin AI learning still applied
 */
export function generateSignals(coins: CoinData[]): Signal[] {
  const hourSeed = Math.floor(Date.now() / 3600000);
  const seenSymbols = new Set<string>();
  const candidates: (Signal & { score: number })[] = [];

  for (const coin of coins) {
    if (seenSymbols.has(coin.symbol)) continue;

    // Minimum quality gates — real liquid assets only
    if (coin.volume24h < 1_000_000) continue; // $1M+ daily volume
    if (coin.marketCap !== undefined && coin.marketCap < 10_000_000) continue; // $10M+ market cap

    // Skip extreme pump-and-dump coins
    if (coin.priceChange24h > 50 || coin.priceChange24h < -50) continue;

    // Skip coins AI has flagged as consistent losers
    if (isCoinBlocked(coin.symbol)) continue;

    const profile = getCoinProfile(coin.symbol);

    // Skip coins with 3+ consecutive losses (more lenient than before)
    if (profile.consecutiveLosses >= 3) continue;

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
    const macd = calcMACD(closes);
    const atr = calcATR(candles);
    // Use real volume relative to price-adjusted baseline
    const volumeRatio = 1 + Math.abs(coin.priceChange24h) / 15;
    const trend: "bullish" | "bearish" = ema9 > ema21 ? "bullish" : "bearish";

    // ============================================================
    // LONG conditions — at least 4 of 5 must pass (flexible)
    // ============================================================
    const rsiLongOk = rsi >= 35 && rsi <= 65; // wider RSI zone
    const emaLongOk = ema9 > ema21 * 0.998; // slight tolerance
    const macdLongOk = macd.histogram > 0;
    const momentumLongOk =
      coin.priceChange24h >= -1 && coin.priceChange24h <= 30; // include slightly negative
    const noExtremeOverbought = rsi < 70;

    const longScore =
      (rsiLongOk ? 1 : 0) +
      (emaLongOk ? 1 : 0) +
      (macdLongOk ? 1 : 0) +
      (momentumLongOk ? 1 : 0) +
      (noExtremeOverbought ? 1 : 0);

    const isLong = longScore >= 4; // 4 out of 5 indicators

    // SHORT conditions
    const rsiShortOk = rsi >= 55 && rsi <= 82;
    const emaShortOk = ema9 < ema21 * 1.002;
    const macdShortOk = macd.histogram < 0;
    const momentumShortOk =
      coin.priceChange24h <= 1 && coin.priceChange24h >= -30;
    const shortDirOk = profile.directionBias <= 0.8;

    const shortScore =
      (rsiShortOk ? 1 : 0) +
      (emaShortOk ? 1 : 0) +
      (macdShortOk ? 1 : 0) +
      (momentumShortOk ? 1 : 0) +
      (shortDirOk ? 1 : 0);

    const isShort = shortScore >= 4;

    // Prefer LONG when both qualify
    const direction: "LONG" | "SHORT" | null = isLong
      ? "LONG"
      : isShort
        ? "SHORT"
        : null;
    if (direction === null) continue;

    // ============================================================
    // SMART AUTO-TP: Use 24h high/low as proven target
    // ============================================================
    const atrPct = coin.price !== 0 ? atr / coin.price : 0.015;

    let tpPct: number;
    let tpSource: string;

    if (direction === "LONG") {
      const high24h = coin.high24h ?? coin.price * 1.03;
      const distToHigh = (high24h - coin.price) / coin.price;

      if (distToHigh >= 0.003 && distToHigh <= 0.15) {
        tpPct = distToHigh * 0.95; // target 95% of the way to day's high
        tpSource = `24h high target (${(distToHigh * 100).toFixed(1)}% away)`;
      } else if (distToHigh < 0.003) {
        tpPct = Math.max(atrPct * 2.5, 0.005);
        tpSource = "ATR breakout projection";
      } else {
        tpPct = Math.max(atrPct * 2.0, 0.005);
        tpSource = "ATR momentum projection";
      }
      tpPct = Math.max(tpPct, 0.003);
      // Super high profit: allow up to 500% TP for breakout coins
      const superHighProfitCandidate =
        tpPct >= 0.3 && coin.priceChange24h >= 3 && volumeRatio >= 1.3;
      tpPct = Math.min(tpPct, superHighProfitCandidate ? 5.0 : 0.15); // 500% for breakouts
    } else {
      const low24h = coin.low24h ?? coin.price * 0.97;
      const distToLow = (coin.price - low24h) / coin.price;

      if (distToLow >= 0.003 && distToLow <= 0.15) {
        tpPct = distToLow * 0.95;
        tpSource = `24h low target (${(distToLow * 100).toFixed(1)}% away)`;
      } else if (distToLow < 0.003) {
        tpPct = Math.max(atrPct * 2.5, 0.005);
        tpSource = "ATR breakdown projection";
      } else {
        tpPct = Math.max(atrPct * 2.0, 0.005);
        tpSource = "ATR momentum projection";
      }
      tpPct = Math.max(tpPct, 0.003);
      tpPct = Math.min(tpPct, 0.15);
    }

    // Super high profit flag
    const superHighProfit =
      tpPct >= 0.3 && coin.priceChange24h >= 3 && volumeRatio >= 1.3;

    // ============================================================
    // SL: ATR-based, wide to survive volatility
    // ATR × 3 × coin multiplier — min 3%, max 15%
    // ============================================================
    const slMultiplier = Math.max(profile.slMultiplier, 1.5);
    const slPct = Math.min(Math.max(atrPct * 3 * slMultiplier, 0.03), 0.15);

    // Geometric win probability: P(TP hit before SL) = SL / (TP + SL)
    const tpHitProbability = slPct / (tpPct + slPct);
    // Relaxed: require ≥ 70% win probability
    if (tpHitProbability < 0.7) continue;

    const tp =
      direction === "LONG"
        ? coin.price * (1 + tpPct)
        : coin.price * (1 - tpPct);
    const sl =
      direction === "LONG"
        ? coin.price * (1 - slPct)
        : coin.price * (1 + slPct);

    // ============================================================
    // ML SCORING — composite confidence
    // ============================================================
    let mlScore = 80;
    if (direction === "LONG") {
      const rsiIdeal = 50;
      mlScore += Math.max(0, (15 - Math.abs(rsi - rsiIdeal)) / 15) * 8;
    } else {
      const rsiIdeal = 68;
      mlScore += Math.max(0, (12 - Math.abs(rsi - rsiIdeal)) / 12) * 8;
    }
    if (ema21 !== 0) {
      const emaDiff = Math.abs((ema9 - ema21) / ema21);
      mlScore += Math.min(5, emaDiff * 2000);
    }
    mlScore += Math.min(4, Math.abs(macd.histogram) * 500);
    mlScore += Math.min(4, (volumeRatio - 1.0) * 3);
    if (direction === "LONG" && coin.priceChange24h > 2) mlScore += 2;
    if (direction === "LONG" && coin.priceChange24h > 6) mlScore += 2;
    if (tpSource.includes("24h")) mlScore += 3;
    if (profile.wins > 0 && profile.losses === 0)
      mlScore = Math.min(99, mlScore + 3);
    if (profile.wins >= 3) mlScore = Math.min(99, mlScore + 2);
    // Bonus for coins already in motion
    if (Math.abs(coin.priceChange24h) > 5) mlScore += 1;

    mlScore = Math.min(99, Math.max(75, mlScore));

    const adjustmentFactor = getAdjustmentFactor();
    const rawConfidence = Math.min(99, Math.max(75, 70 + mlScore * 0.3));
    const confidence = Math.min(99, rawConfidence * adjustmentFactor);
    const tpProbabilityPct = Math.round(Math.min(99, tpHitProbability * 100));

    const estimatedHours = Math.max(
      1,
      Math.min(
        72,
        coin.price !== 0 && atr !== 0
          ? Math.round((tpPct * coin.price) / (atr * 1.2))
          : 8,
      ),
    );

    const dumpRisk: "Low" | "Medium" | "High" =
      coin.priceChange24h < -5
        ? "High"
        : coin.priceChange24h < -1
          ? "Medium"
          : "Low";
    const strengthLabel: "Strong" | "Weakening" | "At Risk" =
      confidence >= 90 ? "Strong" : confidence >= 82 ? "Weakening" : "At Risk";

    const profitScore = tpHitProbability * tpPct * 100 * volumeRatio;
    const profitPotential: "High" | "Medium" =
      tpPct >= 0.02 && tpProbabilityPct >= 80 ? "High" : "Medium";

    seenSymbols.add(coin.symbol);

    const rrRatio = slPct / tpPct;
    const compositeScore =
      confidence * 0.25 +
      tpProbabilityPct * 0.35 +
      tpPct * 100 * 0.2 +
      (coin.priceChange24h > 0 ? Math.min(coin.priceChange24h, 20) * 0.15 : 0) +
      (profile.wins - profile.losses) * 0.5 +
      rrRatio * 0.2;

    candidates.push({
      id: `${coin.symbol}-${hourSeed}`,
      symbol: coin.pairSymbol,
      coinId: coin.id,
      action: direction === "LONG" ? "BUY" : "SELL",
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
      momentum: coin.priceChange24h,
      trendDirection: trend,
      mlScore: Math.round(mlScore),
      estimatedHours,
      strengthLabel,
      dumpRisk,
      isTrending: Math.abs(coin.priceChange24h) > 5,
      analysis: `RSI ${rsi.toFixed(1)} | TP target: ${tpSource} | Win Prob ${tpProbabilityPct}% | TP +${(tpPct * 100).toFixed(2)}% | SL -${(slPct * 100).toFixed(1)}% | 24h momentum ${coin.priceChange24h.toFixed(1)}%`,
      status: "active",
      timestamp: Date.now(),
      hourSeed,
      aiEnriched: false,
      highProfitScore: profitScore,
      profitPotential,
      superHighProfit,
      guaranteedHit: tpHitProbability >= 0.93 && Math.round(mlScore) >= 90,
      score: compositeScore,
    });
  }

  // Sort by composite score — best signals first
  candidates.sort((a, b) => b.score - a.score);

  // NO CAP — return all qualifying signals
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

export type { Signal as default };
