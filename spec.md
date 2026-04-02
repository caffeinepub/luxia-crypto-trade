# Luxia Crypto Trade

## Current State
The Tracking page has an "Update" button on each tracked trade card that opens `TradeUpdateModal.tsx`. This runs 20 live technical checks (RSI, MACD, EMA, volume, momentum, P&L, TP/SL distance, etc.) using CoinGecko OHLCV data and gives a HOLD / CAUTION / EXIT verdict. The service is in `src/frontend/src/services/tradeTest.ts` and uses `fetchLiveOHLC` which fetches 1-day OHLC candles.

## Requested Changes (Diff)

### Add
- `src/frontend/src/services/chartPatternAnalysis.ts` — new service that:
  - Fetches both 1h candles (last 48 candles) AND 4h candles (last 30 candles) from CoinGecko for multi-timeframe analysis
  - Detects candlestick patterns on both timeframes: Doji, Hammer, Shooting Star, Bullish/Bearish Engulfing, Morning Star, Evening Star, Harami, Tweezer Top/Bottom, Pin Bar
  - Detects chart patterns: Bull Flag, Bear Flag, Double Top, Double Bottom, Head & Shoulders, Inverse Head & Shoulders, Ascending/Descending/Symmetrical Triangle, Wedge, Cup & Handle, Support/Resistance retests
  - Identifies key support and resistance levels from recent swing highs/lows
  - Computes multi-timeframe confluence score (how many timeframes agree on direction)
  - Generates a structured analysis object: `{ patterns1h, patterns4h, supportLevels, resistanceLevels, confluenceScore, bullishSignals, bearishSignals, overallBias, keyInsight }`
  - Sends the full OHLCV candle data + pattern detections to Groq AI (Llama 3.3-70b) with a professional senior trader system prompt asking it to give a clear narrative verdict: will this tracked trade hit TP or should it exit? Groq returns a structured JSON with: `{ verdict: 'hold'|'caution'|'exit', confidence: number, keyPattern: string, narrative: string, tpOutlook: string, riskFactors: string[] }`
  - Falls back to a rule-based analysis if Groq fails
- New section in `TradeUpdateModal.tsx`: "Professional Chart Analysis" panel that shows:
  - Detected candlestick patterns on 1h with visual badges (bullish=green, bearish=red)
  - Detected chart patterns with descriptions
  - Multi-timeframe confluence indicator (1h and 4h agreement)
  - Groq AI professional narrative text (like a senior trader's commentary)
  - AI verdict badge (HOLD / CAUTION / EXIT) from chart analysis
  - Key pattern name highlighted
  - Risk factors list
  - TP outlook text
- New loading stages added to the modal: "Fetching 1h + 4h chart data...", "Detecting chart patterns...", "Generating AI trader analysis..."

### Modify
- `TradeUpdateModal.tsx`: integrate `chartPatternAnalysis` — call it in parallel with the existing 20-check analysis, show chart analysis section above or below the existing checks panel. The final combined verdict should consider both the 20-check result AND the chart pattern AI verdict. If chart AI says EXIT but checks say HOLD, overall = CAUTION. If both agree on EXIT = EXIT. If both agree on HOLD = HOLD.
- Loading stages array: add 2 more stages for chart fetching and AI analysis

### Remove
- Nothing removed

## Implementation Plan
1. Create `src/frontend/src/services/chartPatternAnalysis.ts`:
   - `fetchMultiTimeframeData(coinId)` — fetches 1h and 4h OHLCV from CoinGecko `/coins/{id}/ohlc?vs_currency=usd&days=2` for 1h and `days=7` for 4h (CoinGecko granularity: 1-2 days = ~1h candles, 3-90 days = ~4h candles)
   - `detectCandlestickPatterns(candles)` — returns array of pattern objects `{name, type:'bullish'|'bearish'|'neutral', strength:1-3, description}`
   - `detectChartPatterns(candles)` — returns array of chart pattern objects
   - `findSupportResistance(candles)` — returns key levels
   - `analyzeWithGroqAI(coinSymbol, currentPrice, entryPrice, tp, sl, patterns1h, patterns4h, candles1h, candles4h)` — builds professional trader prompt, calls Groq, parses JSON response, returns structured result with fallback
   - `runChartPatternAnalysis(trade, currentPrice)` — orchestrates all of the above
2. Update `TradeUpdateModal.tsx`:
   - Add chart analysis state
   - Call `runChartPatternAnalysis` in parallel with existing checks
   - Add new loading stages
   - Render chart analysis section: pattern badges, confluence meter, AI narrative panel, combined verdict
   - Combine verdicts: chart AI verdict + 20-check verdict → final verdict
