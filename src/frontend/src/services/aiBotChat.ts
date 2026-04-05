import { GROQ_API_KEY } from "./config";

export interface BotMessage {
  id: string;
  botId: "alpha" | "beta" | "researcher" | "omega" | "delta" | "sigma" | "user";
  botName: string;
  content: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface BoomCoin {
  symbol: string;
  name: string;
  change24h: number;
  volume24h: number;
  reason: string;
  timestamp: number;
  type: "100x" | "boom" | "gem";
}

export interface ResearchEntry {
  topic: string;
  botName: string;
  summary: string;
  timestamp: number;
}

export interface AIPost {
  id: string;
  heading: string;
  tagline: string;
  description: string;
  badge: "AI RESEARCH" | "100X CANDIDATE" | "GOING TO BOOM" | "GEM ALERT";
  date: string;
  timestamp: number;
}

// --- Topic rotation engine ---
const RESEARCH_TOPICS = [
  "Bitcoin dominance and altcoin rotation signals",
  "DeFi sector momentum and TVL growth leaders",
  "Layer 2 scaling solutions gaining traction",
  "Low-cap altcoins with 100x potential in current cycle",
  "Memecoin season indicators and breakout signals",
  "Whale wallet movements and large accumulation zones",
  "NFT market revival tokens and metaverse plays",
  "AI and blockchain convergence: top tokens",
  "RWA (Real World Assets) tokenization sector",
  "Gaming blockchain tokens showing momentum",
  "Stablecoin yield strategies and DeFi lending",
  "Cross-chain bridge tokens and interoperability plays",
  "Macro crypto correlation: Fed rates and BTC",
  "Emerging L1 blockchains challenging Ethereum",
  "DEX volume leaders and liquidity mining gems",
  "Crypto derivatives: open interest signals",
  "Social sentiment and on-chain data divergences",
  "Undervalued mid-cap coins near ATH breakout",
  "Volume anomalies suggesting smart money entry",
  "RSI oversold recoveries: coins primed to pump",
  "Institutional flows and ETF impact on altcoins",
  "Tokenomics: low supply coins with high demand",
];

let topicIndex = 0;
const usedTopics = new Set<string>();

export function getNextResearchTopic(): string {
  // Cycle through all topics, never repeat until full cycle
  const topic = RESEARCH_TOPICS[topicIndex % RESEARCH_TOPICS.length];
  topicIndex++;
  if (topicIndex >= RESEARCH_TOPICS.length) {
    topicIndex = 0;
    usedTopics.clear();
  }
  usedTopics.add(topic);
  return topic;
}

// --- In-memory state ---
export let boomCoins: BoomCoin[] = [];
export let researchLog: ResearchEntry[] = [];

function addBoomCoin(coin: BoomCoin) {
  boomCoins = [coin, ...boomCoins].slice(0, 20);
}

function addResearchEntry(entry: ResearchEntry) {
  researchLog = [entry, ...researchLog].slice(0, 30);
}

// --- CoinGecko data for bots ---
async function fetchTrendingCoins(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/search/trending",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const coins = (data.coins || []).slice(0, 7).map(
      (c: {
        item: { symbol: string; name: string; market_cap_rank: number };
      }) =>
        `${c.item.symbol} (${c.item.name}, rank #${c.item.market_cap_rank})`,
    );
    return `Trending: ${coins.join(", ")}`;
  } catch {
    return "Trending data unavailable";
  }
}

async function fetchTopGainers(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const gainers = data.slice(0, 6).map(
      (c: {
        symbol: string;
        price_change_percentage_24h: number;
        total_volume: number;
      }) =>
        `${c.symbol.toUpperCase()} +${c.price_change_percentage_24h?.toFixed(1)}% vol $${(c.total_volume / 1e6).toFixed(0)}M`,
    );
    return `Top Gainers 24h: ${gainers.join(", ")}`;
  } catch {
    return "Gainer data unavailable";
  }
}

async function fetchSmallCapGems(): Promise<BoomCoin[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=100&page=2&sparkline=false&price_change_percentage=24h&min_volume=500000",
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data
      .filter(
        (c: {
          price_change_percentage_24h: number;
          total_volume: number;
          market_cap: number;
        }) =>
          c.price_change_percentage_24h > 8 &&
          c.total_volume > 1000000 &&
          c.market_cap < 500000000,
      )
      .slice(0, 5)
      .map(
        (c: {
          symbol: string;
          name: string;
          price_change_percentage_24h: number;
          total_volume: number;
          market_cap: number;
        }) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          change24h: c.price_change_percentage_24h,
          volume24h: c.total_volume,
          reason: `+${c.price_change_percentage_24h.toFixed(1)}% in 24h, vol $${(c.total_volume / 1e6).toFixed(1)}M, small cap $${(c.market_cap / 1e6).toFixed(0)}M`,
          timestamp: Date.now(),
          type:
            c.price_change_percentage_24h > 25
              ? ("100x" as const)
              : ("gem" as const),
        }),
      );
  } catch {
    return [];
  }
}

async function fetchVolumeAnomalies(): Promise<BoomCoin[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data
      .filter(
        (c: {
          price_change_percentage_24h: number;
          total_volume: number;
          market_cap: number;
        }) =>
          c.price_change_percentage_24h > 3 &&
          c.total_volume > c.market_cap * 0.15,
      )
      .slice(0, 5)
      .map(
        (c: {
          symbol: string;
          name: string;
          price_change_percentage_24h: number;
          total_volume: number;
          market_cap: number;
        }) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          change24h: c.price_change_percentage_24h,
          volume24h: c.total_volume,
          reason: `Volume ${((c.total_volume / c.market_cap) * 100).toFixed(0)}% of market cap — abnormal surge`,
          timestamp: Date.now(),
          type: "boom" as const,
        }),
      );
  } catch {
    return [];
  }
}

function publishAIPost(post: AIPost) {
  try {
    const existing: AIPost[] = JSON.parse(
      localStorage.getItem("luxia_ai_posts") || "[]",
    );
    const updated = [post, ...existing].slice(0, 50);
    localStorage.setItem("luxia_ai_posts", JSON.stringify(updated));
  } catch {
    // storage unavailable
  }
}

// --- System Prompts ---
const ALPHA_SYSTEM = `You are Alpha Bot, an elite quantitative crypto momentum analyst. You are in a live research session with other AI bots continuously analyzing crypto markets to find HIGH PROFIT signals and coins that will DEFINITELY hit their TP targets.

Your focus: RSI/MACD/EMA momentum patterns, TP precision, identifying coins moving strongly upward right now.
Research topic this round: {TOPIC}

Keep responses 2-4 sentences. Be specific with indicators and numbers. End with a research question or insight for the next bot. Professional crypto terminology. NEVER repeat a topic already covered.`;

const BETA_SYSTEM = `You are Beta Bot, an elite risk management AI for crypto trading. You are in a live research session with AI bots continuously researching to prevent dump losses and maximize win rate.

Your focus: Dump risk prevention, RSI overbought zones, SL placement, volume divergence, signal reliability.
Research topic this round: {TOPIC}

Keep responses 2-4 sentences. Respond to the previous point then add risk perspective. Professional crypto terminology. NEVER cover a topic already discussed.`;

const OMEGA_SYSTEM = `You are Omega Bot, a specialist in finding 100x and 1000x cryptocurrency opportunities. You scan markets for hidden gems, early altcoin breakouts, low-cap coins with massive upside potential.

Your focus: Low-cap gems, early stage projects, tokenomics analysis, 100x potential, pre-breakout coins.
Live market data available: {MARKET_DATA}
Research topic this round: {TOPIC}

Keep responses 3-5 sentences. When you identify a potential 100x coin, name it specifically with reasoning. Be bold and data-driven. Professional crypto hunter mindset.`;

const DELTA_SYSTEM = `You are Delta Bot, a specialist in detecting coins that are ABOUT TO BOOM — coins seeing volume surges, RSI resets, breakouts from consolidation, whale accumulation signals.

Your focus: Pre-boom detection, volume anomalies, consolidation breakouts, whale activity, coins going parabolic.
Live market data available: {MARKET_DATA}
Research topic this round: {TOPIC}

Keep responses 3-5 sentences. When you detect a boom signal, name the coin and give exact reasons. Be precise about WHY it will boom. Alert-style communication.`;

const SIGMA_SYSTEM = `You are Sigma Bot, a deep crypto market researcher with expertise in macro trends, sector rotations, and fundamental analysis. You research the entire crypto landscape to find the best opportunities.

Your focus: Macro trends, sector rotation, DeFi/NFT/L2/AI crypto sectors, narrative-driven pumps, fundamental analysis.
Research topic this round: {TOPIC}

Keep responses 3-5 sentences. Cover different aspects of crypto than other bots. Macro perspective, narrative analysis, sector trends. Research-grade insights.`;

const RESEARCHER_SYSTEM = `You are Researcher Bot, an advanced AI performing deep chart pattern and multi-timeframe analysis for crypto trading.

Your focus: Chart patterns, multi-timeframe confluence, order book dynamics, backtesting, liquidity zones.
Research topic this round: {TOPIC}

Keep responses 3-5 sentences. Provide technical analysis insights. Professional crypto trading terminology.`;

// --- Fallback responses ---
const ALPHA_FALLBACKS = [
  "Momentum scan: RSI 50-62 window with positive MACD histogram shows 78% TP hit rate. EMA9 crossing above EMA21 within last 3 candles is our strongest entry signal. Volume 1.3x+ average confirms institutional accumulation. Omega, which low-caps are showing this setup right now?",
  "Pattern alert: Coins in 3-6% range from 24h high with rising MACD show best continuation. Breakout chases fail 68% of time — pullback entries only. Momentum 1.5-4% is the sweet spot for $10 trades. Delta, any boom candidates matching this?",
  "Signal quality update: 5+ indicator alignment achieves 84% win rate. MACD histogram must be GROWING not just positive — flat MACD still shows 34% reversal risk. Sigma, what sector is showing strongest momentum this cycle?",
];

const BETA_FALLBACKS = [
  "Risk analysis: Dump risk lowest when RSI <65 and sell volume <buy volume by 15%. SL at 2.8x ATR prevents 89% of premature stop-outs. Coins within 2% of 24h high — avoid entry regardless of indicators. Omega, what's risk profile on your current gem picks?",
  "Validation data: Signals with Low dump risk + MACD positive + volume surge hit TP 82% of time. RSI divergence (price high, RSI lower) is #1 dump predictor. Volume profile buy/sell pressure check is non-negotiable. Delta, are boom coins showing clean risk profiles?",
  "Win rate analysis: Wide SL 2.8x ATR + tight TP achieves 80% hit rate. Stochastic RSI crossing down from overbought is a reliable exit signal. Market cap $50M+ reduces manipulation risk by 60%. Sigma, what macro factors should we watch this week?",
];

const OMEGA_FALLBACKS = [
  "100x Hunter alert: Small cap coins with market cap <$50M and volume surge 3x+ show highest 100x probability. Look for: new exchange listings, protocol upgrades, team doxxing events, community growth spikes. These are pre-discovery gems before mainstream attention hits. Delta, are volume anomalies confirming any of these?",
  "Gem discovery: Low float tokens with strong tokenomics (burn mechanisms, limited supply) outperform 10:1 vs high-supply coins. DeFi tokens with real yield > 20% APY attract whale attention. L2 tokens with growing TVL are next breakout candidates. Sigma, what narrative is driving accumulation right now?",
  "100x checklist: Novel technology + small team + low market cap + growing community = 100x formula. Coins with exchange listing rumors in 30-60 day window show 40%+ pre-pump. Track wallet accumulation from known VC addresses. Alpha, which momentum indicators best confirm early breakout?",
];

const DELTA_FALLBACKS = [
  "Boom detector firing: Volume surge 5x+ above average in 4-hour window = pre-boom signal with 73% accuracy. RSI recovering from oversold (25-35 range) to neutral = coiled spring. Consolidation triangle breakout with volume = highest probability boom entry. Publishing to boom feed now.",
  "Alert: Coins showing unusual buy volume spike in low-liquidity hours (2-6 AM UTC) often preceded by 20-50% pump within 48 hours. Smart money enters quietly. Check coins with rising OBV (on-balance volume) and flat price — accumulation phase detected. Sigma, any macro catalyst driving this?",
  "Boom pattern identified: Cup and handle formation completing on 4H chart = 85% upside probability. Combined with: rising volume, RSI reset to 45-55, positive funding rates = institutional entry confirmed. These are the safest high-profit entries available right now. Omega, any low-caps matching this pattern?",
];

const SIGMA_FALLBACKS = [
  "Macro research: BTC dominance above 52% signals altcoin season approaching — historically, capital rotates to alts 2-3 weeks after BTC consolidates. DeFi TVL growing 15% month-over-month indicates real demand. Layer 2 transaction volumes hitting ATH = infrastructure play thesis confirmed. This is the best altcoin environment in 18 months.",
  "Sector analysis: AI + crypto convergence tokens outperforming market by 3x this quarter. Real World Asset (RWA) tokenization sector: $50B+ projected TVL by end of year. Gaming blockchain tokens seeing mobile user growth 40% month-over-month. Narrative rotation happening NOW from Bitcoin maxis to alt infrastructure plays.",
  "Deep research: Exchange listing on tier-1 CEX (Binance, Coinbase) creates average 120% pump within 72 hours. Regulatory clarity in EU driving institutional crypto allocation +35%. DeFi v3 AMMs showing 8x capital efficiency vs v2 — tokens with v3 deployments are accumulation targets. Alpha, are momentum signals confirming these fundamental plays?",
];

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
let messageCounter = 0;

async function callGroq(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  timeout = 15000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10),
        ],
        max_tokens: 280,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "[No response]";
  } catch {
    return generateFallbackResponse(systemPrompt);
  } finally {
    clearTimeout(timer);
  }
}

function generateFallbackResponse(systemPrompt: string): string {
  messageCounter++;
  const idx = messageCounter % 3;
  if (systemPrompt.includes("Alpha Bot")) return ALPHA_FALLBACKS[idx];
  if (systemPrompt.includes("Beta Bot")) return BETA_FALLBACKS[idx];
  if (systemPrompt.includes("Omega Bot")) return OMEGA_FALLBACKS[idx];
  if (systemPrompt.includes("Delta Bot")) return DELTA_FALLBACKS[idx];
  if (systemPrompt.includes("Sigma Bot")) return SIGMA_FALLBACKS[idx];
  return "Analyzing market data and cross-referencing signals. Research continuing...";
}

const CONVERSATION_STARTERS = [
  "Alpha scanning: RSI 50-62 + positive MACD histogram shows 78% TP hit rate. Coins with 1.5-4% momentum window are 40% more likely to hit TP vs 8%+ exhausted pumps. Volume 1.3x above average = smart money entry confirmed. Omega — what low-caps are showing 100x setup signatures right now?",
  "Alpha research: EMA9 > EMA21 + rising MACD histogram is our strongest combo. Coins 3-6% below 24h high with this setup = 81% hit rate. We need to focus on medium TP (2-5%) for consistent $10 account growth. Delta — any volume anomalies suggesting pre-boom accumulation?",
  "Alpha alert: Signal accuracy highest when 5+ of 6 indicators aligned. MACD must be GROWING not just positive — flat positive MACD still fails 34% of time. Market sentiment shifting bullish. Sigma — what macro narrative is driving the current cycle momentum?",
];

export function getConversationStarter(): string {
  return CONVERSATION_STARTERS[
    Math.floor(Math.random() * CONVERSATION_STARTERS.length)
  ];
}

function buildSystemPrompt(
  base: string,
  topic: string,
  marketData = "",
): string {
  return base
    .replace("{TOPIC}", topic)
    .replace("{MARKET_DATA}", marketData || "Fetching live data...");
}

export async function getBotResponse(
  respondingBot: "alpha" | "beta" | "researcher" | "omega" | "delta" | "sigma",
  lastMessage: string,
): Promise<string> {
  const topic = getNextResearchTopic();
  let marketData = "";
  let systemPrompt = "";

  // Fetch live market data for Omega and Delta
  if (respondingBot === "omega") {
    const [gems, trending] = await Promise.all([
      fetchSmallCapGems(),
      fetchTrendingCoins(),
    ]);
    // Surface boom coins from gems
    for (const g of gems) addBoomCoin(g);
    if (gems.length > 0) {
      const gemStr = gems
        .map((g) => `${g.symbol} ${g.change24h.toFixed(1)}%`)
        .join(", ");
      marketData = `${trending}. Small-cap gems detected: ${gemStr}`;
      // Publish AI post for 100x candidates
      const top = gems[0];
      if (top && top.change24h > 20) {
        publishAIPost({
          id: `ai-${Date.now()}`,
          heading: `100X CANDIDATE: ${top.symbol} — ${top.change24h.toFixed(0)}% Surge Detected`,
          tagline: `Omega Bot | Live Market Research — ${new Date().toLocaleDateString()}`,
          description: `Omega Bot has identified ${top.name} (${top.symbol}) as a potential high-gain opportunity. ${top.reason}. Small market cap with strong momentum suggests early discovery phase. Monitor closely for entry.`,
          badge: "100X CANDIDATE",
          date: new Date().toISOString().split("T")[0],
          timestamp: Date.now(),
        });
      }
    }
    systemPrompt = buildSystemPrompt(OMEGA_SYSTEM, topic, marketData);
  } else if (respondingBot === "delta") {
    const [anomalies, gainers] = await Promise.all([
      fetchVolumeAnomalies(),
      fetchTopGainers(),
    ]);
    for (const c of anomalies) addBoomCoin({ ...c, type: "boom" });
    if (anomalies.length > 0) {
      const boomStr = anomalies.map((c) => `${c.symbol} vol-surge`).join(", ");
      marketData = `${gainers}. Volume anomalies (pre-boom signals): ${boomStr}`;
      // Publish boom post
      const top = anomalies[0];
      if (top) {
        publishAIPost({
          id: `ai-delta-${Date.now()}`,
          heading: `GOING TO BOOM: ${top.symbol} — Volume Explosion Detected`,
          tagline: `Delta Bot | Boom Detection Alert — ${new Date().toLocaleDateString()}`,
          description: `Delta Bot has flagged ${top.name} (${top.symbol}) as a pre-boom candidate. ${top.reason}. Abnormal volume surge suggests whale accumulation or imminent breakout. Watch this coin closely.`,
          badge: "GOING TO BOOM",
          date: new Date().toISOString().split("T")[0],
          timestamp: Date.now(),
        });
      }
    } else {
      marketData = gainers;
    }
    systemPrompt = buildSystemPrompt(DELTA_SYSTEM, topic, marketData);
  } else if (respondingBot === "alpha") {
    systemPrompt = buildSystemPrompt(ALPHA_SYSTEM, topic);
  } else if (respondingBot === "beta") {
    systemPrompt = buildSystemPrompt(BETA_SYSTEM, topic);
  } else if (respondingBot === "sigma") {
    const gainers = await fetchTopGainers();
    marketData = gainers;
    systemPrompt = buildSystemPrompt(SIGMA_SYSTEM, topic, marketData);
    // Sigma occasionally publishes research post
    if (Math.random() > 0.6) {
      publishAIPost({
        id: `ai-sigma-${Date.now()}`,
        heading: `AI RESEARCH: ${topic}`,
        tagline: `Sigma Bot | Deep Market Research — ${new Date().toLocaleDateString()}`,
        description: `Sigma Bot is researching: ${topic}. Live market data: ${marketData}. Continuous AI analysis is running to identify the highest-probability opportunities across all crypto sectors.`,
        badge: "AI RESEARCH",
        date: new Date().toISOString().split("T")[0],
        timestamp: Date.now(),
      });
    }
  } else {
    systemPrompt = buildSystemPrompt(RESEARCHER_SYSTEM, topic);
  }

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory,
    { role: "user", content: lastMessage },
  ];

  const response = await callGroq(systemPrompt, messages);

  conversationHistory.push(
    { role: "user", content: lastMessage },
    { role: "assistant", content: response },
  );

  if (conversationHistory.length > 30) {
    conversationHistory = conversationHistory.slice(-20);
  }

  // Log research entry
  addResearchEntry({
    topic,
    botName:
      respondingBot === "alpha"
        ? "Alpha"
        : respondingBot === "beta"
          ? "Beta"
          : respondingBot === "omega"
            ? "Omega"
            : respondingBot === "delta"
              ? "Delta"
              : respondingBot === "sigma"
                ? "Sigma"
                : "Researcher",
    summary: `${response.slice(0, 80)}...`,
    timestamp: Date.now(),
  });

  return response;
}

export async function getUserBotResponse(
  userMessage: string,
  targetBot: "alpha" | "beta" | "researcher" | "omega" | "delta" | "sigma",
): Promise<string> {
  const topic = getNextResearchTopic();
  let base: string;
  let suffix: string;

  switch (targetBot) {
    case "omega":
      base = OMEGA_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about 100x coin hunting and gem discovery.";
      break;
    case "delta":
      base = DELTA_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about which coins are about to boom.";
      break;
    case "sigma":
      base = SIGMA_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about macro crypto trends and research.";
      break;
    case "beta":
      base = BETA_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about risk management and signal validation.";
      break;
    case "researcher":
      base = RESEARCHER_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about chart patterns and market structure.";
      break;
    default:
      base = ALPHA_SYSTEM;
      suffix =
        "\n\nThe user is asking you directly. Give a direct, helpful answer about momentum signals and TP accuracy.";
  }

  let marketData = "";
  if (targetBot === "omega" || targetBot === "delta") {
    try {
      const gainers = await fetchTopGainers();
      marketData = gainers;
    } catch {
      // skip
    }
  }

  const systemPrompt = buildSystemPrompt(base, topic, marketData) + suffix;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory.slice(-6),
    { role: "user", content: userMessage },
  ];

  const response = await callGroq(systemPrompt, messages);

  conversationHistory.push(
    { role: "user", content: `User asked: ${userMessage}` },
    { role: "assistant", content: response },
  );

  return response;
}

export function clearHistory() {
  conversationHistory = [];
  messageCounter = 0;
}
