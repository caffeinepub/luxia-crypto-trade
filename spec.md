# Luxia Crypto Trade

## Current State
Full trading signal platform with signal pages, tracking, AI dashboard, admin panel, news, and founder pages. Navigation uses a scrollable snackbar + left sidebar.

## Requested Changes (Diff)

### Add
- New **Instructions** page/tab accessible from sidebar navigation and snackbar
- The page has three internal navigation tabs (lines/sections):
  1. **How to Trade** — Step-by-step guide to using signals without loss (entry rules, SL rules, when to exit, risk management)
  2. **Signal Thresholds** — What Confidence %, Winning Probability %, and Surety Rate % values indicate a high-probability winning trade (with visual thresholds/charts)
  3. **Trading Rules** — Full ruleset: never trade below X confidence, always respect SL, how to use Guaranteed Hit badge, when to track vs skip, position sizing basics

### Modify
- Add Instructions tab to the sidebar navigation (icon: BookOpen or GraduationCap)
- Add Instructions icon to the snackbar

### Remove
- Nothing

## Implementation Plan
1. Create `InstructionsPage.tsx` with three internal tab navigation (tab bar with 3 labeled tabs)
2. Tab 1 - How to Trade: numbered steps, icons, tips for trading signals without loss
3. Tab 2 - Signal Thresholds: confidence/probability/surety breakdown with color-coded threshold cards showing green (safe), amber (caution), red (avoid) zones
4. Tab 3 - Trading Rules: full ruleset cards with do/don't format
5. Wire into sidebar nav and snackbar
6. Match luxury design: navy/gold palette, glassmorphism cards, clean typography
