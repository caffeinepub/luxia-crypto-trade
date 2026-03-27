import type { Signal } from "../data/mockData";

interface Props {
  signal: Signal;
}

export default function SignalCard({ signal }: Props) {
  const actionColors = {
    BUY: {
      bg: "bg-[#16A34A]/10",
      text: "text-[#15803D]",
      border: "border-[#16A34A]/25",
    },
    SELL: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
    HOLD: {
      bg: "bg-[#C9A84C]/10",
      text: "text-[#92700D]",
      border: "border-[#C9A84C]/30",
    },
  };

  const statusColors = {
    ACTIVE: "badge-active",
    PROFITABLE: "badge-profitable",
    CLOSED: "badge-closed",
    LOSS: "badge-loss",
  };

  const ac = actionColors[signal.action];

  return (
    <div className="luxury-card rounded-2xl p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${ac.bg} ${ac.text} ${ac.border}`}
          >
            {signal.action}
          </span>
          <span className="text-[#0A1628] font-bold">{signal.pair}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${statusColors[signal.status]}`}
          >
            {signal.status}
          </span>
          <span className="text-[#B8902A] font-bold text-sm">
            {signal.confidence}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0A1628]/4 rounded-lg p-2">
          <div className="text-[9px] text-[#0A1628]/50 uppercase tracking-wider">
            Entry
          </div>
          <div className="text-[#0A1628] font-semibold text-xs">
            ${signal.entryPrice.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#16A34A]/8 rounded-lg p-2">
          <div className="text-[9px] text-[#0A1628]/50 uppercase tracking-wider">
            Take Profit
          </div>
          <div className="text-[#15803D] font-semibold text-xs">
            ${signal.takeProfit.toLocaleString()}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-[9px] text-[#0A1628]/50 uppercase tracking-wider">
            Stop Loss
          </div>
          <div className="text-red-600 font-semibold text-xs">
            ${signal.stopLoss.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
