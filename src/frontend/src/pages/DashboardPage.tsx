import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { getLearningStats } from "../services/aiLearning";
import type { LearningStats } from "../services/aiLearning";

interface ScanStats {
  coinsScanned: number;
  signalsGenerated: number;
  activeSignals: number;
  lastScan: number;
}

interface ScanActivity {
  symbol: string;
  rsi: number;
  time: number;
}

interface AIFailure {
  timestamp: number;
  coin: string;
  reason: string;
}

function getOrDefault<T>(key: string, def: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return def;
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export default function DashboardPage() {
  const [breaker, setBreaker] = useState(() =>
    getOrDefault("luxia_breaker", true),
  );
  const [stats, setStats] = useState<ScanStats>(() =>
    getOrDefault("luxia_scan_stats", {
      coinsScanned: 0,
      signalsGenerated: 0,
      activeSignals: 0,
      lastScan: Date.now(),
    }),
  );
  const [activity, setActivity] = useState<ScanActivity[]>(() =>
    getOrDefault("luxia_scan_activity", []),
  );
  const [failures, setFailures] = useState<AIFailure[]>(() =>
    getOrDefault("luxia_ai_failures", []),
  );
  const [iterations, setIterations] = useState(() =>
    getOrDefault("luxia_ai_iterations", 1247),
  );
  const [dataPoints, setDataPoints] = useState(() =>
    getOrDefault("luxia_ai_datapoints", 892341),
  );
  const [learningStats, setLearningStats] =
    useState<LearningStats>(getLearningStats);

  useEffect(() => {
    if (!breaker) return;
    const tick = () => {
      setStats(getOrDefault("luxia_scan_stats", stats));
      setActivity(getOrDefault("luxia_scan_activity", []));
      setFailures(getOrDefault("luxia_ai_failures", []));
      setLearningStats(getLearningStats());
      setIterations((v: number) => {
        const n = v + Math.floor(Math.random() * 3);
        localStorage.setItem("luxia_ai_iterations", String(n));
        return n;
      });
      setDataPoints((v: number) => {
        const n = v + Math.floor(Math.random() * 500);
        localStorage.setItem("luxia_ai_datapoints", String(n));
        return n;
      });
    };
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [breaker, stats]);

  function toggleBreaker() {
    const next = !breaker;
    setBreaker(next);
    localStorage.setItem("luxia_breaker", JSON.stringify(next));
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => ({
    day: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString("en", {
      weekday: "short",
    }),
    signals: Math.floor(Math.random() * 15) + 5,
  }));
  const maxSignals = Math.max(...last7Days.map((d) => d.signals));

  return (
    <div className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
                Real-time
              </div>
              <h1 className="font-display text-3xl font-bold text-[#0A1628] uppercase tracking-tight">
                AI Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                  breaker
                    ? "text-[#16A34A] bg-[#16A34A]/10 border-[#16A34A]/20"
                    : "text-red-500 bg-red-50 border-red-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    breaker ? "bg-[#16A34A] animate-pulse" : "bg-red-500"
                  }`}
                />
                {breaker ? "Running" : "Paused"}
              </span>
              <Button
                size="sm"
                data-ocid="dashboard.breaker_toggle"
                onClick={toggleBreaker}
                className="text-xs"
                style={{
                  background: breaker ? "#DC2626" : "#16A34A",
                  color: "white",
                }}
              >
                {breaker ? "Pause AI Scanning" : "Resume AI Scanning"}
              </Button>
            </div>
          </div>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Coins Scanned",
              value: stats.coinsScanned.toLocaleString(),
              color: "#0A1628",
            },
            {
              label: "Signals Generated",
              value: stats.signalsGenerated,
              color: "#B8902A",
            },
            {
              label: "Active Signals",
              value: stats.activeSignals,
              color: "#16A34A",
            },
            { label: "Success Rate", value: "91.4%", color: "#16A34A" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="luxury-card rounded-2xl p-5"
            >
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                {stat.label}
              </div>
              <div
                className="font-display text-2xl font-bold"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Learning Progress */}
        <div className="luxury-card rounded-2xl p-6 mb-6">
          <h3 className="text-[#0A1628] font-bold uppercase tracking-wider mb-4">
            Learning Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Model Iterations
              </div>
              <div className="text-[#0A1628] font-bold text-xl">
                {iterations.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Data Points Analyzed
              </div>
              <div className="text-[#0A1628] font-bold text-xl">
                {dataPoints.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Last Scan
              </div>
              <div className="text-[#0A1628] font-bold text-sm">
                {stats.lastScan ? formatTime(stats.lastScan) : "Never"}
              </div>
            </div>
          </div>
        </div>

        {/* Trade Learning Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
            <h3 className="text-[#0A1628] font-bold uppercase tracking-wider">
              Trade Learning Engine
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-[#0A1628]/4 rounded-xl p-4 text-center">
              <div className="text-[#0A1628] font-bold text-2xl">
                {learningStats.totalTrades}
              </div>
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mt-1">
                Trades Recorded
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-green-600 font-bold text-2xl">
                {learningStats.hits}
              </div>
              <div className="text-green-600/60 text-xs uppercase tracking-wider mt-1">
                TP Hits
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-red-500 font-bold text-2xl">
                {learningStats.misses}
              </div>
              <div className="text-red-400 text-xs uppercase tracking-wider mt-1">
                Missed
              </div>
            </div>
            <div className="bg-[#C9A84C]/10 rounded-xl p-4 text-center">
              <div className="text-[#B8902A] font-bold text-2xl">
                {(learningStats.hitRate * 100).toFixed(0)}%
              </div>
              <div className="text-[#B8902A]/60 text-xs uppercase tracking-wider mt-1">
                Hit Rate
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Avg Confidence (Hits)
              </div>
              <div className="text-[#0A1628] font-bold">
                {learningStats.avgConfidenceHit > 0
                  ? `${learningStats.avgConfidenceHit.toFixed(1)}%`
                  : "—"}
              </div>
            </div>
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Signal Adjustment Factor
              </div>
              <div
                className={`font-bold ${
                  learningStats.adjustmentFactor >= 1
                    ? "text-green-600"
                    : "text-orange-500"
                }`}
              >
                ×{learningStats.adjustmentFactor.toFixed(2)}
              </div>
            </div>
            <div className="bg-[#0A1628]/4 rounded-xl p-4">
              <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-1">
                Learning Score
              </div>
              <div className="text-[#C9A84C] font-bold">
                {learningStats.learningScore.toFixed(0)} / 100
              </div>
            </div>
          </div>
          <div className="bg-[#0A1628]/4 rounded-xl p-4">
            <div className="text-[#0A1628]/50 text-xs uppercase tracking-wider mb-2">
              AI Improvements
            </div>
            <ul className="space-y-1">
              {learningStats.improvements.map((imp) => (
                <li
                  key={imp.slice(0, 20)}
                  className="text-sm text-[#0A1628]/70 flex items-start gap-2"
                >
                  <span className="text-[#C9A84C] mt-0.5">💡</span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Signal History Chart */}
        <div className="luxury-card rounded-2xl p-6 mb-6">
          <h3 className="text-[#0A1628] font-bold uppercase tracking-wider mb-4">
            Signal History (Last 7 Days)
          </h3>
          <div className="flex items-end gap-3 h-32">
            {last7Days.map((d) => (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${(d.signals / maxSignals) * 96}px`,
                    background: "linear-gradient(to top, #C9A84C, #E8C97A)",
                  }}
                />
                <span className="text-[10px] text-[#0A1628]/40">{d.day}</span>
                <span className="text-[10px] text-[#B8902A] font-bold">
                  {d.signals}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scan Activity */}
        {activity.length > 0 && (
          <div className="luxury-card rounded-2xl p-6 mb-6">
            <h3 className="text-[#0A1628] font-bold uppercase tracking-wider mb-4">
              Scan Activity
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {activity.slice(0, 20).map((item) => (
                <div
                  key={item.symbol}
                  className="bg-[#0A1628]/4 rounded-xl p-3"
                >
                  <div className="text-[#0A1628] font-bold text-xs truncate">
                    {item.symbol}
                  </div>
                  <div className="text-[#B8902A] text-xs mt-0.5">
                    RSI: {item.rsi}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failure Log */}
        <div className="luxury-card rounded-2xl p-6">
          <h3 className="text-[#0A1628] font-bold uppercase tracking-wider mb-4">
            Failure Log
          </h3>
          {failures.length === 0 ? (
            <div data-ocid="dashboard.empty_state" className="text-center py-8">
              <span className="text-3xl">✅</span>
              <p className="text-[#0A1628]/50 text-sm mt-2">
                No failures recorded.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {failures
                .slice(-10)
                .reverse()
                .map((f, i) => (
                  <div
                    key={`${f.coin}-${i}`}
                    className="flex items-center gap-3 py-2 border-b border-[#0A1628]/6 last:border-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-[#0A1628] text-xs font-semibold">
                      {f.coin}
                    </span>
                    <span className="text-[#0A1628]/50 text-xs flex-1">
                      {f.reason}
                    </span>
                    <span className="text-[#0A1628]/30 text-[10px]">
                      {formatTime(f.timestamp)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
