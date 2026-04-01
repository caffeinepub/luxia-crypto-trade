# Luxia Crypto Trade

## Current State
Elite section exists with basic filters (90%+ confidence, 88%+ TP probability, low dump risk, 5–6 indicators, NO TRADE screen). Missing: HH/HL trend structure, pullback-only entry, 1–2 trade session cap, R:R 1:1.5 enforcement, news avoidance, consecutive direction block.

## Requested Changes (Diff)

### Add
- Higher highs / lower lows trend structure check using price history (at least 2 HH+HL confirmations for LONG)
- Pullback/retest detection: entry price must be within 1% of a recent support/resistance level, not at a breakout high
- Session cap: maximum 2 Elite signals shown per scan session; if 2 are already shown, display "SESSION FULL — Max 2 Trades Reached"
- Minimum R:R 1:1.5 per signal (TP distance must be at least 1.5× SL distance)
- News event filter: suppress Elite signals for any coin trending in recent negative/major news from the news feed
- Consecutive direction block: if last Elite signal shown was a BUY, a second consecutive BUY is blocked unless first was closed
- Detailed "NO TRADE" reason message (e.g., "Market is sideways", "No pullback entry available", "Session cap reached", "News risk detected")
- Each Elite card shows: R:R ratio badge, trend structure label ("HH/HL Confirmed"), entry type ("Pullback Entry"), and session trade counter ("Trade 1 of 2")

### Modify
- Elite signal filter function to enforce all 5 rule sets
- Elite page to show session counter and NO TRADE reason screen

### Remove
- Nothing removed

## Implementation Plan
1. Upgrade Elite signal scoring: add HH/HL trend check, pullback detection, R:R 1:1.5 gate, news suppression, consecutive direction block
2. Add session cap logic (max 2 per session, resets on rescan)
3. Upgrade NO TRADE screen to show specific reason
4. Add Elite card badges: R:R ratio, trend structure, entry type, session counter
5. Wire all changes into the existing ElitePage/Elite signal section
