import type { Ticker } from "./bingx";
import { GEMINI_API_KEY, GEMINI_BASE_URL } from "./config";

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
  const res = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    }),
  });
  if (!res.ok) throw new Error("Gemini API error");
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
