# Luxia Crypto Trade

## Current State
- SignalPage has two sort options: "Highest Profit" and "Surety"
- Signal engine generates all signals with dumpRisk scored but no global anti-dump/pullback gate on the raw signal list shown on page
- SuperHighProfitPage shows all signals with >10% TP, including low surety ones
- TrackingPage updates live prices every 60 seconds (too slow)

## Requested Changes (Diff)

### Add
- New sort option "🚀 TP Hitting" on all signal pages — when selected, shows ONLY signals actively pumping toward TP with zero dump/pullback risk
- TP Hitting criteria: momentum 1–9%, RSI 45–68, MACD histogram positive (>0), distToHigh24h > 3% (room to run), dumpRisk=Low, aiRating Strong Buy or Buy, estimatedHours ≤ 16, indicatorsAligned >= 5, trendDirection = bullish
- Sorted highest profit % first

### Modify
- **Global signal gate (signalEngine.ts):** Add a final hard gate before pushing to candidates: skip any signal where dumpRisk is High OR (dumpRisk is Medium AND macdHistogram < 0). This ensures every signal displayed has at minimum a non-High dump risk with positive MACD momentum.
- **SuperHighProfitPage / SignalPage superHighProfit filter:** Add minimum suretyScore >= 70 filter for superHighProfit section
- **TrackingPage:** Reduce live price update interval from 60,000ms to 10,000ms for near-real-time tracking

### Remove
- Nothing removed

## Implementation Plan
1. signalEngine.ts: Add hard gate — skip coins where dumpRisk === 'High' OR (dumpRisk === 'Medium' && macdHistogram < 0)
2. SignalPage.tsx: Add SortKey 'tpHitting', add to SORT_OPTIONS array, add sortSignals case that filters by TP Hitting criteria and sorts by profit
3. SuperHighProfit filter in filterSignals: add suretyScore >= 70 requirement
4. TrackingPage.tsx: Change 60000 → 10000 in the setInterval for live price fetching
