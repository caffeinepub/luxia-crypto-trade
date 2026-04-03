import {
  Activity,
  BarChart3,
  Crown,
  Rocket,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import ElitePage from "./ElitePage";
import SignalPage from "./SignalPage";

type SubTab =
  | "fast"
  | "tradeNow"
  | "active"
  | "highProfit"
  | "superHighProfit"
  | "elite";

interface TabDef {
  id: SubTab;
  label: string;
  emoji: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabDef[] = [
  { id: "active", label: "Active Signals", emoji: "📡", Icon: Activity },
  { id: "fast", label: "Fast Trade", emoji: "⚡", Icon: Zap },
  { id: "tradeNow", label: "Trade Now", emoji: "🎯", Icon: TrendingUp },
  { id: "highProfit", label: "High Profit", emoji: "💰", Icon: BarChart3 },
  { id: "superHighProfit", label: "Super High", emoji: "🚀", Icon: Rocket },
  { id: "elite", label: "Elite", emoji: "👑", Icon: Crown },
];

const SIGNAL_PAGE_CONFIG: Record<
  Exclude<SubTab, "elite">,
  {
    type: "fast" | "tradeNow" | "active" | "highProfit" | "superHighProfit";
    title: string;
    subtitle: string;
    icon: string;
  }
> = {
  fast: {
    type: "fast",
    title: "Fast Trade",
    subtitle: "Signals targeting TP within 6 hours",
    icon: "⚡",
  },
  tradeNow: {
    type: "tradeNow",
    title: "Trade Now",
    subtitle: "Enter immediately — price at entry now",
    icon: "🎯",
  },
  active: {
    type: "active",
    title: "Active Signals",
    subtitle: "All live signals passing filters",
    icon: "📡",
  },
  highProfit: {
    type: "highProfit",
    title: "High Profit Trade",
    subtitle: "2%–10% profit signals",
    icon: "💰",
  },
  superHighProfit: {
    type: "superHighProfit",
    title: "Super High Profit",
    subtitle: "10%+ profit breakout signals",
    icon: "🚀",
  },
};

export default function PremiumSignalsPage() {
  const [activeTab, setActiveTab] = useState<SubTab>("active");

  return (
    <div className="min-h-screen bg-white">
      {/* Page Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #14243e 100%)",
          borderBottom: "2px solid rgba(201,168,76,0.4)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)",
              boxShadow: "0 4px 12px rgba(201,168,76,0.4)",
            }}
          >
            <Crown size={20} className="text-[#0A1628]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight tracking-wide">
              Premium Signals
            </h1>
            <p className="text-white/50 text-xs">
              All signal sections — Fast Trade, Trade Now, Active, High Profit,
              Super High Profit &amp; Elite
            </p>
          </div>
        </div>

        {/* Horizontal pill-style sub-tabs */}
        <div
          className="overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-2 min-w-max">
            {TABS.map(({ id, label, emoji }) => {
              const active = activeTab === id;
              const isElite = id === "elite";
              return (
                <button
                  key={id}
                  type="button"
                  data-ocid={`premium.${id}.tab`}
                  onClick={() => setActiveTab(id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all whitespace-nowrap"
                  style={{
                    background: active
                      ? isElite
                        ? "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)"
                        : "#ffffff"
                      : "rgba(255,255,255,0.08)",
                    color: active
                      ? isElite
                        ? "#0A1628"
                        : "#0A1628"
                      : isElite
                        ? "#C9A84C"
                        : "rgba(255,255,255,0.7)",
                    border: active
                      ? "none"
                      : isElite
                        ? "1px solid rgba(201,168,76,0.5)"
                        : "1px solid rgba(255,255,255,0.12)",
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === "elite" ? (
          <ElitePage />
        ) : (
          <SignalPage
            key={activeTab}
            type={SIGNAL_PAGE_CONFIG[activeTab].type}
            title={SIGNAL_PAGE_CONFIG[activeTab].title}
            subtitle={SIGNAL_PAGE_CONFIG[activeTab].subtitle}
            icon={SIGNAL_PAGE_CONFIG[activeTab].icon}
          />
        )}
      </div>
    </div>
  );
}
