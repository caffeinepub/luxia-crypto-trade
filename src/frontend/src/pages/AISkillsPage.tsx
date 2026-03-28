import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { getLearningStats } from "../services/aiLearning";
import {
  type FailureAnalysis,
  type ParamChange,
  type RewriteEntry,
  forceRetrain,
  getParamHistory,
  getRewriteLog,
  getSkillLog,
  getSkillMetrics,
} from "../services/aiSkillEngine";
import { getAllProfiles } from "../services/coinProfiler";

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const INDICATOR_COLORS: Record<string, string> = {
  RSI: "bg-orange-100 text-orange-700 border-orange-200",
  MACD: "bg-purple-100 text-purple-700 border-purple-200",
  Volume: "bg-blue-100 text-blue-700 border-blue-200",
  Momentum: "bg-red-100 text-red-700 border-red-200",
  "Stop Loss": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Market Conditions": "bg-gray-100 text-gray-700 border-gray-200",
  "Trend Strength": "bg-teal-100 text-teal-700 border-teal-200",
  Unknown: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AISkillsPage() {
  const [activeTab, setActiveTab] = useState<
    "failures" | "params" | "rewrites" | "profiles"
  >("failures");
  const [failures, setFailures] = useState<FailureAnalysis[]>([]);
  const [params, setParams] = useState<ParamChange[]>([]);
  const [rewrites, setRewrites] = useState<RewriteEntry[]>([]);
  const [metrics, setMetrics] = useState(getSkillMetrics());
  const [stats, setStats] = useState(getLearningStats());
  const [profiles, setProfiles] = useState<ReturnType<typeof getAllProfiles>>(
    {},
  );
  const [retraining, setRetraining] = useState(false);

  function refresh() {
    setFailures(getSkillLog());
    setParams(getParamHistory());
    setRewrites(getRewriteLog());
    setMetrics(getSkillMetrics());
    setStats(getLearningStats());
    setProfiles(getAllProfiles());
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  function handleRetrain() {
    setRetraining(true);
    forceRetrain();
    setTimeout(() => {
      refresh();
      setRetraining(false);
    }, 2000);
  }

  const tabs = [
    { id: "failures" as const, label: "Failure Log", count: failures.length },
    { id: "params" as const, label: "Parameter Changes", count: params.length },
    { id: "rewrites" as const, label: "Code Rewrites", count: rewrites.length },
    {
      id: "profiles" as const,
      label: "Coin Profiles",
      count: Object.keys(profiles).length,
    },
  ];

  const profileEntries = Object.values(profiles);
  const blockedCoins = profileEntries.filter((p) => p.consecutiveLosses >= 3);

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
            Self-Improving System
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-[#0A1628] uppercase tracking-tight">
                AI Skill Engine
              </h1>
              <p className="text-[#0A1628]/55 text-sm mt-1">
                Real-time learning from every trade failure. AI observes,
                analyzes, and upgrades itself.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetrain}
              disabled={retraining}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
                retraining
                  ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-not-allowed"
                  : "bg-[#0A1628] text-white hover:bg-[#0A1628]/85"
              }`}
            >
              {retraining ? (
                <>
                  <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Retraining...
                </>
              ) : (
                "⚡ Force Retrain"
              )}
            </button>
          </div>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        {/* Live Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              label: "Win Rate",
              value:
                stats.totalTrades > 0
                  ? `${(stats.hitRate * 100).toFixed(1)}%`
                  : "N/A",
              sub: `${stats.hits} hits / ${stats.misses} misses`,
              color:
                stats.hitRate >= 0.7
                  ? "text-green-600"
                  : stats.hitRate >= 0.5
                    ? "text-amber-600"
                    : "text-red-500",
            },
            {
              label: "Failures Analyzed",
              value: metrics.totalFailuresAnalyzed,
              sub: `Most common: ${metrics.mostCommonFailure}`,
              color: "text-[#0A1628]",
            },
            {
              label: "Code Rewrites",
              value: metrics.totalRewrites,
              sub: `${metrics.totalParamChanges} param changes`,
              color: "text-purple-600",
            },
            {
              label: "Coins Blocked",
              value: blockedCoins.length,
              sub: "≥3 consecutive losses",
              color:
                blockedCoins.length > 0 ? "text-red-500" : "text-green-600",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="luxury-card rounded-2xl p-5 border border-[#0A1628]/8"
            >
              <div className="text-[#0A1628]/45 text-[10px] uppercase tracking-widest mb-1">
                {m.label}
              </div>
              <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[#0A1628]/40 text-[10px] mt-0.5">
                {m.sub}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Indicator Breakdown */}
        {Object.keys(metrics.indicatorBreakdown).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="luxury-card rounded-2xl p-5 mb-6 border border-[#0A1628]/8"
          >
            <div className="text-[#0A1628]/55 text-xs uppercase tracking-widest font-semibold mb-3">
              Failure Breakdown by Indicator
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.indicatorBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([indicator, count]) => (
                  <div
                    key={indicator}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                      INDICATOR_COLORS[indicator] ||
                      "bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    <span>{indicator}</span>
                    <span className="bg-white/60 px-1.5 py-0.5 rounded-full font-bold">
                      {count}x
                    </span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[#0A1628]/4 p-1 rounded-xl mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-wide whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-[#0A1628] text-white shadow-sm"
                  : "text-[#0A1628]/60 hover:text-[#0A1628]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-[#0A1628]/10 text-[#0A1628]/60"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Failure Log */}
        {activeTab === "failures" && (
          <div className="space-y-3">
            {failures.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No failures recorded yet"
                sub="As trades complete, failures will be analyzed here with detailed reasons and improvement actions."
              />
            ) : (
              failures.map((f, i) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="luxury-card rounded-2xl p-5 border border-[#0A1628]/8"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0A1628] font-bold text-sm">
                        {f.symbol}
                      </span>
                      <Badge
                        className={`text-[10px] font-bold uppercase ${
                          f.direction === "LONG"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {f.direction}
                      </Badge>
                      <Badge
                        className={`text-[10px] border ${
                          INDICATOR_COLORS[f.indicatorFailed] ||
                          "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        {f.indicatorFailed} failed
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#0A1628]/40 text-[10px]">
                        {timeAgo(f.timestamp)}
                      </span>
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {f.confidence}% conf
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
                    <div className="text-red-600 text-[10px] uppercase font-bold mb-1">
                      ❌ Why it failed
                    </div>
                    <p className="text-[#0A1628]/80 text-xs leading-relaxed">
                      {f.reason}
                    </p>
                  </div>
                  <div className="mt-2 bg-green-50 border border-green-100 rounded-xl p-3">
                    <div className="text-green-600 text-[10px] uppercase font-bold mb-1">
                      ✅ Action taken
                    </div>
                    <p className="text-[#0A1628]/80 text-xs leading-relaxed">
                      {f.actionTaken}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Parameter Changes */}
        {activeTab === "params" && (
          <div className="space-y-3">
            {params.length === 0 ? (
              <EmptyState
                icon="⚙️"
                title="No parameter changes yet"
                sub="When AI adjusts signal thresholds based on failures, changes will appear here with full audit trail."
              />
            ) : (
              params.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="luxury-card rounded-2xl p-5 border border-[#0A1628]/8"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0A1628] font-bold text-sm">
                        {p.param}
                      </span>
                      {p.coinSymbol && (
                        <Badge className="text-[10px] bg-[#0A1628]/8 text-[#0A1628]/70">
                          {p.coinSymbol}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[#0A1628]/40 text-[10px]">
                      {timeAgo(p.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100">
                      Before: {String(p.oldValue)}
                    </span>
                    <span className="text-[#0A1628]/30">→</span>
                    <span className="bg-green-50 text-green-600 px-2 py-1 rounded-lg border border-green-100">
                      After: {String(p.newValue)}
                    </span>
                  </div>
                  <p className="text-[#0A1628]/55 text-[11px] mt-2 leading-relaxed">
                    {p.reason}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Code Rewrites */}
        {activeTab === "rewrites" && (
          <div className="space-y-3">
            {rewrites.length === 0 ? (
              <EmptyState
                icon="🔧"
                title="No code rewrites yet"
                sub="When the same indicator fails 3+ times, AI rewrites that section of its signal logic. Full rewrite history will appear here."
              />
            ) : (
              rewrites.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="luxury-card rounded-2xl p-5 border border-[#C9A84C]/30 bg-gradient-to-br from-white to-amber-50/30"
                >
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <div className="text-[#B8902A] text-[10px] uppercase font-bold tracking-wider mb-1">
                        Code Rewrite
                      </div>
                      <div className="text-[#0A1628] font-bold text-sm">
                        {r.component}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                        Triggered {r.triggerCount}x
                      </span>
                      <span className="text-[#0A1628]/40 text-[10px]">
                        {timeAgo(r.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[#0A1628]/70 text-xs mb-3 leading-relaxed">
                    {r.description}
                  </p>
                  <div className="space-y-2">
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <div className="text-red-500 text-[9px] uppercase font-bold mb-1">
                        Before
                      </div>
                      <code className="text-red-700 text-[11px] font-mono">
                        {r.before}
                      </code>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                      <div className="text-green-500 text-[9px] uppercase font-bold mb-1">
                        After
                      </div>
                      <code className="text-green-700 text-[11px] font-mono">
                        {r.after}
                      </code>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Coin Profiles */}
        {activeTab === "profiles" && (
          <div>
            {profileEntries.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No coin profiles yet"
                sub="As coins generate signals and trade outcomes are recorded, per-coin behavior profiles will build up here."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profileEntries
                  .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
                  .map((p, i) => (
                    <motion.div
                      key={p.symbol}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`luxury-card rounded-2xl p-4 border ${
                        p.consecutiveLosses >= 3
                          ? "border-red-200 bg-red-50/30"
                          : p.wins > p.losses
                            ? "border-green-200 bg-green-50/20"
                            : "border-[#0A1628]/8"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-[#0A1628] text-sm">
                          {p.symbol}
                        </span>
                        {p.consecutiveLosses >= 3 ? (
                          <Badge className="text-[10px] bg-red-100 text-red-700">
                            Blocked
                          </Badge>
                        ) : p.wins > 0 ? (
                          <Badge className="text-[10px] bg-green-100 text-green-700">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-gray-100 text-gray-600">
                            Learning
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-green-600 font-bold text-base">
                            {p.wins}
                          </div>
                          <div className="text-green-700/60">Wins</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 text-center">
                          <div className="text-red-500 font-bold text-base">
                            {p.losses}
                          </div>
                          <div className="text-red-600/60">Losses</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-[10px] text-[#0A1628]/60">
                        <div className="flex justify-between">
                          <span>RSI Gate</span>
                          <span className="font-semibold text-[#0A1628]">
                            {p.minRsi.toFixed(0)}–{p.maxRsi.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>SL Multiplier</span>
                          <span className="font-semibold text-[#0A1628]">
                            {p.slMultiplier.toFixed(2)}x ATR
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Volatility</span>
                          <span className="font-semibold text-[#0A1628]">
                            {p.avgVolatility.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Consec. Losses</span>
                          <span
                            className={`font-bold ${
                              p.consecutiveLosses >= 3
                                ? "text-red-500"
                                : p.consecutiveLosses >= 1
                                  ? "text-amber-500"
                                  : "text-green-600"
                            }`}
                          >
                            {p.consecutiveLosses}
                          </span>
                        </div>
                      </div>
                      {p.lastFailureReason && (
                        <div className="mt-2 bg-[#0A1628]/4 rounded-lg p-2">
                          <div className="text-[9px] text-[#0A1628]/40 uppercase mb-0.5">
                            Last failure
                          </div>
                          <p className="text-[#0A1628]/60 text-[10px] leading-relaxed line-clamp-2">
                            {p.lastFailureReason}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: { icon: string; title: string; sub: string }) {
  return (
    <div className="luxury-card rounded-2xl p-12 text-center border border-[#0A1628]/8">
      <div className="text-4xl mb-4">{icon}</div>
      <div className="text-[#0A1628] font-bold text-base mb-2">{title}</div>
      <p className="text-[#0A1628]/45 text-sm max-w-md mx-auto leading-relaxed">
        {sub}
      </p>
    </div>
  );
}
