# Luxia Crypto Trade

## Current State
- All user data (tracked trades, user accounts, credits, AI learning) stored in browser localStorage only — not permanent, lost if browser data is cleared
- AI learning data is per-browser, not shared across users
- No global stats on total user successes/failures
- Signal loading fails due to browser-side CoinGecko API rate limits and CORS issues
- Backend has `getCoinGeckoPage` and `getBingXSymbols` but frontend fetches CoinGecko directly from browser

## Requested Changes (Diff)

### Add
- Backend permanent storage for registered users (all accounts, passwords, credits, expiry)
- Backend permanent per-user storage: tracked trades keyed by user UID
- Backend permanent shared AI learning store (common across all users, grows over time)
- Backend permanent global trade stats: total hits and misses across all users
- Backend APIs: saveUsers/getUsers, saveTrackedTrades/getTrackedTrades, saveAILearning/getAILearning, recordGlobalOutcome/getGlobalStats
- Frontend global stats display in AI Dashboard and Admin panel

### Modify
- AuthContext: load/save user list from backend instead of localStorage
- TrackingPage: load/save tracked trades from backend keyed by uid (falls back gracefully for guests)
- aiLearning.ts: sync AI learning data to/from backend (shared store)
- ScanContext: use backend `getCoinGeckoPage` HTTP outcall instead of direct browser fetch to fix rate-limit/CORS signal loading errors

### Remove
- Direct CoinGecko fetches from browser in ScanContext (replaced by backend outcall)

## Implementation Plan
1. Expand Motoko backend with stable storage maps for: users (Text), trackedTrades (Map uid→Text), aiLearning (Text), globalStats (hits Nat, misses Nat)
2. Add query/update methods for each storage area
3. Update ScanContext to call `backend.getCoinGeckoPage()` instead of direct fetch — fixes signals not loading
4. Update AuthContext to persist/load users via backend (with localStorage as fast cache)
5. Update TrackingPage to save/load per-user trades via backend
6. Update aiLearning.ts to sync outcomes to shared backend AI learning store
7. Update AdminPage and DashboardPage to show global stats (total users' hits/misses)
