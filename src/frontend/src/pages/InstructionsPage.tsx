import {
  BarChart2,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type Tab = "howToTrade" | "thresholds" | "rules";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "howToTrade", label: "How to Trade", icon: <TrendingUp size={14} /> },
  {
    id: "thresholds",
    label: "Signal Thresholds",
    icon: <BarChart2 size={14} />,
  },
  { id: "rules", label: "Trading Rules", icon: <ShieldCheck size={14} /> },
];

const STEPS: { key: string; text: string }[] = [
  { key: "scan", text: "Wait for the scan to complete and signals to load." },
  {
    key: "confidence",
    text: "Look for signals with Confidence 88%+ and Surety Score 75+.",
  },
  {
    key: "badge",
    text: 'Check the "Guaranteed Hit" badge — these are the safest trades.',
  },
  {
    key: "speed",
    text: "Verify the coin is in ⚡ FAST or ⚡⚡ VERY FAST speed category.",
  },
  {
    key: "entry",
    text: "Enter at the shown Entry Price — do not chase the price higher.",
  },
  {
    key: "sl",
    text: "Set your Stop Loss exactly at the SL value shown — never skip SL.",
  },
  {
    key: "tp",
    text: "Set Take Profit at the TP value shown — let it run, don't close early.",
  },
  {
    key: "track",
    text: 'Click "Track Trade" to monitor the trade in the Tracking tab.',
  },
  {
    key: "exit",
    text: 'Exit immediately if a "Momentum Weakening" or "Dump Risk" warning appears.',
  },
  {
    key: "mark",
    text: "Mark Hit or Missed after the trade completes — this trains the AI.",
  },
];

type ThresholdLevel = {
  key: string;
  range: string;
  label: string;
  color: "green" | "amber" | "red";
};

const THRESHOLDS: {
  key: string;
  title: string;
  description: string;
  levels: ThresholdLevel[];
}[] = [
  {
    key: "confidence",
    title: "Confidence %",
    description: "How strongly all 6 indicators align. Higher = safer entry.",
    levels: [
      {
        key: "conf-95",
        range: "95–100%",
        label: "Extremely High — Best trades, take these first",
        color: "green",
      },
      {
        key: "conf-88",
        range: "88–94%",
        label: "High — Safe to trade",
        color: "green",
      },
      {
        key: "conf-75",
        range: "75–87%",
        label: "Medium — Trade with caution, smaller position",
        color: "amber",
      },
      {
        key: "conf-low",
        range: "Below 75%",
        label: "Low — Avoid or skip entirely",
        color: "red",
      },
    ],
  },
  {
    key: "probability",
    title: "Winning Probability %",
    description:
      "Geometric win probability calculated from signal math. This predicts TP hit rate.",
    levels: [
      {
        key: "prob-95",
        range: "95%+",
        label: "Guaranteed Hit tier — highest safety",
        color: "green",
      },
      {
        key: "prob-88",
        range: "88–94%",
        label: "High Probability — safe to enter",
        color: "green",
      },
      {
        key: "prob-75",
        range: "75–87%",
        label: "Moderate — risky, use tight SL",
        color: "amber",
      },
      {
        key: "prob-low",
        range: "Below 75%",
        label: "Skip — not worth the risk",
        color: "red",
      },
    ],
  },
  {
    key: "surety",
    title: "Surety Rate (Score 0–100)",
    description:
      "Combined score: TP probability + confidence + indicator alignment + momentum quality.",
    levels: [
      {
        key: "surety-85",
        range: "85–100",
        label: "Maximum surety — enter confidently",
        color: "green",
      },
      {
        key: "surety-70",
        range: "70–84",
        label: "High surety — good trade",
        color: "green",
      },
      {
        key: "surety-50",
        range: "50–69",
        label: "Moderate — wait for better signal",
        color: "amber",
      },
      {
        key: "surety-low",
        range: "Below 50",
        label: "Very uncertain — do not trade",
        color: "red",
      },
    ],
  },
];

const DO_RULES: { key: string; text: string }[] = [
  {
    key: "use-sl",
    text: "Always use the SL value shown — it protects you from big losses",
  },
  { key: "88-conf", text: "Only trade signals with 88%+ Confidence" },
  {
    key: "guaranteed-sort",
    text: 'Use "Guaranteed Hits First" sort to find the safest trades',
  },
  { key: "track-trade", text: "Track your trade immediately after entering" },
  {
    key: "dump-exit",
    text: "Exit if Dump Risk warning shows — the AI detected danger",
  },
  {
    key: "let-tp",
    text: "Wait for TP to be hit naturally — don't close early for small gains",
  },
  {
    key: "surety-sort",
    text: "Use the 🎯 Highest Surety sort to find the most certain trades",
  },
  {
    key: "mark-result",
    text: "Mark every trade Hit or Missed to improve the AI",
  },
];

const DONT_RULES: { key: string; text: string }[] = [
  { key: "no-75", text: "Never trade below 75% confidence" },
  {
    key: "no-skip-sl",
    text: "Never ignore the Stop Loss — it's there to protect you",
  },
  {
    key: "no-slow",
    text: "Never enter if the coin is 🐌 SLOW or 🐢 VERY SLOW and you want fast profit",
  },
  {
    key: "no-chase",
    text: "Never enter after the price has moved far above entry",
  },
  { key: "no-all-in", text: "Never trade all your capital on one signal" },
  {
    key: "no-skip-mark",
    text: "Never skip marking trade results — AI needs your feedback",
  },
  {
    key: "no-hold",
    text: "Never hold a trade if Momentum Weakening warning appears",
  },
  {
    key: "no-add",
    text: "Never add more money to a losing trade hoping it recovers",
  },
];

const LEGEND_ITEMS = [
  {
    key: "safe",
    label: "Safe to Trade",
    color: "bg-emerald-500",
    desc: "88%+ Confidence",
  },
  {
    key: "caution",
    label: "Use Caution",
    color: "bg-amber-500",
    desc: "75–87% Confidence",
  },
  {
    key: "avoid",
    label: "Do Not Trade",
    color: "bg-red-500",
    desc: "Below 75%",
  },
];

const SUMMARY_STATS = [
  { key: "min-conf", value: "88%+", label: "Min Confidence" },
  { key: "min-surety", value: "75+", label: "Min Surety Score" },
  { key: "guaranteed", value: "95%+", label: "Guaranteed Hit" },
];

const colorMap = {
  green: {
    border: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    label: "text-emerald-700",
  },
  amber: {
    border: "border-amber-500",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    label: "text-amber-700",
  },
  red: {
    border: "border-red-500",
    badge: "bg-red-100 text-red-600",
    dot: "bg-red-500",
    label: "text-red-600",
  },
};

function HowToTradeTab() {
  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-[#0A1628] font-bold text-lg mb-1">
          Step-by-Step Trading Guide
        </h2>
        <p className="text-[#0A1628]/60 text-sm">
          Follow every step in order for the highest chance of hitting TP
          without loss.
        </p>
      </div>
      {STEPS.map((step, i) => (
        <motion.div
          key={step.key}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-start gap-4 p-4 rounded-xl bg-white border border-[#0A1628]/10 shadow-sm hover:shadow-md hover:border-[#C9A84C]/40 transition-all"
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-[#0A1628] font-bold text-sm shadow-sm">
            {i + 1}
          </div>
          <p className="text-[#0A1628]/80 text-sm leading-relaxed pt-1">
            {step.text}
          </p>
        </motion.div>
      ))}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#1a2d4a] border border-[#C9A84C]/20">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-[#C9A84C]" />
          <span className="text-[#C9A84C] font-bold text-sm tracking-wide">
            PRO TIP
          </span>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">
          The AI learns from every trade you mark. The more you mark Hit/Missed,
          the smarter the signal engine becomes — reducing losses and increasing
          TP hit rate over time for all users.
        </p>
      </div>
    </div>
  );
}

function ThresholdsTab() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-[#0A1628] font-bold text-lg mb-1">
          Signal Quality Thresholds
        </h2>
        <p className="text-[#0A1628]/60 text-sm">
          Use these thresholds to evaluate each signal before entering a trade.
        </p>
      </div>
      {THRESHOLDS.map((block, bi) => (
        <motion.div
          key={block.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: bi * 0.1 }}
          className="rounded-xl border border-[#0A1628]/10 bg-white shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#0A1628]/8 bg-[#0A1628]/[0.02]">
            <h3 className="text-[#0A1628] font-bold text-base">
              {block.title}
            </h3>
            <p className="text-[#0A1628]/50 text-xs mt-0.5">
              {block.description}
            </p>
          </div>
          <div className="divide-y divide-[#0A1628]/6">
            {block.levels.map((lvl) => {
              const c = colorMap[lvl.color];
              return (
                <div
                  key={lvl.key}
                  className={`flex items-center gap-4 px-5 py-3.5 border-l-4 ${c.border}`}
                >
                  <div
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge} whitespace-nowrap`}
                  >
                    {lvl.range}
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-sm font-medium ${c.label}`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                    {lvl.label}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
      <div className="grid grid-cols-3 gap-3 mt-2">
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.key}
            className="rounded-lg p-3 bg-white border border-[#0A1628]/10 shadow-sm text-center"
          >
            <div
              className={`w-3 h-3 rounded-full ${item.color} mx-auto mb-2`}
            />
            <div className="text-[#0A1628] font-bold text-xs">{item.label}</div>
            <div className="text-[#0A1628]/50 text-[10px] mt-0.5">
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-[#0A1628] font-bold text-lg mb-1">Trading Rules</h2>
        <p className="text-[#0A1628]/60 text-sm">
          Follow the DO rules and avoid the DON'T rules to maximize TP hits and
          protect your capital.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DO column */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-200 bg-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-emerald-700 font-bold text-sm tracking-wide">
              DO — Follow These
            </span>
          </div>
          <ul className="divide-y divide-emerald-100">
            {DO_RULES.map((rule, i) => (
              <motion.li
                key={rule.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 + i * 0.04 }}
                className="flex items-start gap-3 px-4 py-3"
              >
                <CheckCircle2
                  size={14}
                  className="text-emerald-500 shrink-0 mt-0.5"
                />
                <span className="text-emerald-800 text-sm leading-relaxed">
                  {rule.text}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* DON'T column */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-red-200 bg-red-50 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-200 bg-red-100">
            <XCircle size={16} className="text-red-500" />
            <span className="text-red-600 font-bold text-sm tracking-wide">
              DON'T — Avoid These
            </span>
          </div>
          <ul className="divide-y divide-red-100">
            {DONT_RULES.map((rule, i) => (
              <motion.li
                key={rule.key}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.04 }}
                className="flex items-start gap-3 px-4 py-3"
              >
                <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <span className="text-red-800 text-sm leading-relaxed">
                  {rule.text}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-5 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#1a2d4a] border border-[#C9A84C]/20"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-[#C9A84C]" />
          <span className="text-[#C9A84C] font-bold text-sm tracking-widest uppercase">
            Zero Loss Strategy
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SUMMARY_STATS.map((stat) => (
            <div
              key={stat.key}
              className="text-center bg-white/[0.06] rounded-lg p-3"
            >
              <div className="text-[#C9A84C] font-bold text-lg leading-tight">
                {stat.value}
              </div>
              <div className="text-white/50 text-[10px] mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function InstructionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("howToTrade");

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#0A1628] to-[#1a2d4a] pt-8 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center shadow-lg">
              <BookOpen size={20} className="text-[#0A1628]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-wide">
                Trading Instructions
              </h1>
              <p className="text-white/50 text-xs">
                Master the signals. Trade without loss.
              </p>
            </div>
          </div>
        </div>

        {/* Three-tab pill navigation */}
        <div className="max-w-2xl mx-auto mt-5">
          <div className="flex gap-2 p-1 rounded-xl bg-white/[0.08] border border-white/10">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-ocid={`instructions.${tab.id}.tab`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                    active
                      ? "bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] shadow-md"
                      : "text-white/60 hover:text-white/90"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gold accent line */}
      <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-[#A07820]" />

      {/* Tab content */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "howToTrade" && <HowToTradeTab />}
            {activeTab === "thresholds" && <ThresholdsTab />}
            {activeTab === "rules" && <RulesTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 mt-10">
        <p className="text-center text-[10px] text-[#0A1628]/30">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#C9A84C] transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
