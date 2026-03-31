# Luxia Crypto Trade

## Current State
The signal engine generates surety scores for signals and offers a "Highest Surety" sort option. However, high-momentum coins (10–20%+ today) often score high on surety due to momentum weight, but these coins are already near their 24h high and prone to reversing before hitting TP (classic pump-and-dump pattern). The tracking page (TrackingPage.tsx) renders trade cards that visually identical to the LiveSignalCard design — same white card, same layout — making them hard to distinguish and not optimized for tracking-specific information.

## Requested Changes (Diff)

### Add
- Anti-dump "late entry" penalty in suretyScore: coins with 24h momentum >8% AND within 2% of their 24h high get a heavy surety penalty (they are near exhaustion)
- Pre-dump volume check: if volumeRatio suggests declining volume relative to price rise, reduce surety score
- "Highest Surety" sort filter now requires momentum BETWEEN 1% and 8% (the optimal early-to-mid momentum window, not exhausted pumps)
- Tracking card: completely distinct visual design — dark navy/gold gradient header with large coin name + LIVE TRACKING badge, oversized live price as hero element, color-coded live P&L (green/red), fat progress bar as visual centerpiece, compact entry/TP/SL row at bottom, different from signal cards

### Modify
- signalEngine.ts: suretyScore formula — add lateEntryRisk penalty: if momentum > 8% AND coin is within 3% of its 24h high (already near peak), subtract 25 from suretyScore (late entry = higher dump risk)
- signalEngine.ts: suretyScore — reduce momentumQuality weight to 15% (was 20%), add reversalRisk component (5%): penalizes coins with momentum > 10% relative to their distance from 24h high
- TrackingPage.tsx: tracked trade cards redesigned with:
  - Dark navy (#0A1628) header strip with coin name, direction badge, elapsed time, and live pulse indicator
  - Large live price (24px font) prominently shown below header with % from entry
  - Gold progress bar toward TP (thick, 6px), entry→TP labeled
  - Live P&L badge: "▲ +X.XX%" in green or "▼ -X.XX%" in red
  - Entry/TP/SL in compact 3-col footer row
  - Warning banners (dump/stale/take profit now) remain but styled to match the new card theme
  - AI Monitor panel and chat remain but visually integrated into new design

### Remove
- Remove the "same as signal card" generic white layout from tracking cards
- Remove surety bonus for very high momentum coins (>10%) — they are dump risks, not surety trades

## Implementation Plan
1. Update `src/frontend/src/services/signalEngine.ts`:
   - Add lateEntryRisk calculation: `const distToHigh24h = coin.high24h ? (coin.high24h - coin.price) / coin.price : 0.05`
   - Add `const lateEntryRisk = (momentum > 8 && distToHigh24h < 0.03) ? 25 : (momentum > 6 && distToHigh24h < 0.02) ? 15 : 0`
   - Modify suretyScore formula: subtract lateEntryRisk, reduce momentumQuality to 15%, add reversalRisk 5%
   - In the "Highest Surety" sort apply, filter signals to only those with momentum between 1% and 8% (not exhausted)
2. Update `src/frontend/src/pages/TrackingPage.tsx`:
   - Redesign the tracked trade card JSX with dark navy header, large live price hero, fat progress bar, P&L badge
   - Keep all logic (AI monitor, chat, mark hit/missed, remove, TP notifications) unchanged
   - Warning banners adapt to new card theme
3. Validate and build
