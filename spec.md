# Luxia Crypto Trade — Fully AI Signal Engine Upgrade

## Current State
- Signal engine uses **synthetically generated candles** (seeded random walk) to compute RSI, EMA, MACD — not real OHLCV data
- MACD signal line is hardcoded as `macd * 0.9` (mathematically wrong)
- Groq AI is only used for chat — not for signal validation or enrichment
- AI learning only adjusts a single global multiplier (adjustmentFactor), not per-coin logic
- No real-time AI validation layer before a signal is shown to users
- Time-to-TP is a rough estimate, not AI-computed
- SuretyScore does not leverage AI analysis

## Requested Changes (Diff)

### Add
- **Groq AI signal validation layer**: After technical filters generate candidates, the top candidates are sent to Groq (Llama 3.3-70b) in batches for AI validation. Groq returns per-signal: aiConfidence (0-100), aiRating ("Strong Buy" | "Buy" | "Hold" | "Skip"), aiReason (1-2 sentences), estimatedHoursAI (number).
- **AI-enriched signal fields**: `aiRating`, `aiConfidence`, `aiReason`, `aiEnriched: true` shown on signal cards.
- **Real OHLCV-based indicators**: For any coin with a valid CoinGecko ID, fetch real 24h OHLCV data (candles) to compute RSI, EMA, MACD, ATR — replacing synthetic candles. Synthetic candles used only as fallback.
- **Fixed MACD calculation**: Signal line = EMA(9) of MACD values (proper calculation).
- **AI auto-improvement loop**: After each scan, the AI learning service analyzes current adjustmentFactors and generates new thresholds (minMomentum, minVolume, minConfidence) stored per-coin in coinProfiler. These are applied on next scan.
- **AI signal status indicator**: Small "AI Validated" badge on signal cards that went through Groq validation. Shows aiRating.
- **Groq-powered time-to-TP**: AI gives its own estimate of hours-to-TP based on coin momentum pattern description, shown alongside technical estimate.

### Modify
- **generateSignals()**: After candidate list is built, fetch real OHLCV for top 50 candidates in parallel (batched), recompute indicators with real data, re-score.
- **Signal cards**: Show `aiRating` badge and `aiReason` tooltip. If `aiRating === "Skip"`, signal is hidden.
- **SuretyScore**: Now weighted 40% on aiConfidence (when available), 30% TP probability, 20% momentum, 10% indicator alignment.
- **Guaranteed Hit badge**: Requires `aiRating === "Strong Buy"` AND existing thresholds.
- **TrackingPage**: Show AI validation status on tracked trades.

### Remove
- Signals with `aiRating === "Skip"` are excluded from all signal pages.
- The `MACD signal = macd * 0.9` hardcode — replaced with proper EMA calculation.

## Implementation Plan
1. Add `fetchRealOHLCV(coinId)` in marketData.ts — fetches 24h OHLCV from CoinGecko and returns candle array
2. In signalEngine.ts, after building candidates list, fetch real OHLCV for top candidates and recompute indicators
3. Fix MACD signal line to use EMA(9) of MACD series
4. Add `enrichSignalsWithAI(signals, topN)` in ai.ts — sends batched Groq request for validation, returns enriched signals
5. Apply AI enrichment: filter out "Skip" rated signals, update suretyScore and guaranteedHit based on aiConfidence
6. Update Signal interface to add aiRating, aiConfidence, aiReason fields
7. Update SignalCard.tsx and LiveSignalCard.tsx to show "AI Validated" badge, aiRating, aiReason
8. Update suretyScore formula to incorporate aiConfidence
9. Update aiLearning.ts: after each batch of outcomes, run AI analysis to suggest per-coin threshold updates and store them in coinProfiler
