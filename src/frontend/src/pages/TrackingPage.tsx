import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import TradeDetailModal from "../components/TradeDetailModal";
import { useAuth } from "../context/AuthContext";
import { analyzeTrackedTrade, chatWithAI } from "../services/ai";
import { getLearningStats, recordOutcome } from "../services/aiLearning";
import {
  loadTrackedTradesFromBackend,
  saveTrackedTradesToBackend,
} from "../services/backendStorage";
import type { Signal } from "../services/signalEngine";

const TRACKED_KEY = "luxia_tracked_trades";
const GUEST_TRACKED_KEY = "luxia_tracked_trades_guest";

interface TrackedTrade extends Signal {
  trackedAt: number;
  outcome?: "hit" | "missed";
}

interface ChatMsg {
  id: number;
  role: string;
  text: string;
}

function formatPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TrackingPage() {
  const { user } = useAuth();
  const storageKey = user.role === "guest" ? GUEST_TRACKED_KEY : TRACKED_KEY;
  const [trades, setTrades] = useState<TrackedTrade[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    {},
  );
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(true);

  const [aiMonitoring, setAiMonitoring] = useState<Record<string, string>>({});
  const [aiMonitorTime, setAiMonitorTime] = useState<Record<string, number>>(
    {},
  );
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  const [chatOpen, setChatOpen] = useState<Record<string, boolean>>({});
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMsg[]>>(
    {},
  );
  const [chatInput, setChatInput] = useState<Record<string, string>>({});
  const [chatSending, setChatSending] = useState<Record<string, boolean>>({});
  const msgIdRef = useRef(0);
  const prevTpRef = useRef<Record<string, number>>({});
  const [tpUpdated, setTpUpdated] = useState<
    Record<string, "up" | "down" | null>
  >({});

  const [learningStats, setLearningStats] = useState(getLearningStats);

  // Persist helper — saves to localStorage + backend
  const persistTrades = useCallback(
    (updated: TrackedTrade[]) => {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      if (user.role !== "guest") {
        saveTrackedTradesToBackend(user.uid, JSON.stringify(updated));
      }
    },
    [storageKey, user.role, user.uid],
  );

  // Load trades on mount: backend first, fallback to localStorage
  useEffect(() => {
    async function load() {
      setLoadingTrades(true);
      let raw = "";
      if (user.role === "guest") {
        raw = localStorage.getItem(GUEST_TRACKED_KEY) || "";
      } else {
        // Try backend first
        raw = await loadTrackedTradesFromBackend(user.uid);
        if (!raw) {
          raw = localStorage.getItem(TRACKED_KEY) || "";
        }
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as TrackedTrade[];
          const normalized = parsed.map((t) => ({
            ...t,
            trackedAt: t.trackedAt ?? t.timestamp,
          }));
          setTrades(normalized);
          const prices: Record<string, number> = {};
          for (const t of normalized) prices[t.id] = t.currentPrice;
          setCurrentPrices(prices);
        } catch {
          setTrades([]);
        }
      }
      setLoadingTrades(false);
    }
    load();
  }, [user.uid, user.role]);

  // Live price updates — fetch real prices from CoinGecko every 60 seconds
  useEffect(() => {
    if (trades.length === 0) return;
    const fetchPrices = async () => {
      const coinIds = [...new Set(trades.map((t) => t.coinId))].filter(Boolean);
      if (coinIds.length === 0) return;
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const data = await res.json();

        setCurrentPrices((prev) => {
          const updated = { ...prev };
          for (const trade of trades) {
            const rp = data[trade.coinId]?.usd;
            if (rp) updated[trade.id] = rp;
          }
          return updated;
        });

        // TP change detection — notify user when TP shifts
        for (const trade of trades) {
          if (trade.outcome) continue;
          const prevTp = prevTpRef.current[trade.id];
          const currentTp = trade.takeProfit;
          if (
            prevTp !== undefined &&
            Math.abs(currentTp - prevTp) / (prevTp || 1) > 0.001
          ) {
            const newProfitPct = (
              ((currentTp - trade.entryPrice) / trade.entryPrice) *
              100
            ).toFixed(2);
            if (currentTp > prevTp) {
              toast.success(
                `📈 TP raised on ${trade.symbol}: now +${newProfitPct}% — more profit!`,
                {
                  duration: 5000,
                  style: {
                    background: "#C9A84C",
                    color: "#0A1628",
                    fontWeight: "bold",
                  },
                },
              );
              setTpUpdated((prev) => ({ ...prev, [trade.id]: "up" }));
            } else {
              toast.warning(
                `⚠️ TP adjusted on ${trade.symbol}: pulling back to safer target`,
                { duration: 5000 },
              );
              setTpUpdated((prev) => ({ ...prev, [trade.id]: "down" }));
            }
            setTimeout(() => {
              setTpUpdated((prev) => ({ ...prev, [trade.id]: null }));
            }, 3000);
          }
          prevTpRef.current[trade.id] = currentTp;
        }

        setTrades((prevTrades) => {
          let changed = false;
          const updated = prevTrades.map((trade) => {
            if (trade.outcome) return trade;
            const rp = data[trade.coinId]?.usd;
            if (!rp) return trade;
            const isLong = trade.direction === "LONG";
            const slHit = isLong ? rp <= trade.stopLoss : rp >= trade.stopLoss;
            if (slHit) {
              changed = true;
              recordOutcome({
                id: trade.id,
                symbol: trade.symbol,
                direction: trade.direction,
                confidence: trade.confidence,
                tpProbability: trade.tpProbability,
                outcome: "missed",
                timestamp: Date.now(),
                entryPrice: trade.entryPrice,
                stopLoss: trade.stopLoss,
              });
              toast.error(
                `⚠️ ${trade.symbol} hit SL — marked as loss. AI analyzing...`,
                { duration: 5000 },
              );
              return { ...trade, outcome: "missed" as const };
            }
            return trade;
          });
          if (changed) {
            persistTrades(updated);
            return updated;
          }
          return prevTrades;
        });
      } catch {
        /* keep existing prices */
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [trades, persistTrades]);

  const runAiMonitoring = useCallback(
    async (tradesArr: TrackedTrade[], prices: Record<string, number>) => {
      for (const trade of tradesArr) {
        if (trade.outcome) continue;
        const currentPrice = prices[trade.id] ?? trade.currentPrice;
        const isLong = trade.direction === "LONG";
        const progressPct = isLong
          ? Math.min(
              100,
              Math.max(
                0,
                ((currentPrice - trade.entryPrice) /
                  (trade.takeProfit - trade.entryPrice || 1)) *
                  100,
              ),
            )
          : Math.min(
              100,
              Math.max(
                0,
                ((trade.entryPrice - currentPrice) /
                  (trade.entryPrice - trade.takeProfit || 1)) *
                  100,
              ),
            );
        const elapsedHours =
          (Date.now() - (trade.trackedAt ?? trade.timestamp)) / 3600000;
        setAiLoading((prev) => ({ ...prev, [trade.id]: true }));
        const analysis = await analyzeTrackedTrade(
          trade.symbol,
          trade.direction,
          trade.entryPrice,
          currentPrice,
          trade.takeProfit,
          trade.stopLoss,
          progressPct,
          elapsedHours,
          trade.strengthLabel,
        );
        setAiMonitoring((prev) => ({ ...prev, [trade.id]: analysis }));
        setAiMonitorTime((prev) => ({ ...prev, [trade.id]: Date.now() }));
        setAiLoading((prev) => ({ ...prev, [trade.id]: false }));
      }
    },
    [],
  );

  useEffect(() => {
    if (trades.length === 0) return;
    runAiMonitoring(trades, currentPrices);
    const interval = setInterval(
      () => runAiMonitoring(trades, currentPrices),
      60000,
    );
    return () => clearInterval(interval);
  }, [trades, currentPrices, runAiMonitoring]);

  const removeTrade = (id: string) => {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    persistTrades(updated);
    toast.success("Trade removed");
  };

  const markOutcome = (id: string, outcome: "hit" | "missed") => {
    const trade = trades.find((t) => t.id === id);
    if (trade) {
      recordOutcome({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        confidence: trade.confidence,
        tpProbability: trade.tpProbability,
        outcome,
        timestamp: Date.now(),
      });
      setLearningStats(getLearningStats());
    }
    const updated = trades.map((t) => (t.id === id ? { ...t, outcome } : t));
    setTrades(updated);
    persistTrades(updated);
    toast.success(
      outcome === "hit"
        ? "Marked as profit taken! 🎉 AI is learning from this."
        : "Marked as missed. AI will improve signals.",
    );
  };

  const openModal = (signal: Signal) => {
    setSelectedSignal(signal);
    setModalOpen(true);
  };

  const toggleChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendChatMessage = async (
    trade: TrackedTrade,
    currentPrice: number,
    e: React.FormEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const msg = (chatInput[trade.id] || "").trim();
    if (!msg || chatSending[trade.id]) return;
    setChatInput((prev) => ({ ...prev, [trade.id]: "" }));
    setChatSending((prev) => ({ ...prev, [trade.id]: true }));
    const userMsg: ChatMsg = {
      id: ++msgIdRef.current,
      role: "user",
      text: msg,
    };
    setChatMessages((prev) => ({
      ...prev,
      [trade.id]: [...(prev[trade.id] || []), userMsg],
    }));
    const tradeCtx = `Tracked trade: ${trade.symbol} ${trade.direction}, Entry $${trade.entryPrice.toFixed(6)}, Current $${currentPrice.toFixed(6)}, TP $${trade.takeProfit.toFixed(6)}, SL $${trade.stopLoss.toFixed(6)}, Confidence ${trade.confidence}%.`;
    const history = (chatMessages[trade.id] || [])
      .slice(-4)
      .map(({ role, text }) => ({ role, text }));
    let reply = `Based on the ${trade.symbol} trade data: entry at ${formatPrice(trade.entryPrice)}, current price ${formatPrice(currentPrice)}. Monitor price action and consider the SL at ${formatPrice(trade.stopLoss)} as your risk boundary.`;
    try {
      reply = await chatWithAI(tradeCtx, msg, history);
    } catch {
      // fallback reply stays
    }
    const displayReply =
      reply &&
      reply.trim() !== "" &&
      !reply.toLowerCase().startsWith("error:") &&
      !reply.toLowerCase().includes("ai unavailable")
        ? reply
        : `For ${trade.symbol}: Entry ${formatPrice(trade.entryPrice)}, TP ${formatPrice(trade.takeProfit)}, SL ${formatPrice(trade.stopLoss)}. Monitor momentum carefully and exit near TP target.`;
    setChatMessages((prev) => ({
      ...prev,
      [trade.id]: [
        ...(prev[trade.id] || []),
        { id: ++msgIdRef.current, role: "ai", text: displayReply },
      ],
    }));
    setChatSending((prev) => ({ ...prev, [trade.id]: false }));
  };

  return (
    <div className="min-h-screen bg-white py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[#0A1628] font-bold text-2xl mb-1">
            📊 Tracking
          </h1>
          <p className="text-[#0A1628]/50 text-sm">
            Your manually tracked trades — AI monitored live
          </p>
        </motion.div>

        {/* AI Learning Stats Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 bg-gradient-to-r from-[#0A1628]/5 to-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
            <span className="text-xs font-bold text-[#0A1628] uppercase tracking-wider">
              AI Learning Engine
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-[#0A1628]">
                {learningStats.totalTrades}
              </div>
              <div className="text-[10px] text-gray-400 uppercase">
                Trades Learned
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {(learningStats.hitRate * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-gray-400 uppercase">
                Hit Rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[#C9A84C]">
                {learningStats.learningScore.toFixed(0)}
              </div>
              <div className="text-[10px] text-gray-400 uppercase">
                Learning Score
              </div>
            </div>
          </div>
          {learningStats.improvements[0] && (
            <div className="mt-2 text-xs text-[#0A1628]/60 italic">
              💡 {learningStats.improvements[0]}
            </div>
          )}
        </motion.div>

        {loadingTrades ? (
          <div
            data-ocid="tracking.loading_state"
            className="text-center py-16 text-[#0A1628]/40"
          >
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <div className="text-sm">
              Loading your trades from permanent storage...
            </div>
          </div>
        ) : trades.length === 0 ? (
          <div
            data-ocid="tracking.empty_state"
            className="text-center py-16 text-[#0A1628]/40"
          >
            <div className="text-5xl mb-4">📈</div>
            <div className="font-medium text-lg mb-1">No tracked trades</div>
            <div className="text-sm">
              Tap &quot;Track Trade&quot; on any signal card to monitor it here
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            style={{ scrollbarWidth: "none" }}
          >
            <AnimatePresence>
              {trades.map((trade, i) => {
                const currentPrice =
                  currentPrices[trade.id] ?? trade.currentPrice;
                const isLong = trade.direction === "LONG";
                const progressPct = isLong
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((currentPrice - trade.entryPrice) /
                          (trade.takeProfit - trade.entryPrice || 1)) *
                          100,
                      ),
                    )
                  : Math.min(
                      100,
                      Math.max(
                        0,
                        ((trade.entryPrice - currentPrice) /
                          (trade.entryPrice - trade.takeProfit || 1)) *
                          100,
                      ),
                    );
                const tpReached = progressPct >= 100;
                const profitPct = isLong
                  ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
                  : ((trade.entryPrice - currentPrice) / trade.entryPrice) *
                    100;
                // Static TP profit (entry → TP)
                const tpProfitPct = isLong
                  ? ((trade.takeProfit - trade.entryPrice) / trade.entryPrice) *
                    100
                  : ((trade.entryPrice - trade.takeProfit) / trade.entryPrice) *
                    100;
                const dumpWarning =
                  isLong && currentPrice < trade.entryPrice * 0.995;
                const earlyDumpRisk =
                  isLong &&
                  currentPrice < trade.entryPrice * 1.003 &&
                  trade.strengthLabel !== "Strong" &&
                  !tpReached;
                const safeExit = isLong
                  ? trade.entryPrice + (currentPrice - trade.entryPrice) * 0.6
                  : trade.entryPrice - (trade.entryPrice - currentPrice) * 0.6;
                const nearTp = progressPct >= 70 && !tpReached;
                const elapsed =
                  Date.now() - (trade.trackedAt ?? trade.timestamp);
                const aiText = aiMonitoring[trade.id];
                const isAiLoading = aiLoading[trade.id];
                const lastMonitorTime = aiMonitorTime[trade.id];
                const isChatOpen = chatOpen[trade.id];
                const msgs = chatMessages[trade.id] || [];

                return (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    data-ocid={`tracking.item.${i + 1}`}
                    onClick={() => openModal(trade)}
                    onKeyDown={(e) => e.key === "Enter" && openModal(trade)}
                    tabIndex={0}
                    className="bg-white border border-gray-300 shadow-md rounded-2xl w-full cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {tpReached && !trade.outcome && (
                      <div className="bg-green-500 rounded-t-2xl p-3 text-center animate-pulse">
                        <div className="text-white font-bold text-sm">
                          🎯 PROFIT TAKEN +{profitPct.toFixed(1)}% Achieved
                        </div>
                      </div>
                    )}
                    {earlyDumpRisk && !dumpWarning && (
                      <div className="bg-orange-400 rounded-t-2xl p-2 text-center">
                        <div className="text-white text-xs font-semibold">
                          ⚠️ Caution — Momentum Weakening. Monitor closely.
                        </div>
                      </div>
                    )}
                    {dumpWarning && !tpReached && (
                      <div className="bg-red-500 rounded-t-2xl p-2 text-center">
                        <div className="text-white text-xs font-semibold">
                          ⚠️ Dump Warning — Safe Exit: {formatPrice(safeExit)}
                        </div>
                      </div>
                    )}
                    {tpUpdated[trade.id] && (
                      <div
                        className="animate-pulse px-4 py-1.5 text-center text-xs font-extrabold tracking-widest uppercase"
                        style={{
                          background:
                            tpUpdated[trade.id] === "up"
                              ? "#C9A84C"
                              : "#f97316",
                          color:
                            tpUpdated[trade.id] === "up" ? "#0A1628" : "white",
                        }}
                      >
                        {tpUpdated[trade.id] === "up"
                          ? "📈 TP UPDATED ↑ — More Profit!"
                          : "⚠️ TP UPDATED ↓ — Safer Target"}
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-[#0A1628] text-base">
                            {trade.symbol}
                          </div>
                          <div className="text-[#0A1628]/40 text-xs">
                            {formatElapsed(elapsed)} ago
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${
                            isLong
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-[10px] text-gray-400 uppercase">
                            Entry
                          </div>
                          <div className="font-semibold text-[#0A1628]">
                            {formatPrice(trade.entryPrice)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-[10px] text-gray-400 uppercase">
                            Current
                          </div>
                          <div
                            className={`font-semibold ${
                              profitPct >= 0 ? "text-green-600" : "text-red-500"
                            }`}
                          >
                            {formatPrice(currentPrice)}
                          </div>
                        </div>
                      </div>

                      {/* TP Profit Badge */}
                      <div
                        className="w-full text-center py-1.5 rounded-xl font-bold text-sm mb-3"
                        style={{
                          background: "rgba(201,168,76,0.12)",
                          border: "1px solid rgba(201,168,76,0.35)",
                          color: "#92700D",
                        }}
                      >
                        💰 +{tpProfitPct.toFixed(2)}% Profit if TP Hit
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress to TP</span>
                          <span
                            className={
                              profitPct >= 0 ? "text-green-600" : "text-red-500"
                            }
                          >
                            {profitPct >= 0 ? "+" : ""}
                            {profitPct.toFixed(2)}%
                          </span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>{formatPrice(trade.entryPrice)}</span>
                          <span>{formatPrice(trade.takeProfit)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mb-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            trade.strengthLabel === "Strong"
                              ? "bg-green-50 text-green-700"
                              : trade.strengthLabel === "Weakening"
                                ? "bg-yellow-50 text-yellow-600"
                                : "bg-red-50 text-red-600"
                          }`}
                        >
                          ● {trade.strengthLabel}
                        </span>
                        <span className="text-gray-400">
                          Safe:{" "}
                          <span className="text-amber-600 font-semibold">
                            {formatPrice(safeExit)}
                          </span>
                        </span>
                      </div>

                      {nearTp && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center mb-3 animate-pulse">
                          <span className="text-green-700 font-bold text-xs">
                            🚀 Take Profit Now!
                          </span>
                        </div>
                      )}

                      {/* AI Live Monitoring Panel */}
                      <div
                        className="bg-gradient-to-r from-[#0A1628]/5 to-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl p-3 mb-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAiLoading
                                ? "bg-yellow-400 animate-spin"
                                : "bg-[#C9A84C] animate-pulse"
                            }`}
                          />
                          <span className="text-[10px] font-bold text-[#0A1628] uppercase tracking-wider">
                            AI Monitor
                          </span>
                          {lastMonitorTime && (
                            <span className="text-[9px] text-gray-400 ml-auto">
                              {new Date(lastMonitorTime).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        {isAiLoading ? (
                          <div className="text-[10px] text-gray-400 italic animate-pulse">
                            Analyzing trade conditions...
                          </div>
                        ) : aiText ? (
                          <div className="text-[11px] text-[#0A1628]/80 leading-relaxed">
                            {aiText}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 italic">
                            AI analysis loading...
                          </div>
                        )}
                      </div>

                      {/* AI Chat Toggle */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          data-ocid={`tracking.toggle.${i + 1}`}
                          className="w-full text-xs text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg py-1.5 mb-2 hover:bg-[#C9A84C]/5 transition-colors font-semibold"
                          onClick={(e) => toggleChat(trade.id, e)}
                        >
                          {isChatOpen
                            ? "✕ Close AI Chat"
                            : "💬 Ask AI About This Trade"}
                        </button>

                        <AnimatePresence>
                          {isChatOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-[#C9A84C]/20 pt-2"
                            >
                              <div className="h-28 overflow-y-auto mb-2 space-y-2">
                                {msgs.length === 0 && (
                                  <div className="text-[11px] text-gray-400 italic p-2">
                                    Ask anything about this tracked trade...
                                  </div>
                                )}
                                {msgs.map((m) => (
                                  <div
                                    key={m.id}
                                    className={`rounded-lg px-2.5 py-1.5 text-xs ${
                                      m.role === "user"
                                        ? "bg-[#0A1628]/8 text-[#0A1628]"
                                        : "bg-[#C9A84C]/10 text-[#0A1628]"
                                    }`}
                                  >
                                    <span className="font-semibold">
                                      {m.role === "user" ? "You" : "Luxia AI"}:{" "}
                                    </span>
                                    {m.text}
                                  </div>
                                ))}
                              </div>
                              <form
                                onSubmit={(e) =>
                                  sendChatMessage(trade, currentPrice, e)
                                }
                                className="flex gap-1.5"
                              >
                                <input
                                  type="text"
                                  data-ocid={`tracking.input.${i + 1}`}
                                  value={chatInput[trade.id] || ""}
                                  onChange={(e) =>
                                    setChatInput((prev) => ({
                                      ...prev,
                                      [trade.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Ask about this trade..."
                                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                                />
                                <button
                                  type="submit"
                                  data-ocid={`tracking.submit_button.${i + 1}`}
                                  disabled={chatSending[trade.id]}
                                  className="text-xs bg-[#0A1628] text-white rounded-lg px-3 py-1.5 hover:bg-[#0A1628]/80 disabled:opacity-50"
                                >
                                  {chatSending[trade.id] ? "..." : "Send"}
                                </button>
                              </form>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {tpReached && !trade.outcome ? (
                        <div
                          className="flex gap-2 mt-2"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            data-ocid={`tracking.hit_button.${i + 1}`}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markOutcome(trade.id, "hit");
                            }}
                          >
                            Mark as Hit
                          </Button>
                          <Button
                            size="sm"
                            data-ocid={`tracking.missed_button.${i + 1}`}
                            variant="outline"
                            className="flex-1 border-red-400 text-red-500 text-xs hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              markOutcome(trade.id, "missed");
                            }}
                          >
                            Mark as Missed
                          </Button>
                        </div>
                      ) : trade.outcome ? (
                        <div
                          className={`text-center py-1.5 rounded-lg text-xs font-bold mt-2 ${
                            trade.outcome === "hit"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {trade.outcome === "hit"
                            ? "✅ TP Hit"
                            : "❌ SL Hit — AI Learning"}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        data-ocid={`tracking.delete_button.${i + 1}`}
                        className="mt-2 w-full text-[10px] text-gray-300 hover:text-red-400 transition-colors text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrade(trade.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <TradeDetailModal
        signal={selectedSignal}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
