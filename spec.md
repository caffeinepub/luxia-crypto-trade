# Luxia Crypto Trade

## Current State
- Snackbar has separate tabs: HOME, FAST TRADE, TRADE NOW, ACTIVE SIGNALS, HIGH PROFIT, SUPER HIGH, ELITE, SEARCH, TRACKING, FOUNDER, AI SKILLS, GUIDE
- Sidebar has "Verified Signals" as a sidebar-only link
- Page type enum includes: fast, tradeNow, active, highProfit, superHighProfit, elite, verifiedSignals
- AuthContext.addUser() saves to localStorage and calls saveUsersToBackend() immediately
- AI learning data syncs to backend on every save
- Auto-sync on app load: loads users from backend once on mount, but no periodic/real-time push
- Admin panel can delete users, but deleteUser() only updates localStorage (missing backend sync)

## Requested Changes (Diff)

### Add
- New page type `premiumSignals` for the combined section
- New `PremiumSignalsPage` that combines Fast Trade, Trade Now, Active Signals, High Profit, Super High Profit, Elite — each shown as a named sub-tab inside the page with its own filter criteria and signal cards
- New snackbar tab "ELITE SIGNALS" (replaces/moves Verified Signals from sidebar to snackbar)
- Auto-sync interval: every 30 seconds, push the full user list + AI learning data to the canister in the background
- On any user CRUD (add/delete/credit update), immediately sync to backend
- deleteUser in AdminPage must also sync to backend

### Modify
- Snackbar TOP_TABS: remove FAST TRADE, TRADE NOW, ACTIVE SIGNALS, HIGH PROFIT, SUPER HIGH, ELITE; add PREMIUM SIGNALS (single tab) and ELITE SIGNALS (renamed Verified Signals in snackbar)
- App Page type: add `premiumSignals` and `eliteSignals`, keep old types for backward compat but they will no longer be in the snackbar
- renderPage() in App.tsx: add cases for premiumSignals (PremiumSignalsPage) and eliteSignals (VerifiedSignalsPage renamed to EliteSignalsPage)
- AuthContext: add periodic auto-sync (setInterval every 30s) that pushes users + AI learning to backend silently
- AdminPage deleteUser: call saveUsersToBackend() after deleting from localStorage

### Remove
- "Verified Signals" from the sidebar tabs list (it moves to snackbar as "ELITE SIGNALS")
- Separate snackbar tabs for Fast Trade, Trade Now, Active Signals, High Profit, Super High Profit, Elite (all merged into Premium Signals)

## Implementation Plan
1. Create `PremiumSignalsPage.tsx` — tabbed page with 6 sub-sections (Fast Trade, Trade Now, Active Signals, High Profit, Super High Profit, Elite), each rendering SignalPage or ElitePage with correct type and applying their section filters. Use horizontal pill tab navigation.
2. Create `EliteSignalsPage.tsx` — rename/copy VerifiedSignalsPage with updated title "Elite Signals" branding.
3. Update `App.tsx`:
   - Add `premiumSignals` and `eliteSignals` to Page type
   - Replace 6 separate snackbar tabs with `premiumSignals` tab (gold crown icon)
   - Add `eliteSignals` tab to snackbar (shield/check icon)
   - Remove `verifiedSignals` from SIDEBAR_TABS
   - Add renderPage cases for both new pages
4. Update `AdminPage.tsx` deleteUser to call saveUsersToBackend() after localStorage update.
5. Update `AuthContext.tsx`: add a useEffect with setInterval(30000) that calls saveUsersToBackend() with current users list silently in the background — full auto-sync loop.
