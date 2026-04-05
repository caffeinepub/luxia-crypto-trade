import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BotMessage,
  clearHistory,
  getBotResponse,
  getConversationStarter,
  getUserBotResponse,
} from "../services/aiBotChat";

const BOT_CONFIG = {
  alpha: {
    name: "Alpha Bot",
    role: "Momentum & TP Analyst",
    avatar: "A",
    color: "from-blue-600 to-blue-400",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    badgeColor: "bg-blue-100 text-blue-700",
    dotColor: "bg-blue-500",
  },
  beta: {
    name: "Beta Bot",
    role: "Risk & Dump Prevention",
    avatar: "B",
    color: "from-emerald-600 to-emerald-400",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    badgeColor: "bg-emerald-100 text-emerald-700",
    dotColor: "bg-emerald-500",
  },
  researcher: {
    name: "Researcher Bot",
    role: "Deep Market Analysis",
    avatar: "R",
    color: "from-purple-600 to-purple-400",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    badgeColor: "bg-purple-100 text-purple-700",
    dotColor: "bg-purple-500",
  },
  user: {
    name: "You",
    role: "Trader",
    avatar: "U",
    color: "from-[#C9A84C] to-[#E8C97A]",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    badgeColor: "bg-amber-100 text-amber-700",
    dotColor: "bg-amber-500",
  },
};

const INSIGHT_KEYWORDS = [
  "RSI",
  "MACD",
  "momentum",
  "TP",
  "ATR",
  "volume",
  "profit",
  "risk",
];

const QUICK_QUESTIONS = [
  "Which signals are most likely to hit TP today?",
  "How do I pick the highest profit trade?",
  "What RSI range should I look for?",
  "How do I avoid dump signals?",
  "What's the best time to enter a trade?",
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isRunning, setIsRunning] = useState(true);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [researcherActive, setResearcherActive] = useState(false);
  const [targetBot, setTargetBot] = useState<"alpha" | "beta" | "researcher">(
    "alpha",
  );
  const [sessionInsights, setSessionInsights] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(true);
  const isBotThinkingRef = useRef(false);
  const turnRef = useRef<"alpha" | "beta" | "researcher">("beta");

  const addMessage = useCallback(
    (botId: BotMessage["botId"], content: string) => {
      const cfg = BOT_CONFIG[botId];
      const msg: BotMessage = {
        id: `${botId}-${Date.now()}-${Math.random()}`,
        botId,
        botName: cfg.name,
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
    },
    [],
  );

  const extractInsight = useCallback((content: string): string | null => {
    const sentences = content
      .split(".")
      .filter((s) => INSIGHT_KEYWORDS.some((k) => s.includes(k)));
    return sentences[0] ? `${sentences[0].trim()}.` : null;
  }, []);

  const runBotTurn = useCallback(async () => {
    if (isBotThinkingRef.current) return;
    if (!isRunningRef.current) return;

    isBotThinkingRef.current = true;
    setIsBotThinking(true);

    try {
      // Read last message from ref to avoid stale closure
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (!lastMsg || lastMsg.botId === "user" || lastMsg.isThinking) {
          isBotThinkingRef.current = false;
          setIsBotThinking(false);
          return prev;
        }
        return prev;
      });

      // Get last message outside setState to call async function
    } catch {
      isBotThinkingRef.current = false;
      setIsBotThinking(false);
    }

    // We need a separate read
    setMessages((current) => {
      const lastMsg = current[current.length - 1];
      if (!lastMsg || lastMsg.botId === "user") {
        isBotThinkingRef.current = false;
        setIsBotThinking(false);
        return current;
      }

      const respondingBot = turnRef.current;
      if (researcherActive) {
        const order: Array<"alpha" | "beta" | "researcher"> = [
          "beta",
          "researcher",
          "alpha",
        ];
        const idx = order.indexOf(respondingBot);
        turnRef.current = order[(idx + 1) % order.length];
      } else {
        turnRef.current = respondingBot === "alpha" ? "beta" : "alpha";
      }

      getBotResponse(respondingBot, lastMsg.content)
        .then((response) => {
          addMessage(respondingBot, response);
          const insight = extractInsight(response);
          if (insight) {
            setSessionInsights((prev) => [insight, ...prev].slice(0, 8));
          }
        })
        .catch(() => {
          // Bot couldn't respond this round
        })
        .finally(() => {
          isBotThinkingRef.current = false;
          setIsBotThinking(false);
        });

      return current;
    });
  }, [researcherActive, addMessage, extractInsight]);

  // Start conversation on mount
  useEffect(() => {
    const starter = getConversationStarter();
    addMessage("alpha", starter);
    turnRef.current = "beta";
  }, [addMessage]);

  // Sync running state to ref
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Auto-run conversation interval
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (!isBotThinkingRef.current && isRunningRef.current) {
        runBotTurn();
      }
    }, 35000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, runBotTurn]);

  // Auto-trigger bot response when a new non-user message arrives
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.isThinking || last.botId === "user") return;

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    if (!isRunningRef.current || isBotThinkingRef.current) return;

    const timer = setTimeout(() => {
      if (isRunningRef.current && !isBotThinkingRef.current) {
        runBotTurn();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [messages, runBotTurn]);

  const handleSendMessage = async () => {
    const trimmed = userInput.trim();
    if (!trimmed || isBotThinking) return;
    setUserInput("");
    addMessage("user", trimmed);
    setIsBotThinking(true);
    isBotThinkingRef.current = true;

    try {
      const botToAsk =
        !researcherActive && targetBot === "researcher" ? "alpha" : targetBot;
      const response = await getUserBotResponse(trimmed, botToAsk);
      addMessage(botToAsk, response);

      setTimeout(() => {
        const otherBot =
          botToAsk === "alpha"
            ? "beta"
            : botToAsk === "beta"
              ? "alpha"
              : "beta";
        turnRef.current = otherBot;
        if (isRunningRef.current && !isBotThinkingRef.current) {
          runBotTurn();
        }
      }, 4000);
    } catch {
      addMessage(targetBot, "I'm processing... please ask again in a moment.");
    } finally {
      setIsBotThinking(false);
      isBotThinkingRef.current = false;
    }
  };

  const handleReset = () => {
    clearHistory();
    setMessages([]);
    setSessionInsights([]);
    turnRef.current = "beta";
    const starter = getConversationStarter();
    setTimeout(() => addMessage("alpha", starter), 500);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #14243e 100%)",
          borderBottom: "2px solid rgba(201,168,76,0.4)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)",
                boxShadow: "0 4px 12px rgba(201,168,76,0.4)",
              }}
            >
              <span className="text-[#0A1628] font-bold text-lg">AI</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight">
                AI Trading Bots
              </h1>
              <p className="text-white/50 text-xs">
                Alpha &amp; Beta continuously research to improve signal
                accuracy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isRunning
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-white/20 text-white/60 hover:bg-white/30"
              }`}
            >
              {isRunning ? "Running" : "Paused"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white/60 hover:bg-white/20 transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Bot status cards */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {(["alpha", "beta"] as Array<"alpha" | "beta" | "researcher">)
            .concat(researcherActive ? ["researcher" as const] : [])
            .map((botId) => {
              const cfg = BOT_CONFIG[botId];
              return (
                <div
                  key={botId}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.08] border border-white/10 shrink-0"
                >
                  <div
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}
                  >
                    {cfg.avatar}
                  </div>
                  <div>
                    <div className="text-white text-xs font-semibold leading-tight">
                      {cfg.name}
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${isRunning ? cfg.dotColor : "bg-gray-400"} ${
                          isRunning ? "animate-pulse" : ""
                        }`}
                      />
                      <span className="text-white/40 text-[9px]">
                        {isRunning ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          {!researcherActive && (
            <button
              type="button"
              onClick={() => {
                setResearcherActive(true);
                addMessage(
                  "researcher",
                  "Researcher Bot joining the session. I'll be analyzing chart patterns, multi-timeframe confluence, and providing deeper market structure insights to help Alpha and Beta improve signal accuracy. What specific patterns should I focus on?",
                );
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-purple-400/50 text-purple-300 hover:bg-purple-500/10 transition-all shrink-0 text-xs font-semibold"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Researcher Bot</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 max-w-7xl mx-auto p-4">
        {/* Chat feed */}
        <div className="flex-1 min-w-0">
          <div
            className="space-y-3 mb-4 min-h-[300px] max-h-[55vh] overflow-y-auto pr-1"
            style={{ scrollbarWidth: "thin" }}
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const cfg = BOT_CONFIG[msg.botId];
                const isUser = msg.botId === "user";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-white font-bold text-sm shrink-0 mt-1`}
                    >
                      {cfg.avatar}
                    </div>
                    <div
                      className={`flex-1 max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
                    >
                      <div
                        className={`flex items-center gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <span
                          className={`text-xs font-bold ${isUser ? "text-amber-700" : cfg.textColor}`}
                        >
                          {cfg.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.badgeColor}`}
                        >
                          {cfg.role}
                        </span>
                        <span className="text-[10px] text-[#0A1628]/30">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border ${
                          isUser
                            ? "bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] text-[#0A1628] border-[#C9A84C]/30 rounded-tr-sm font-medium"
                            : `${cfg.bgColor} ${cfg.borderColor} ${cfg.textColor} rounded-tl-sm`
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isBotThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${BOT_CONFIG[turnRef.current].color} flex items-center justify-center text-white font-bold text-sm shrink-0 mt-1 animate-pulse`}
                >
                  {BOT_CONFIG[turnRef.current].avatar}
                </div>
                <div
                  className={`px-4 py-3 rounded-2xl rounded-tl-sm border ${BOT_CONFIG[turnRef.current].bgColor} ${BOT_CONFIG[turnRef.current].borderColor}`}
                >
                  <div className="flex items-center gap-1.5">
                    {["0ms", "150ms", "300ms"].map((delay) => (
                      <div
                        key={delay}
                        className={`w-2 h-2 rounded-full ${BOT_CONFIG[turnRef.current].dotColor} animate-bounce`}
                        style={{ animationDelay: delay }}
                      />
                    ))}
                    <span
                      className={`text-xs ${BOT_CONFIG[turnRef.current].textColor} ml-1`}
                    >
                      {BOT_CONFIG[turnRef.current].name} is analyzing...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          <div className="mb-3">
            <p className="text-[10px] text-[#0A1628]/40 uppercase tracking-wider mb-2">
              Quick Questions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setUserInput(q)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0A1628]/[0.05] text-[#0A1628]/60 hover:bg-[#C9A84C]/15 hover:text-[#C9A84C] transition-all border border-[#0A1628]/10 hover:border-[#C9A84C]/30"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="flex gap-2">
            <select
              value={targetBot}
              onChange={(e) =>
                setTargetBot(e.target.value as "alpha" | "beta" | "researcher")
              }
              className="px-3 py-2 rounded-xl border border-[#0A1628]/15 text-xs font-semibold text-[#0A1628] bg-white focus:outline-none focus:border-[#C9A84C] shrink-0"
            >
              <option value="alpha">Ask Alpha</option>
              <option value="beta">Ask Beta</option>
              {researcherActive && (
                <option value="researcher">Ask Researcher</option>
              )}
            </select>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSendMessage()
              }
              placeholder="Ask the AI bots about signals, profits, risk..."
              className="flex-1 px-4 py-2 rounded-xl border border-[#0A1628]/15 text-sm text-[#0A1628] placeholder:text-[#0A1628]/30 focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/30"
              disabled={isBotThinking}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isBotThinking || !userInput.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] font-bold text-sm disabled:opacity-40 hover:from-[#B8902A] hover:to-[#C9A84C] transition-all shrink-0"
            >
              Send
            </button>
          </div>
        </div>

        {/* Insights sidebar */}
        <div className="lg:w-64 mt-4 lg:mt-0 shrink-0">
          <div className="bg-[#0A1628]/[0.03] rounded-2xl border border-[#0A1628]/10 p-4">
            <h3 className="text-[#0A1628] font-bold text-sm mb-3 flex items-center gap-2">
              <span className="text-lg">&#128161;</span> Session Insights
            </h3>
            {sessionInsights.length === 0 ? (
              <p className="text-[#0A1628]/40 text-xs">
                Key trading insights from this session will appear here as the
                bots research and discuss...
              </p>
            ) : (
              <div className="space-y-2">
                {sessionInsights.map((insight, i) => (
                  <div
                    key={`${i}-${insight.slice(0, 20)}`}
                    className="px-3 py-2 bg-white rounded-xl border border-[#C9A84C]/20 text-xs text-[#0A1628]/70 leading-relaxed"
                  >
                    <span className="text-[#C9A84C] font-bold mr-1">
                      {i + 1}.
                    </span>
                    {insight}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#0A1628]/10">
              <p className="text-[10px] text-[#0A1628]/40 uppercase tracking-wider mb-2">
                Bot Status
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#0A1628]/60">
                    Auto-research
                  </span>
                  <span
                    className={`text-xs font-bold ${isRunning ? "text-emerald-600" : "text-[#0A1628]/40"}`}
                  >
                    {isRunning ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#0A1628]/60">Messages</span>
                  <span className="text-xs font-bold text-[#0A1628]">
                    {messages.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#0A1628]/60">Active bots</span>
                  <span className="text-xs font-bold text-[#0A1628]">
                    {researcherActive ? 3 : 2}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#0A1628]/10">
              <p className="text-[10px] text-[#0A1628]/40 uppercase tracking-wider mb-2">
                Research Goal
              </p>
              <p className="text-xs text-[#0A1628]/60 leading-relaxed">
                Bots continuously analyze signal patterns to maximize TP hit
                rate and identify the highest-profit trades for $10 spot
                trading. They self-improve with every exchange.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
