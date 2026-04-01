# Luxia Crypto Trade

## Current State
The app has 6 signal pages (Active Signals, Fast Trade, Trade Now, High Profit, Super High Profit, Search) each using the shared SignalPage component with sort/filter options. The signal engine generates BUY signals with confidence/surety/guarantee scoring, AI validation via Groq, and dump-risk filtering.

## Requested Changes (Diff)

### Add
- New `ElitePage` page component for the Elite Section
- Elite filtering logic in the signal engine (or as a post-filter): acts as an institutional trader
  - Only A+ setups: must have all of — confidence ≥ 90%, tpProbability ≥ 88%, suretyScore ≥ 80, indicatorsAligned = 6/6, dumpRisk = "Low", momentum in 1–8% range (not exhausted), aiRating = "Strong Buy" (when enriched)
  - Minimum risk:reward 1:1.5 (already guaranteed by SL width)
  - Avoids overextended coins: rejects coins up 15%+ in 24h or within 0.3% of 24h high
  - Maximum 5 signals shown (1–2 would cause empty screen too often; 5 is a practical A+ cap)
  - If 0 signals qualify → show a full "NO TRADE" screen with reason
  - Sorted by composite (profit × confidence × TP probability) by default
  - The same sort button as other signal pages, but default is "composite"
- Elite tab in the snackbar and App routing
- A premium visual design: dark navy header banner, gold crown icon, institutional tone

### Modify
- `App.tsx`: add `elite` to Page type, add tab to TOP_TABS (Crown icon, label "ELITE"), add case to renderPage, import ElitePage

### Remove
- Nothing removed

## Implementation Plan
1. Create `src/frontend/src/pages/ElitePage.tsx` — wraps SignalPage with `type="elite"` props
2. Update `SignalPage.tsx` to handle `type="elite"`: apply elite filter (confidence ≥ 90, tpProbability ≥ 88, suretyScore ≥ 80, indicatorsAligned = 6, dumpRisk = "Low", momentum 1–8, not up 15%+, not within 0.3% of 24h high) and cap at 5 signals; show NO TRADE state when empty
3. Update `App.tsx` to add elite page routing and snackbar tab
