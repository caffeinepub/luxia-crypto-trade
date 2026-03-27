import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useCredits } from "../context/CreditContext";
import { chatWithAI } from "../services/gemini";
import type { Signal } from "../services/signalEngine";
import TradeDetailModal from "./TradeDetailModal";

interface ChatMsg {
  id: number;
  role: string;
  text: string;
}

interface Props {
  signal: Signal;
  index?: number;
}

const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  BNB: "#F0B90B",
  XRP: "#346AA9",
  ADA: "#0D1E2D",
  DOGE: "#BA9F33",
  AVAX: "#E84142",
  MATIC: "#8247E5",
  LINK: "#2A5ADA",
  default: "#0A1628",
};

function getCoinColor(symbol: string): string {
  const coin = symbol.split("-")[0];
  return COIN_COLORS[coin] || COIN_COLORS.default;
}

function formatPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(6)}`;
}

export default function LiveSignalCard({ signal, index = 0 }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const msgIdRef = useRef(0);
  const { spendCredit, isLocked } = useCredits();
  const { user } = useAuth();

  const storageKey =
    user.role === "guest"
      ? "luxia_tracked_trades_guest"
      : "luxia_tracked_trades";

  const color = getCoinColor(signal.symbol);
  const coinName = signal.symbol.split("-")[0];
  const isLong = signal.direction === "LONG";
  const tradeCtx = `Signal: ${signal.symbol} ${signal.direction} at ${signal.entryPrice}. TP: ${signal.takeProfit}, SL: ${signal.stopLoss}. Confidence: ${signal.confidence}%. ${signal.analysis}`;

  // Live price calculations
  const livePrice = signal.currentPrice ?? signal.entryPrice;
  const priceChange =
    ((livePrice - signal.entryPrice) / signal.entryPrice) * 100;
  const livePriceIsGood = isLong
    ? livePrice >= signal.entryPrice
    : livePrice <= signal.entryPrice;

  const handleTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) {
      toast.error("No credits remaining. Activate your account.");
      return;
    }
    const existing = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    ) as Signal[];
    const alreadyTracked = existing.some((s) => s.id === signal.id);
    if (alreadyTracked) {
      toast.info(`${signal.symbol} already tracked`);
      return;
    }
    existing.push(
      Object.assign({}, signal, {
        trackedAt: Date.now(),
        timestamp: Date.now(),
      }) as Signal,
    );
    localStorage.setItem(storageKey, JSON.stringify(existing));
    toast.success(`${signal.symbol} added to Tracking ✓`);
  };

  const handleCardClick = () => {
    if (isLocked) return;
    spendCredit();
    setModalOpen(true);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);
    const userMsgObj: ChatMsg = {
      id: ++msgIdRef.current,
      role: "user",
      text: userMsg,
    };
    setMessages((prev) => [...prev, userMsgObj]);
    const historyForAI = messages
      .slice(-4)
      .map(({ role, text }) => ({ role, text }));
    const reply = await chatWithAI(tradeCtx, userMsg, historyForAI);
    setMessages((prev) => [
      ...prev,
      { id: ++msgIdRef.current, role: "ai", text: reply },
    ]);
    setSending(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        data-ocid={`signal.item.${index + 1}`}
        onClick={handleCardClick}
        className="bg-white border border-gray-300 shadow-md rounded-2xl min-w-[320px] max-w-[360px] cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
      >
        {/* Card Header */}
        <div
          className="rounded-t-2xl p-4"
          style={{
            background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: color }}
              >
                {coinName.slice(0, 2)}
              </div>
              <div>
                <div className="font-bold text-[#0A1628] text-base leading-tight">
                  {coinName}
                  {signal.isTrending && (
                    <span className="ml-1 text-base">🔥</span>
                  )}
                </div>
                <div className="text-[#0A1628]/40 text-xs">{signal.symbol}</div>
              </div>
            </div>
            <Badge
              className={`text-white font-bold px-3 py-1 text-sm ${
                isLong
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {signal.direction}
            </Badge>
          </div>
        </div>

        {/* Live Price Bar — display only, stopPropagation via span wrapper */}
        <div className="mx-4 mb-1 mt-2">
          <span
            aria-label={`Live price ${formatPrice(livePrice)}`}
            className="rounded-xl px-3 py-2 flex items-center justify-between w-full"
            style={{
              background: livePriceIsGood ? "#f0fdf4" : "#fff1f2",
              border: `1px solid ${livePriceIsGood ? "#bbf7d0" : "#fecdd3"}`,
            }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse inline-block"
                style={{ background: livePriceIsGood ? "#16a34a" : "#dc2626" }}
              />
              <span className="text-[#B8902A] text-[9px] uppercase font-bold tracking-wider">
                Live Price
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className="font-bold text-sm"
                style={{ color: livePriceIsGood ? "#16a34a" : "#dc2626" }}
              >
                {formatPrice(livePrice)}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  priceChange >= 0
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </span>
          </span>
        </div>

        {/* Prices */}
        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-t border-gray-100 mt-1">
          <div className="text-center">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              Entry
            </div>
            <div className="text-xs font-semibold text-[#0A1628]">
              {formatPrice(signal.entryPrice)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-green-500 uppercase tracking-wider">
              TP
            </div>
            <div className="text-xs font-bold text-green-600">
              {formatPrice(signal.takeProfit)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-red-400 uppercase tracking-wider">
              SL
            </div>
            <div className="text-xs font-bold text-red-500">
              {formatPrice(signal.stopLoss)}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              signal.confidence >= 90
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {signal.confidence}% conf
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              signal.tpProbability >= 80
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {signal.tpProbability}% TP
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              signal.strengthLabel === "Strong"
                ? "bg-green-50 text-green-600"
                : signal.strengthLabel === "Weakening"
                  ? "bg-yellow-50 text-yellow-600"
                  : "bg-red-50 text-red-600"
            }`}
          >
            ● {signal.strengthLabel}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              signal.dumpRisk === "Low"
                ? "bg-gray-100 text-gray-600"
                : signal.dumpRisk === "Medium"
                  ? "bg-orange-100 text-orange-600"
                  : "bg-red-100 text-red-600"
            }`}
          >
            Dump: {signal.dumpRisk}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
            ~{signal.estimatedHours}h
          </span>
        </div>

        {/* Buttons */}
        <div className="px-4 pb-4 flex gap-2 mt-auto">
          <Button
            size="sm"
            variant="outline"
            data-ocid="signal.track_button"
            className="flex-1 text-xs border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10"
            onClick={handleTrack}
          >
            Track Trade
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-ocid="signal.chat_button"
            className="text-xs text-[#0A1628]/60 hover:text-[#0A1628]"
            onClick={(e) => {
              e.stopPropagation();
              setChatOpen((p) => !p);
            }}
          >
            AI Chat
          </Button>
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-100 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="h-28 overflow-y-auto mb-2 space-y-2 text-xs">
                  {messages.length === 0 && (
                    <div className="text-gray-400 italic">
                      Ask the AI about this trade...
                    </div>
                  )}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg p-2 ${
                        m.role === "user"
                          ? "bg-[#0A1628]/5 text-[#0A1628]"
                          : "bg-[#C9A84C]/10 text-[#0A1628]"
                      }`}
                    >
                      <span className="font-semibold">
                        {m.role === "user" ? "You" : "AI"}:{" "}
                      </span>
                      {m.text}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about this trade..."
                    data-ocid="signal.chat_input"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending}
                    className="text-xs bg-[#0A1628] text-white hover:bg-[#0A1628]/80"
                  >
                    {sending ? "..." : "Send"}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <TradeDetailModal
        signal={signal}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
