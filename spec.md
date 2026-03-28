# Luxia Crypto Trade

## Current State
AI chat uses Gemini API (Google) in `services/gemini.ts`. All AI functions (analyzeSignal, chatWithAI, analyzeTrackedTrade, curateNews) call Gemini with a Google API key. LiveSignalCard and TrackingPage import directly from gemini.ts. When Gemini fails, a static fallback string is shown.

## Requested Changes (Diff)

### Add
- `services/ai.ts` — new AI service replacing gemini.ts:
  - Primary: Groq API (free, no key needed for public access via llama-3.3-70b-versatile model) — uses `https://api.groq.com/openai/v1/chat/completions` with a free public Groq key
  - Secondary fallback: Hugging Face Inference API (zephyr-7b-beta or mistralai/Mistral-7B-Instruct free inference)
  - Final fallback: deterministic rule-based technical analysis built from the signal data itself (RSI, MACD, EMA, trend, etc.) — always returns meaningful output, never the generic "AI unavailable" message
- Chart analysis: Before AI response, fetch last 24h OHLCV candle data from CoinGecko for the traded coin, compute price range / trend direction / volume pattern, include that in the AI prompt so analysis is grounded in real chart data
- Per-signal chart context: extract coin ID from signal symbol, fetch `/coins/{id}/ohlc?vs_currency=usd&days=1` from CoinGecko to get real 4h candles for chart analysis

### Modify
- `services/config.ts` — remove GEMINI_API_KEY and GEMINI_BASE_URL; add GROQ_API_KEY
- `components/LiveSignalCard.tsx` — change import from `gemini` to `ai`
- `pages/TrackingPage.tsx` — change import from `gemini` to `ai`
- `pages/NewsPage.tsx` — change import from `gemini` to `ai` for curateNews
- All AI responses must be meaningful; no "temporarily unavailable" messages ever shown

### Remove
- `services/gemini.ts` — replaced entirely by `services/ai.ts`
- All Gemini API references from config.ts

## Implementation Plan
1. Create `services/ai.ts` with Groq primary + HuggingFace fallback + rule-based final fallback
2. Add OHLCV fetching helper inside ai.ts that pulls CoinGecko 1-day candle data
3. Update `services/config.ts` to swap Gemini for Groq key
4. Update imports in LiveSignalCard, TrackingPage, NewsPage to use new ai.ts
5. Delete gemini.ts reference (leave file but update imports — new ai.ts provides same API surface)
6. Validate build passes
