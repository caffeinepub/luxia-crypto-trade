/**
 * Per-coin behavior profiler.
 * Observes each coin's volatility, fluctuation range, and trade history
 * so signal engine can set dynamic SL/TP and avoid coins with repeated failures.
 * Data is stored permanently on ICP canister and loaded on startup.
 */

import {
  loadCoinProfilesFromBackend,
  saveCoinProfilesToBackend,
} from "./backendStorage";

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
  // Sync to backend canister permanently
  saveCoinProfilesToBackend(JSON.stringify(profiles));
}

// Initialize from backend canister on startup
let coinProfileInitialized = false;
let coinProfileInitPromise: Promise<void> | null = null;

export async function ensureCoinProfilesInitialized(): Promise<void> {
  if (coinProfileInitialized) return;
  if (coinProfileInitPromise) return coinProfileInitPromise;
  coinProfileInitPromise = (async () => {
    try {
      const backendData = await loadCoinProfilesFromBackend();
      if (!backendData) {
        coinProfileInitialized = true;
        return;
      }
      const backendProfiles: Record<string, CoinProfile> =
        JSON.parse(backendData);
      if (!backendProfiles || typeof backendProfiles !== "object") {
        coinProfileInitialized = true;
        return;
      }
      // Merge with local: backend wins on conflicts (more recent/complete)
      const localProfiles = loadProfiles();
      const merged = { ...localProfiles };
      for (const [symbol, profile] of Object.entries(backendProfiles)) {
        if (
          !merged[symbol] ||
          profile.lastUpdated > (merged[symbol]?.lastUpdated ?? 0)
        ) {
          merged[symbol] = profile;
        }
      }
      localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    } catch {}
    coinProfileInitialized = true;
  })();
  return coinProfileInitPromise;
}

// Kick off init immediately
ensureCoinProfilesInitialized();

export function getCoinProfile(symbol: string): CoinProfile {
  const profiles = loadProfiles();
  return (
    profiles[symbol] ?? {
      symbol,
      avgVolatility: 3.0,
      slMultiplier: 2.0,
      wins: 0,
      losses: 0,
      consecutiveLosses: 0,
      lastFailureReason: null,
      minRsi: 38,
      maxRsi: 62,
      directionBias: 1.0,
      lastUpdated: Date.now(),
    }
  );
}

export function updateCoinProfile(
  symbol: string,
  result: "win" | "loss",
  failureReason: string | null = null,
  volatility?: number,
  direction?: "LONG" | "SHORT",
): void {
  const profiles = loadProfiles();
  const existing = profiles[symbol] ?? getCoinProfile(symbol);

  const updated: CoinProfile = {
    ...existing,
    lastUpdated: Date.now(),
  };

  if (result === "win") {
    updated.wins += 1;
    updated.consecutiveLosses = 0;
    // Slightly loosen RSI gates on wins (coin is behaving well)
    if (updated.minRsi > 36) updated.minRsi -= 0.5;
    if (updated.maxRsi < 64) updated.maxRsi += 0.5;
    // Loosen SL a bit — was too tight concerns are resolved
    if (updated.slMultiplier > 1.8) updated.slMultiplier -= 0.1;
    // Adjust direction bias
    if (direction === "LONG")
      updated.directionBias = Math.min(1.5, updated.directionBias + 0.05);
    if (direction === "SHORT")
      updated.directionBias = Math.max(0.5, updated.directionBias - 0.05);
  } else {
    updated.losses += 1;
    updated.consecutiveLosses += 1;
    updated.lastFailureReason = failureReason;
    // Tighten RSI gates on losses (only for this coin)
    if (updated.consecutiveLosses >= 2) {
      updated.minRsi = Math.min(updated.minRsi + 1, 48);
      updated.maxRsi = Math.max(updated.maxRsi - 1, 56);
      updated.slMultiplier = Math.min(updated.slMultiplier + 0.2, 4.0);
    }
  }

  if (volatility !== undefined) {
    // Exponential moving average of observed volatility
    updated.avgVolatility = updated.avgVolatility * 0.8 + volatility * 0.2;
  }

  profiles[symbol] = updated;
  saveProfiles(profiles);
}

export function shouldSkipCoin(symbol: string): boolean {
  const profile = getCoinProfile(symbol);
  return profile.consecutiveLosses >= 2;
}

export function getAllProfiles(): Record<string, CoinProfile> {
  return loadProfiles();
}
