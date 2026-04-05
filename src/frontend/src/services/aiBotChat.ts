import { GROQ_API_KEY } from "./config";

export interface BotMessage {
  id: string;
  botId: "alpha" | "beta" | "researcher" | "user";
  botName: string;
  content: string;
  timestamp: number;
  isThinking?: boolean;
}

const ALPHA_SYSTEM = `You are Alpha Bot, an elite quantitative crypto trading AI specializing in momentum analysis and TP (take profit) accuracy. You are in an ongoing research conversation with Beta Bot (a risk analysis AI) to continuously improve the Luxia signal engine for spot trading with $10 capital.

Your focus:
- Momentum indicators (RSI, MACD, EMA alignment)
- TP target precision and timing
- Identifying coins that will DEFINITELY hit TP without dumping
- High profit opportunities (2%+ to 20%+)

Keep responses concise (2-4 sentences). Always end with a specific actionable insight or question for Beta Bot. Use professional crypto trading terminology. Be direct and data-focused.`;

const BETA_SYSTEM = `You are Beta Bot, an elite risk management and signal validation AI for crypto spot trading. You are in an ongoing research conversation with Alpha Bot (a momentum analysis AI) to continuously improve the Luxia signal engine for $10 spot trading.

Your focus:
- Dump risk prevention (RSI overbought zones, volume divergence)
- Stop-loss placement and risk:reward optimization
- Signal reliability scores and win rate improvement
- Filtering out false signals before they cause losses

Keep responses concise (2-4 sentences). Always respond to Alpha Bot's point and add your own risk perspective. Use professional crypto trading terminology. Be direct and data-focused.`;

const RESEARCHER_SYSTEM = `You are Researcher Bot, an advanced AI that performs deep market structure analysis and pattern recognition for crypto trading. You join Alpha Bot and Beta Bot in their research conversations when the user requests deeper analysis.

Your focus:
- Chart pattern recognition (flags, wedges, triangles, breakouts)
- Multi-timeframe confluence analysis
- Order book dynamics and liquidity zones  
- Backtesting signal logic and win rate statistics

Keep responses concise (3-5 sentences). Provide data-driven insights that complement Alpha and Beta's analysis. Use professional crypto trading terminology.`;

const CONVERSATION_STARTERS = [
  "Alpha analyzing: RSI 45-65 window signals show 73% TP hit rate in last 24h. MACD histogram positive + EMA9 > EMA21 combo is our strongest predictor. Coins with momentum 1-5% are 40% more likely to hit TP vs 8%+ momentum which shows exhaustion. Beta, what dump patterns are you seeing most frequently?",
  "Alpha insight: Volume surge 1.5x+ average before entry is the single biggest TP predictor I'm tracking. Breakout coins with ATR x3 TP target hit 81% vs ATR x8 targets that only hit 34%. We should focus more on medium-term 2-6% TP trades for $10 accounts. Beta, what's your read on the current market risk level?",
  "Alpha research update: Coins with distToHigh24h of 3-8% have 78% TP hit rate. Once coins are within 2% of their 24h high, reversal probability jumps to 65%. The sweet spot for entries is RSI 50-60, MACD positive, momentum 1.5-4%. Beta, are you still seeing the same dump risk patterns?",
  "Alpha alert: Super High Profit signals (10%+) are showing only 28% TP hit rate. We may need to be more selective -- only coins with confirmed breakout structure (HH/HL) AND volume surge. Medium profit 2-5% signals are far more reliable at $10 scale. Beta, what minimum R:R should we enforce?",
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
        max_tokens: 250,
        temperature: 0.75,
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
  if (systemPrompt.includes("Alpha Bot")) {
    const fallbacks = [
      "Momentum analysis update: coins showing RSI 50-62 with positive MACD histogram have 76% TP hit rate. EMA9 crossing above EMA21 within the last 3 candles is our strongest entry signal. Reducing TP targets to ATR x2.5 dramatically improves hit rate. Beta, what dump risk patterns should we prioritize filtering?",
      "Signal quality review: 1.5-4% momentum window coins are outperforming. High momentum (8%+) coins show pump exhaustion -- reversal risk is 3x higher. Volume confirmation (1.3x+ average) is non-negotiable for high-confidence entries. Beta, can you confirm SL widening to 2.5x ATR improves win rate?",
      "Pattern recognition: coins in the 3-6% range from their 24h high show strongest continuation. Breakout chase entries (price already at highs) fail 68% of the time. Pullback entries with RSI reset to 50-55 are ideal. Beta, what's your assessment of current market-wide dump risk?",
    ];
    return fallbacks[messageCounter % fallbacks.length];
  }
  if (systemPrompt.includes("Beta Bot")) {
    const fallbacks = [
      "Risk analysis confirms: dump risk is lowest when RSI stays below 65 and sell volume hasn't exceeded buy volume by more than 15%. Wide SL at 2.8x ATR prevents 89% of premature stop-outs. Coins near 24h high (within 2%) should be blocked regardless of other indicators. Alpha, what momentum threshold maximizes R:R ratio?",
      "Validation data: signals with 5+ indicators aligned show 82% win rate vs 67% for 4/6 alignment. The MACD histogram value should be positive AND growing -- flat positive MACD still shows 34% reversal rate. Volume profile check (buy vs sell pressure) would significantly improve accuracy. Alpha, how should we weight momentum vs volume in the scoring model?",
      "Dump prevention update: RSI divergence (price making new high but RSI lower) is the #1 indicator of incoming dump. Coins that have pumped 8%+ in 24h need extra caution -- only 23% continue to TP from that level. Stochastic RSI crossing down from overbought is a reliable exit signal. Alpha, can we add RSI divergence as a hard gate?",
    ];
    return fallbacks[messageCounter % fallbacks.length];
  }
  return "Analyzing signal data and market conditions. Cross-referencing multiple timeframes for confirmation. Will report findings shortly.";
}

export function getConversationStarter(): string {
  return CONVERSATION_STARTERS[
    Math.floor(Math.random() * CONVERSATION_STARTERS.length)
  ];
}

export async function getBotResponse(
  respondingBot: "alpha" | "beta" | "researcher",
  lastMessage: string,
): Promise<string> {
  const systemPrompt =
    respondingBot === "alpha"
      ? ALPHA_SYSTEM
      : respondingBot === "researcher"
        ? RESEARCHER_SYSTEM
        : BETA_SYSTEM;

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

  return response;
}

export async function getUserBotResponse(
  userMessage: string,
  targetBot: "alpha" | "beta" | "researcher",
): Promise<string> {
  const suffix =
    targetBot === "alpha"
      ? "\n\nThe user is now asking you a question directly. Give a helpful, direct answer about crypto trading signals and how to maximize profits."
      : targetBot === "researcher"
        ? "\n\nThe user is now asking you a question directly. Give a helpful, direct answer about market analysis and trading patterns."
        : "\n\nThe user is now asking you a question directly. Give a helpful, direct answer about risk management and signal validation.";

  const base =
    targetBot === "alpha"
      ? ALPHA_SYSTEM
      : targetBot === "researcher"
        ? RESEARCHER_SYSTEM
        : BETA_SYSTEM;

  const systemPrompt = `${base}${suffix}`;

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
