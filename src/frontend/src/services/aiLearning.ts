const LEARNING_KEY = "luxia_ai_learning";

export interface TradeOutcome {
  id: string;
  symbol: string;
  direction: string;
  confidence: number;
  tpProbability: number;
  outcome: "hit" | "missed";
  timestamp: number;
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
  // Keep only last 500 outcomes to save space
  const trimmed = data.slice(-500);
  localStorage.setItem(LEARNING_KEY, JSON.stringify(trimmed));
}

export function recordOutcome(outcome: TradeOutcome): void {
  const data = loadData();
  // Remove duplicate if exists
  const filtered = data.filter((d) => d.id !== outcome.id);
  filtered.push(outcome);
  saveData(filtered);
}

export function getAdjustmentFactor(): number {
  const data = loadData();
  if (data.length < 5) return 1.0;
  const recent = data.slice(-20);
  const hitRate =
    recent.filter((d) => d.outcome === "hit").length / recent.length;
  // If hit rate > 70%, small positive boost; if < 40%, reduce confidence
  if (hitRate >= 0.7) return 1.05;
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
    if (hitRate > 0.7)
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
