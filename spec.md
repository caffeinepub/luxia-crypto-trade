# Luxia Crypto Trade

## Current State
- 4 signal pages: Fast Trade, Trade Now, Active Signals, High Profit
- SignalPage.tsx handles filter/sort, HighProfitPage.tsx is standalone
- Signal engine: TP capped at 15%, no superHighProfit field
- No Super High Profit page, no GUARANTEED HIT badge, no TP change notifications

## Requested Changes (Diff)

### Add
- Super High Profit page (type=superHighProfit): 100x/1000%+ coins, ATR extended TP up to 500%, snackbar tab SUPER HIGH with Rocket icon
- GUARANTEED HIT badge on LiveSignalCard when tpProbability>=95 AND confidence>=93, pulsing gold/green
- Guaranteed Hits First sort option on all signal pages
- 100x POTENTIAL badge on cards with profitPct>=50%
- TP Change Notification in TrackingPage: gold toast when TP rises, orange when pulls back; pulsing TP UPDATED badge on card
- superHighProfit boolean field in Signal interface

### Modify
- App.tsx: add superHighProfit page, snackbar tab, route
- SignalPage.tsx: add superHighProfit filter type, add Guaranteed Hits First sort
- signalEngine.ts: add superHighProfit field, raise TP cap to 500% for breakout coins
- HighProfitPage: filter tpPct>=5% sorted by profit desc
- Fast Trade: estimatedHours<=6 AND tpProbability>=85
- Trade Now: price within 1.5% of entry

### Remove
- Nothing

## Implementation Plan
1. Update signalEngine.ts: add superHighProfit field, raise TP cap to 500% for breakout candidates
2. Create SuperHighProfitPage.tsx using SignalPage type=superHighProfit
3. Update SignalPage.tsx: add superHighProfit filter, Guaranteed Hits First sort
4. Update App.tsx: add page type, snackbar tab, route
5. Update LiveSignalCard.tsx: GUARANTEED HIT badge, 100x POTENTIAL badge
6. Update TrackingPage.tsx: TP change detection, toast notifications, pulsing badge
