/**
 * Per-coin behavior profiler.
 * Observes each coin's volatility, fluctuation range, and trade history
 * so signal engine can set dynamic SL/TP and avoid coins with repeated failures.
 */

const PROFILE_KEY = "luxia_coin_profiles";

export interface CoinProfile {
  symbol: string;
  // Observed volatility: average daily % move (absolute)
  avgVolatility: number;
  // ATR multiplier: how wide SL should be vs raw ATR
  slMultiplier: number;
  // Number of successful trades
  wins: number;
  // Number of failed trades
  losses: number;
  // Consecutive losses (reset on win)
  consecutiveLosses: number;
  // Last failure reason
  lastFailureReason: string | null;
  // RSI gate adjustments (learned)
  minRsi: number;
  maxRsi: number;
  // Direction bias: 1.0 = neutral, >1 = prefer LONG, <1 = prefer SHORT
  directionBias: number;
  // Timestamp of last update
  lastUpdated: number;
}

function loadProfiles(): Record<string, CoinProfile> {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProfiles(profiles: Record<string, CoinProfile>): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  } catch {
    // Storage full — prune oldest entries
    const entries = Object.entries(profiles);
    entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    const pruned = Object.fromEntries(entries.slice(-200));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(pruned));
  }
}

export function getCoinProfile(symbol: string): CoinProfile {
  const profiles = loadProfiles();
  return (
    profiles[symbol] ?? {
      symbol,
      avgVolatility: 3.0, // default 3% daily move
      slMultiplier: 2.0, // raised from 1.5 — wider SL from the start
      wins: 0,
      losses: 0,
      consecutiveLosses: 0,
      lastFailureReason: null,
      minRsi: 32,
      maxRsi: 60,
      directionBias: 1.0,
      lastUpdated: Date.now(),
    }
  );
}

export function updateCoinProfile(
  symbol: string,
  outcome: "win" | "loss",
  reason: string | null,
  observedVolatility?: number,
  direction?: "LONG" | "SHORT",
): void {
  const profiles = loadProfiles();
  const profile = getCoinProfile(symbol);

  if (outcome === "win") {
    profile.wins += 1;
    profile.consecutiveLosses = 0;
    // Reward: slightly relax RSI gates back toward neutral (but only by small step)
    if (direction === "LONG") {
      profile.minRsi = Math.max(30, profile.minRsi - 0.5);
      profile.maxRsi = Math.min(62, profile.maxRsi + 0.5);
    }
    const adjustmentLog = JSON.parse(
      localStorage.getItem("luxia_coin_adjustments") || "[]",
    );
    adjustmentLog.push({
      symbol,
      timestamp: Date.now(),
      outcome: "win",
      reason: "TP hit — relaxing gates slightly",
      newMinRsi: profile.minRsi,
      newMaxRsi: profile.maxRsi,
      slMultiplier: profile.slMultiplier,
      consecutiveLosses: 0,
    });
    if (adjustmentLog.length > 200)
      adjustmentLog.splice(0, adjustmentLog.length - 200);
    localStorage.setItem(
      "luxia_coin_adjustments",
      JSON.stringify(adjustmentLog),
    );
  } else {
    profile.losses += 1;
    profile.consecutiveLosses += 1;
    profile.lastFailureReason = reason;

    // Learn: tighten RSI gate for this coin based on failure pattern
    if (reason?.includes("RSI too high") && direction === "LONG") {
      profile.maxRsi = Math.max(50, profile.maxRsi - 2);
    }
    if (reason?.includes("RSI too low") && direction === "SHORT") {
      profile.minRsi = Math.min(68, profile.minRsi + 2);
    }

    // If coin has volatile failure: widen SL multiplier so fluctuation doesn't trigger it
    if (reason?.includes("volatility") || reason?.includes("fluctuation")) {
      profile.slMultiplier = Math.min(3.0, profile.slMultiplier + 0.3);
    }

    // Log the specific adjustment made for this coin
    const adjustmentLog = JSON.parse(
      localStorage.getItem("luxia_coin_adjustments") || "[]",
    );
    adjustmentLog.push({
      symbol,
      timestamp: Date.now(),
      outcome,
      reason: reason || "unknown",
      newMinRsi: profile.minRsi,
      newMaxRsi: profile.maxRsi,
      slMultiplier: profile.slMultiplier,
      consecutiveLosses: profile.consecutiveLosses,
    });
    // Keep only last 200 adjustments
    if (adjustmentLog.length > 200)
      adjustmentLog.splice(0, adjustmentLog.length - 200);
    localStorage.setItem(
      "luxia_coin_adjustments",
      JSON.stringify(adjustmentLog),
    );
  }

  if (observedVolatility !== undefined && observedVolatility > 0) {
    // Exponential moving average of observed volatility
    profile.avgVolatility =
      profile.avgVolatility * 0.8 + observedVolatility * 0.2;
  }

  // Direction bias: if LONG keeps winning, lean LONG more
  if (direction === "LONG") {
    profile.directionBias =
      outcome === "win"
        ? Math.min(1.5, profile.directionBias + 0.05)
        : Math.max(0.7, profile.directionBias - 0.05);
  } else if (direction === "SHORT") {
    profile.directionBias =
      outcome === "win"
        ? Math.max(0.7, profile.directionBias - 0.05)
        : Math.min(1.3, profile.directionBias + 0.03);
  }

  profile.lastUpdated = Date.now();
  profiles[symbol] = profile;
  saveProfiles(profiles);
}

/** Returns true if this coin should be temporarily skipped (too many recent losses) */
export function isCoinBlocked(symbol: string): boolean {
  const profile = getCoinProfile(symbol);
  return profile.consecutiveLosses >= 3;
}

export function getAllProfiles(): Record<string, CoinProfile> {
  return loadProfiles();
}

export function resetCoinProfile(symbol: string): void {
  const profiles = loadProfiles();
  delete profiles[symbol];
  saveProfiles(profiles);
}

export function resetAllProfiles(): void {
  localStorage.removeItem(PROFILE_KEY);
}
