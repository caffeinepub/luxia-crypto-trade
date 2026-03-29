# Luxia Crypto Trade

## Current State
Tracked trades for non-guest users are stored under a shared localStorage key `luxia_tracked_trades` — not scoped by user UID. When User A logs in, tracks trades, then User B logs in on the same device, User B loads from the same key and sees User A's data.

The backend canister already implements correct per-user isolation (`saveTrackedTrades(uid, data)` / `getTrackedTrades(uid)`). The bug is purely in the frontend localStorage key.

Files involved:
- `src/frontend/src/components/LiveSignalCard.tsx` — uses `luxia_tracked_trades` for all logged-in users
- `src/frontend/src/pages/TrackingPage.tsx` — same shared key; loads, persists, and falls back to it

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- `LiveSignalCard.tsx`: Change tracked trades storage key from `luxia_tracked_trades` to `luxia_tracked_${user.uid}` for all non-guest users
- `TrackingPage.tsx`: Same key change for TRACKED_KEY constant, load fallback, and persist helper
- On logout (in AuthContext or on user switch), ensure the old user's data is not inadvertently read by the new session (already handled by scoped keys)

### Remove
- Nothing

## Implementation Plan
1. In `LiveSignalCard.tsx`: replace the hardcoded `"luxia_tracked_trades"` with `\`luxia_tracked_${user.uid}\``
2. In `TrackingPage.tsx`: replace `TRACKED_KEY` constant with a dynamic key `\`luxia_tracked_${user.uid}\``, update all references including the backend load fallback
3. Validate and build
