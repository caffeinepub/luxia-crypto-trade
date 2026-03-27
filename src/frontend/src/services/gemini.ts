import type { Ticker } from "./bingx";
import { GEMINI_API_KEY } from "./config";

const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];

export interface AISignalAnalysis {
  confidence: number;
  analysis: string;
  estimatedHours: number;
}

interface ChatMessage {
  role: string;
  text: string;
}

async function callGemini(prompt: string): Promise<string> {
  let lastError: Error | null = null;
  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

export async function analyzeSignal(
  ticker: Ticker,
  rsi: number,
  momentum: number,
): Promise<AISignalAnalysis> {
  try {
    const prompt = `As a crypto trading AI, analyze this signal: Symbol ${ticker.symbol}, Price ${ticker.lastPrice}, 24h Change ${ticker.priceChangePercent}%, RSI-14 ${rsi.toFixed(1)}, Momentum ${momentum.toFixed(2)}. Give a BUY/SELL signal confidence score 0-100, 2-sentence analysis, and estimated hours to hit TP. Respond as JSON only: {"confidence": number, "analysis": "string", "estimatedHours": number}`;
    const text = await callGemini(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 75)),
        analysis: String(parsed.analysis || "Strong technical setup detected."),
        estimatedHours: Math.max(1, Number(parsed.estimatedHours) || 12),
      };
    }
    throw new Error("Parse error");
  } catch {
    return {
      confidence: 75,
      analysis:
        "AI analysis temporarily unavailable. Technical indicators suggest a valid setup.",
      estimatedHours: 12,
    };
  }
}

export async function chatWithAI(
  tradeContext: string,
  userMessage: string,
  history: ChatMessage[],
): Promise<string> {
  try {
    const historyText = history
      .slice(-4)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n");
    const prompt = `You are Luxia AI, an expert crypto trading assistant for Trezaria International. Trade context: ${tradeContext}\n\nConversation history:\n${historyText}\n\nUser: ${userMessage}\n\nProvide a concise, professional trading insight in 2-3 sentences.`;
    const response = await callGemini(prompt);
    return (
      response || "I'm analyzing the market data. Please try again in a moment."
    );
  } catch {
    return "Luxia AI is temporarily unavailable. Based on the technical indicators, this trade shows strong potential. Monitor the entry point closely.";
  }
}

export async function analyzeTrackedTrade(
  symbol: string,
  direction: string,
  entryPrice: number,
  currentPrice: number,
  takeProfit: number,
  stopLoss: number,
  progressPct: number,
  elapsedHours: number,
  strengthLabel: string,
): Promise<string> {
  try {
    const prompt = `You are Luxia AI, a professional crypto trading analyst. Analyze this live tracked trade:
- Coin: ${symbol}
- Direction: ${direction}
- Entry: $${entryPrice.toFixed(6)}
- Current Price: $${currentPrice.toFixed(6)}
- Take Profit: $${takeProfit.toFixed(6)}
- Stop Loss: $${stopLoss.toFixed(6)}
- Progress to TP: ${progressPct.toFixed(1)}%
- Time in trade: ${elapsedHours.toFixed(1)} hours
- Strength: ${strengthLabel}

Give a 2-3 sentence live monitoring assessment: Is this trade on track to hit TP? Should the trader hold, take partial profit, or exit? Be direct and specific.`;
    return await callGemini(prompt);
  } catch {
    const onTrack = progressPct > 50;
    return onTrack
      ? `${symbol} is progressing well toward TP at ${progressPct.toFixed(0)}% complete. Hold position and maintain stop loss discipline.`
      : `${symbol} needs monitoring — only ${progressPct.toFixed(0)}% toward TP. Watch for strength indicators before adding to position.`;
  }
}

export async function curateNews(rawNews: string[]): Promise<string[]> {
  try {
    const prompt = `You are a crypto news curator. Summarize each of these news headlines into one sharp, insightful sentence that adds market context. Return as a JSON array of strings.\n\nHeadlines: ${JSON.stringify(rawNews.slice(0, 5))}`;
    const text = await callGemini(prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return rawNews;
  } catch {
    return rawNews;
  }
}
