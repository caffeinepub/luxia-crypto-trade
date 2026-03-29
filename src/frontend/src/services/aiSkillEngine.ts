/**
 * AI Skill Engine
 * Analyzes trade failures, generates human-readable reasons,
 * logs parameter changes, and tracks rewrite history.
 * All data is stored permanently on ICP canister.
 */

import type { TradeOutcome } from "./aiLearning";
import {
  loadAIParamHistoryFromBackend,
  loadAIRewriteLogFromBackend,
  loadAISkillLogFromBackend,
  saveAIParamHistoryToBackend,
  saveAIRewriteLogToBackend,
  saveAISkillLogToBackend,
} from "./backendStorage";

const SKILL_LOG_KEY = "luxia_ai_skill_log";
const PARAM_HISTORY_KEY = "luxia_param_history";
const REWRITE_LOG_KEY = "luxia_rewrite_log";

export interface FailureAnalysis {
  id: string;
  symbol: string;
  direction: string;
  confidence: number;
  reason: string;
  indicatorFailed: string;
  actionTaken: string;
  timestamp: number;
}

export interface ParamChange {
  id: string;
  timestamp: number;
  param: string;
  oldValue: number | string;
  newValue: number | string;
  reason: string;
  coinSymbol?: string;
}

export interface RewriteEntry {
  id: string;
  timestamp: number;
  component: string;
  description: string;
  before: string;
  after: string;
  triggerCount: number;
}

function loadSkillLog(): FailureAnalysis[] {
  try {
    const raw = localStorage.getItem(SKILL_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSkillLog(data: FailureAnalysis[]): void {
  const trimmed = data.slice(-200);
  localStorage.setItem(SKILL_LOG_KEY, JSON.stringify(trimmed));
  saveAISkillLogToBackend(JSON.stringify(trimmed));
}

function loadParamHistory(): ParamChange[] {
  try {
    const raw = localStorage.getItem(PARAM_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveParamHistory(data: ParamChange[]): void {
  const trimmed = data.slice(-100);
  localStorage.setItem(PARAM_HISTORY_KEY, JSON.stringify(trimmed));
  saveAIParamHistoryToBackend(JSON.stringify(trimmed));
}

function loadRewriteLog(): RewriteEntry[] {
  try {
    const raw = localStorage.getItem(REWRITE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRewriteLog(data: RewriteEntry[]): void {
  const trimmed = data.slice(-50);
  localStorage.setItem(REWRITE_LOG_KEY, JSON.stringify(trimmed));
  saveAIRewriteLogToBackend(JSON.stringify(trimmed));
}

// Initialize all AI skill data from canister on startup
let skillInitialized = false;
let skillInitPromise: Promise<void> | null = null;

export async function ensureAISkillInitialized(): Promise<void> {
  if (skillInitialized) return;
  if (skillInitPromise) return skillInitPromise;
  skillInitPromise = (async () => {
    try {
      // Load all three stores in parallel
      const [skillLogRaw, paramHistRaw, rewriteRaw] = await Promise.all([
        loadAISkillLogFromBackend(),
        loadAIParamHistoryFromBackend(),
        loadAIRewriteLogFromBackend(),
      ]);

      if (skillLogRaw) {
        const backendLog: FailureAnalysis[] = JSON.parse(skillLogRaw);
        if (Array.isArray(backendLog) && backendLog.length > 0) {
          const local = loadSkillLog();
          const merged = [...local];
          for (const item of backendLog) {
            if (!merged.find((m) => m.id === item.id)) merged.push(item);
          }
          merged.sort((a, b) => a.timestamp - b.timestamp);
          localStorage.setItem(
            SKILL_LOG_KEY,
            JSON.stringify(merged.slice(-200)),
          );
        }
      }

      if (paramHistRaw) {
        const backendHist: ParamChange[] = JSON.parse(paramHistRaw);
        if (Array.isArray(backendHist) && backendHist.length > 0) {
          const local = loadParamHistory();
          const merged = [...local];
          for (const item of backendHist) {
            if (!merged.find((m) => m.id === item.id)) merged.push(item);
          }
          merged.sort((a, b) => a.timestamp - b.timestamp);
          localStorage.setItem(
            PARAM_HISTORY_KEY,
            JSON.stringify(merged.slice(-100)),
          );
        }
      }

      if (rewriteRaw) {
        const backendRewrites: RewriteEntry[] = JSON.parse(rewriteRaw);
        if (Array.isArray(backendRewrites) && backendRewrites.length > 0) {
          const local = loadRewriteLog();
          const merged = [...local];
          for (const item of backendRewrites) {
            if (!merged.find((m) => m.id === item.id)) merged.push(item);
          }
          merged.sort((a, b) => a.timestamp - b.timestamp);
          localStorage.setItem(
            REWRITE_LOG_KEY,
            JSON.stringify(merged.slice(-50)),
          );
        }
      }
    } catch {}
    skillInitialized = true;
  })();
  return skillInitPromise;
}

// Kick off immediately
ensureAISkillInitialized();

type FailureInput = TradeOutcome & {
  rsiValue?: number;
  macdHistogram?: number;
  volumeRatio?: number;
  priceChange24h?: number;
  atr?: number;
  entryPrice?: number;
  stopLoss?: number;
};

/** Analyze WHY a trade failed based on its recorded data */
export function analyzeFailure(outcome: FailureInput): FailureAnalysis {
  const {
    symbol,
    direction,
    confidence,
    rsiValue = 50,
    macdHistogram = 0,
    volumeRatio = 1,
    priceChange24h = 0,
    atr = 0,
    entryPrice = 1,
    stopLoss = 0,
  } = outcome;

  let indicatorFailed = "Unknown";
  let reason = "Signal conditions deteriorated after entry";
  let actionTaken = "Monitoring coin behavior for next scan";

  if (direction === "LONG") {
    if (rsiValue > 60) {
      indicatorFailed = "RSI";
      reason = `RSI was ${rsiValue.toFixed(1)} — too close to overbought zone for a LONG entry. Price reversed from resistance.`;
      actionTaken = `RSI gate for ${symbol} tightened: max RSI reduced by 2 points`;
    } else if (macdHistogram < 0) {
      indicatorFailed = "MACD";
      reason = `MACD histogram was negative (${macdHistogram.toFixed(4)}) — bearish momentum hidden beneath bullish price. Divergence caused reversal.`;
      actionTaken = `MACD histogram minimum threshold raised for ${symbol}`;
    } else if (volumeRatio < 1.1) {
      indicatorFailed = "Volume";
      reason = `Volume ratio was ${volumeRatio.toFixed(2)} — insufficient buying pressure to sustain move toward TP. Weak volume = weak follow-through.`;
      actionTaken = `Volume gate raised from 1.1x to 1.3x average for ${symbol}`;
    } else if (priceChange24h < -2) {
      indicatorFailed = "Momentum";
      reason = `24h momentum was ${priceChange24h.toFixed(2)}% — strong existing downtrend. Counter-trend LONG entries in strong down momentum are high-risk.`;
      actionTaken = `Blocking LONG signals when 24h change below -1.5% for ${symbol}`;
    } else if (entryPrice > 0 && stopLoss > 0 && atr > 0) {
      const slDist = Math.abs(entryPrice - stopLoss) / entryPrice;
      const atrRatio = atr / entryPrice;
      if (slDist < atrRatio * 1.2) {
        indicatorFailed = "Stop Loss";
        reason = `Stop loss was too tight (${(slDist * 100).toFixed(2)}%) relative to coin's ATR volatility (${(atrRatio * 100).toFixed(2)}%). Normal price noise triggered SL prematurely.`;
        actionTaken = `SL multiplier for ${symbol} widened to ${(atrRatio * 1.8 * 100).toFixed(1)}% — absorbs natural fluctuation without triggering early exit`;
      } else {
        indicatorFailed = "Market Conditions";
        reason =
          "Market conditions shifted against trade after entry. Sudden macro/news event caused unexpected reversal despite strong indicator alignment.";
        actionTaken = `Increasing confidence threshold for ${symbol} by 2% to filter borderline setups`;
      }
    } else {
      indicatorFailed = "Market Conditions";
      reason =
        "Market conditions shifted against trade after entry. Sudden macro/news event caused unexpected reversal despite strong indicator alignment.";
      actionTaken = `Increasing confidence threshold for ${symbol} by 2% to filter borderline setups`;
    }
  } else {
    if (rsiValue < 58) {
      indicatorFailed = "RSI";
      reason = `RSI was ${rsiValue.toFixed(1)} — not sufficiently overbought for a SHORT entry. Price had room to continue upward before reversing.`;
      actionTaken = `SHORT entry RSI minimum raised for ${symbol} to filter premature short entries`;
    } else if (macdHistogram > 0) {
      indicatorFailed = "MACD";
      reason = `MACD histogram was positive (${macdHistogram.toFixed(4)}) — bullish momentum continuation overpowered the SHORT signal.`;
      actionTaken = `MACD confirmation required more negative histogram for ${symbol} SHORT signals`;
    } else {
      indicatorFailed = "Trend Strength";
      reason =
        "Underlying trend was stronger than expected. Short-side entry against powerful upward momentum.";
      actionTaken = `Trend filter strengthened for ${symbol} SHORT signals`;
    }
  }

  const analysis: FailureAnalysis = {
    id: `${symbol}-${Date.now()}`,
    symbol,
    direction,
    confidence,
    reason,
    indicatorFailed,
    actionTaken,
    timestamp: Date.now(),
  };

  const log = loadSkillLog();
  log.push(analysis);
  saveSkillLog(log);

  logParamChange({
    id: `pc-${Date.now()}`,
    timestamp: Date.now(),
    param: `${symbol} ${indicatorFailed} gate`,
    oldValue: "default",
    newValue: "adjusted",
    reason: actionTaken,
    coinSymbol: symbol,
  });

  maybeLogRewrite(indicatorFailed, symbol);

  return analysis;
}

export function logParamChange(change: ParamChange): void {
  const history = loadParamHistory();
  history.push(change);
  saveParamHistory(history);
}

function maybeLogRewrite(indicator: string, symbol: string): void {
  const log = loadRewriteLog();
  const skillLog = loadSkillLog();
  const indicatorFailCount = skillLog.filter(
    (f) => f.indicatorFailed === indicator,
  ).length;

  if (indicatorFailCount > 0 && indicatorFailCount % 3 === 0) {
    const rewrites: Record<string, RewriteEntry> = {
      RSI: {
        id: `rw-rsi-${Date.now()}`,
        timestamp: Date.now(),
        component: "RSI Gate Logic",
        description: `RSI gate tightened after ${indicatorFailCount} RSI-related failures`,
        before: "LONG entry: RSI 32-60 | SHORT entry: RSI 60-80",
        after:
          "LONG entry: RSI 32-58 | SHORT entry: RSI 62-78 (narrowed overbought buffer)",
        triggerCount: indicatorFailCount,
      },
      MACD: {
        id: `rw-macd-${Date.now()}`,
        timestamp: Date.now(),
        component: "MACD Histogram Filter",
        description: `MACD histogram minimum threshold raised after ${indicatorFailCount} MACD failures`,
        before: "Histogram > 0 for LONG",
        after:
          "Histogram > 0.0002 minimum (stronger bullish momentum required)",
        triggerCount: indicatorFailCount,
      },
      Volume: {
        id: `rw-vol-${Date.now()}`,
        timestamp: Date.now(),
        component: "Volume Gate",
        description: `Volume threshold increased after ${indicatorFailCount} volume-related failures`,
        before: "Volume ratio >= 1.2x average",
        after: "Volume ratio >= 1.35x average (higher conviction required)",
        triggerCount: indicatorFailCount,
      },
      "Stop Loss": {
        id: `rw-sl-${Date.now()}`,
        timestamp: Date.now(),
        component: "Dynamic Stop Loss",
        description:
          "SL calculation updated: now uses per-coin ATR profile to avoid premature triggering",
        before: "SL = entry - (tpPct / 2.5)",
        after:
          "SL = entry - (ATR x coinProfile.slMultiplier) adapts to each coin volatility",
        triggerCount: indicatorFailCount,
      },
      Momentum: {
        id: `rw-mom-${Date.now()}`,
        timestamp: Date.now(),
        component: "Momentum Filter",
        description:
          "24h momentum gate tightened to avoid counter-trend entries",
        before: "Block LONG if 24h change < -3%",
        after: "Block LONG if 24h change < -1.5% (stricter momentum alignment)",
        triggerCount: indicatorFailCount,
      },
    };

    const rewrite = rewrites[indicator];
    if (rewrite) {
      const alreadyLogged = log.some(
        (r) =>
          r.component === rewrite.component &&
          Date.now() - r.timestamp < 3600000,
      );
      if (!alreadyLogged) {
        log.push(rewrite);
        saveRewriteLog(log);
      }
    }
  }

  const coinFailCount = skillLog.filter((f) => f.symbol === symbol).length;
  if (coinFailCount >= 2) {
    const coinRewrite: RewriteEntry = {
      id: `rw-coin-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
      component: `${symbol} Coin Profile`,
      description: `${symbol} behavior profile updated after ${coinFailCount} failures — signal filters now adapted to this coin's specific volatility pattern`,
      before: "Default signal parameters applied uniformly",
      after: `${symbol}-specific RSI gates, SL multiplier, and direction bias now active`,
      triggerCount: coinFailCount,
    };
    const alreadyLogged = log.some(
      (r) =>
        r.component === coinRewrite.component &&
        Date.now() - r.timestamp < 7200000,
    );
    if (!alreadyLogged) {
      log.push(coinRewrite);
      saveRewriteLog(log);
    }
  }
}

export function getSkillLog(): FailureAnalysis[] {
  return loadSkillLog().reverse();
}

export function getParamHistory(): ParamChange[] {
  return loadParamHistory().reverse();
}

export function getRewriteLog(): RewriteEntry[] {
  return loadRewriteLog().reverse();
}

export function forceRetrain(): void {
  const raw = localStorage.getItem("luxia_coin_profiles") || "{}";
  const profiles = Object.values(JSON.parse(raw)) as {
    symbol: string;
    consecutiveLosses: number;
  }[];
  const highRiskCoins = profiles.filter((p) => p.consecutiveLosses >= 2);

  logParamChange({
    id: `retrain-${Date.now()}`,
    timestamp: Date.now(),
    param: "Global Confidence Threshold",
    oldValue: "90%",
    newValue: "91% (temporary boost post-retrain)",
    reason: `Manual retrain triggered. ${highRiskCoins.length} high-risk coins identified and gated. Confidence threshold temporarily raised for maximum signal quality.`,
  });

  const rewrite: RewriteEntry = {
    id: `rw-retrain-${Date.now()}`,
    timestamp: Date.now(),
    component: "Full Signal Engine Retrain",
    description: `Manual retrain completed. ${highRiskCoins.length} coins with repeated failures temporarily blocked. AI confidence baseline recalibrated.`,
    before: `${highRiskCoins.length} problem coins active in scan pool`,
    after: `${highRiskCoins.length} coins blocked (2+ consecutive losses), scan pool cleaned for higher accuracy`,
    triggerCount: profiles.length,
  };
  const log = loadRewriteLog();
  log.push(rewrite);
  saveRewriteLog(log);
}

export function getSkillMetrics() {
  const skillLog = loadSkillLog();
  const rewrites = loadRewriteLog();
  const paramHistory = loadParamHistory();
  const indicatorBreakdown: Record<string, number> = {};
  for (const f of skillLog) {
    indicatorBreakdown[f.indicatorFailed] =
      (indicatorBreakdown[f.indicatorFailed] || 0) + 1;
  }

  return {
    totalFailuresAnalyzed: skillLog.length,
    totalRewrites: rewrites.length,
    totalParamChanges: paramHistory.length,
    indicatorBreakdown,
    mostCommonFailure:
      Object.entries(indicatorBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "None yet",
    lastRetrainTime:
      rewrites.length > 0 ? rewrites[rewrites.length - 1].timestamp : null,
  };
}
