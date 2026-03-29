import { analyzeFailure } from "./aiSkillEngine";
import {
  loadAILearningFromBackend,
  recordGlobalOutcome,
  saveAILearningToBackend,
} from "./backendStorage";
import { updateCoinProfile } from "./coinProfiler";

const LEARNING_KEY = "luxia_ai_learning";

export interface TradeOutcome {
  id: string;
  symbol: string;
  direction: string;
  confidence: number;
  tpProbability: number;
  outcome: "hit" | "missed";
  timestamp: number;
  rsiValue?: number;
  macdHistogram?: number;
  volumeRatio?: number;
  priceChange24h?: number;
  atr?: number;
  entryPrice?: number;
  stopLoss?: number;
}

export interface LearningStats {
  totalTrades: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgConfidenceHit: number;
  avgConfidenceMiss: number;
  learningScore: number;
  lastUpdated: number;
  adjustmentFactor: number;
  improvements: string[];
}

function loadData(): TradeOutcome[] {
  try {
    const raw = localStorage.getItem(LEARNING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveData(data: TradeOutcome[]): void {
  const trimmed = data.slice(-500);
  localStorage.setItem(LEARNING_KEY, JSON.stringify(trimmed));
  // Sync to backend (fire-and-forget)
  saveAILearningToBackend(JSON.stringify(trimmed));
}

// Initialize from backend on module load — load canister data and merge with local
let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureAILearningInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const backendData = await loadAILearningFromBackend();
      if (!backendData) {
        initialized = true;
        return;
      }
      const backendParsed: TradeOutcome[] = JSON.parse(backendData);
      if (!Array.isArray(backendParsed) || backendParsed.length === 0) {
        initialized = true;
        return;
      }
      const localData = loadData();
      const merged = [...localData];
      for (const item of backendParsed) {
        if (!merged.find((m) => m.id === item.id)) merged.push(item);
      }
      merged.sort((a, b) => a.timestamp - b.timestamp);
      const trimmed = merged.slice(-500);
      localStorage.setItem(LEARNING_KEY, JSON.stringify(trimmed));
    } catch {}
    initialized = true;
  })();
  return initPromise;
}

// Kick off init immediately (non-blocking)
ensureAILearningInitialized();

export function recordOutcome(outcome: TradeOutcome): void {
  const data = loadData();
  const filtered = data.filter((d) => d.id !== outcome.id);
  filtered.push(outcome);
  saveData(filtered);

  // Record global outcome for admin stats (fire-and-forget)
  recordGlobalOutcome(outcome.outcome === "hit" ? "hit" : "miss");

  const coinSymbol = outcome.symbol.replace("-USDT", "").replace("/USDT", "");
  updateCoinProfile(
    coinSymbol,
    outcome.outcome === "hit" ? "win" : "loss",
    outcome.outcome === "missed" ? "signal missed TP" : null,
    outcome.priceChange24h ? Math.abs(outcome.priceChange24h) : undefined,
    outcome.direction as "LONG" | "SHORT",
  );

  if (outcome.outcome === "missed") {
    analyzeFailure(outcome);
  }
}

export function getAdjustmentFactor(): number {
  const data = loadData();
  if (data.length < 5) return 1.0;
  const recent = data.slice(-20);
  const hitRate =
    recent.filter((d) => d.outcome === "hit").length / recent.length;
  if (hitRate >= 0.75) return 1.06;
  if (hitRate >= 0.6) return 1.02;
  if (hitRate >= 0.5) return 1.0;
  if (hitRate >= 0.4) return 0.97;
  return 0.93;
}

export function getLearningStats(): LearningStats {
  const data = loadData();
  const hits = data.filter((d) => d.outcome === "hit");
  const misses = data.filter((d) => d.outcome === "missed");
  const hitRate = data.length > 0 ? hits.length / data.length : 0;
  const avgConfidenceHit =
    hits.length > 0
      ? hits.reduce((s, d) => s + d.confidence, 0) / hits.length
      : 0;
  const avgConfidenceMiss =
    misses.length > 0
      ? misses.reduce((s, d) => s + d.confidence, 0) / misses.length
      : 0;

  const learningScore = Math.min(100, data.length * 2 + hitRate * 50);
  const improvements: string[] = [];
  if (data.length >= 5) {
    if (hitRate > 0.75)
      improvements.push("High accuracy maintained — signals performing well");
    if (hitRate < 0.5 && data.length >= 10)
      improvements.push("Tightening confidence threshold to improve accuracy");
    if (avgConfidenceHit > avgConfidenceMiss + 5)
      improvements.push("High-confidence signals showing better results");
  }
  if (improvements.length === 0)
    improvements.push("Collecting trade data to optimize signal accuracy");

  return {
    totalTrades: data.length,
    hits: hits.length,
    misses: misses.length,
    hitRate,
    avgConfidenceHit,
    avgConfidenceMiss,
    learningScore,
    lastUpdated: data.length > 0 ? data[data.length - 1].timestamp : Date.now(),
    adjustmentFactor: getAdjustmentFactor(),
    improvements,
  };
}
