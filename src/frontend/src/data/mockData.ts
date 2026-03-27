export interface Signal {
  id: number;
  pair: string;
  action: "BUY" | "SELL" | "HOLD";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  status: "ACTIVE" | "PROFITABLE" | "CLOSED" | "LOSS";
  comment: string;
  timestamp: number;
}

export interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  timestamp: number;
}

export interface PerformanceStat {
  totalSignals: number;
  winRate: number;
  avgProfit: number;
  monthlyReturns: number;
  totalProfit: number;
}

export const mockSignals: Signal[] = [
  {
    id: 1,
    pair: "BTC/USD",
    action: "BUY",
    entryPrice: 67500,
    stopLoss: 65000,
    takeProfit: 72000,
    confidence: 94,
    status: "ACTIVE",
    comment: "Strong bullish momentum with institutional accumulation signals",
    timestamp: Date.now() - 3600000,
  },
  {
    id: 2,
    pair: "ETH/USD",
    action: "SELL",
    entryPrice: 3850,
    stopLoss: 4100,
    takeProfit: 3400,
    confidence: 87,
    status: "PROFITABLE",
    comment: "Overbought RSI with bearish divergence on 4H chart",
    timestamp: Date.now() - 7200000,
  },
  {
    id: 3,
    pair: "SOL/USD",
    action: "HOLD",
    entryPrice: 185,
    stopLoss: 170,
    takeProfit: 210,
    confidence: 78,
    status: "ACTIVE",
    comment: "Consolidating at key support — wait for breakout confirmation",
    timestamp: Date.now() - 10800000,
  },
  {
    id: 4,
    pair: "BTC/USD",
    action: "BUY",
    entryPrice: 65200,
    stopLoss: 62500,
    takeProfit: 70000,
    confidence: 91,
    status: "PROFITABLE",
    comment: "Golden cross on daily with high volume confirmation",
    timestamp: Date.now() - 86400000,
  },
  {
    id: 5,
    pair: "ETH/USD",
    action: "BUY",
    entryPrice: 3550,
    stopLoss: 3300,
    takeProfit: 3900,
    confidence: 82,
    status: "CLOSED",
    comment: "Target reached successfully",
    timestamp: Date.now() - 172800000,
  },
  {
    id: 6,
    pair: "SOL/USD",
    action: "SELL",
    entryPrice: 198,
    stopLoss: 210,
    takeProfit: 170,
    confidence: 76,
    status: "LOSS",
    comment: "Unexpected whale accumulation reversed signal",
    timestamp: Date.now() - 259200000,
  },
];

export const mockArticles: Article[] = [
  {
    id: 1,
    title: "Bitcoin Surges Past $67K as Institutional Demand Peaks",
    summary:
      "Major institutional players are accumulating BTC at an unprecedented rate, pushing prices toward the $70K resistance zone.",
    content: "",
    imageUrl: "",
    category: "Analysis",
    timestamp: Date.now() - 1800000,
  },
  {
    id: 2,
    title: "Ethereum's Layer 2 Ecosystem Reaches New Milestones",
    summary:
      "L2 networks collectively process more transactions than Ethereum mainnet as adoption accelerates across DeFi platforms.",
    content: "",
    imageUrl: "",
    category: "News",
    timestamp: Date.now() - 3600000,
  },
  {
    id: 3,
    title: "Solana DEX Volume Hits All-Time High",
    summary:
      "Decentralized exchanges on Solana surpass $5B in daily trading volume, challenging Ethereum's DeFi dominance.",
    content: "",
    imageUrl: "",
    category: "Update",
    timestamp: Date.now() - 7200000,
  },
  {
    id: 4,
    title: "Fed Rate Decision: Impact on Crypto Markets Analyzed",
    summary:
      "Luxia analysts break down how the Federal Reserve's latest policy shift affects risk-on assets including Bitcoin and altcoins.",
    content: "",
    imageUrl: "",
    category: "Analysis",
    timestamp: Date.now() - 14400000,
  },
  {
    id: 5,
    title: "Understanding On-Chain Metrics for Better Trade Signals",
    summary:
      "A deep dive into MVRV ratio, NVT, and exchange flows — the indicators Luxia AI uses to generate high-accuracy signals.",
    content: "",
    imageUrl: "",
    category: "Education",
    timestamp: Date.now() - 28800000,
  },
  {
    id: 6,
    title: "Trezaria International Launches Premium Signal Tier",
    summary:
      "Luxia Crypto Trade introduces institutional-grade signals with 95%+ accuracy for verified premium subscribers.",
    content: "",
    imageUrl: "",
    category: "Update",
    timestamp: Date.now() - 43200000,
  },
];

export const mockStats: PerformanceStat = {
  totalSignals: 248,
  winRate: 87.5,
  avgProfit: 14.3,
  monthlyReturns: 38.2,
  totalProfit: 312.4,
};

export const mockUsers = [
  {
    id: 1,
    name: "Alex Morrison",
    role: "Premium",
    status: "Active",
    joined: "Jan 2024",
    portfolio: "$124,500",
  },
  {
    id: 2,
    name: "Sarah Chen",
    role: "Premium",
    status: "Active",
    joined: "Feb 2024",
    portfolio: "$89,200",
  },
  {
    id: 3,
    name: "Marcus Webb",
    role: "Standard",
    status: "Active",
    joined: "Mar 2024",
    portfolio: "$45,800",
  },
  {
    id: 4,
    name: "Priya Patel",
    role: "Premium",
    status: "Inactive",
    joined: "Nov 2023",
    portfolio: "$220,000",
  },
  {
    id: 5,
    name: "James Liu",
    role: "Standard",
    status: "Active",
    joined: "Apr 2024",
    portfolio: "$31,500",
  },
];
