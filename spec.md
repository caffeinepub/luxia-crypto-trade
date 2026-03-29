# Luxia Crypto Trade

## Current State
- AI learning (aiLearning.ts), coin profiler (coinProfiler.ts), and AI skill engine (aiSkillEngine.ts) all use localStorage as primary storage. Backend is only a secondary fire-and-forget sync.
- On a new device, these services start with empty localStorage — all AI knowledge is lost.
- Users, tracked trades, and global stats are already backed by canister but AI-related data is not.
- Login modal inputs have text-white class but browser autofill may override to make typed text invisible.

## Requested Changes (Diff)

### Add
- Canister endpoints for coinProfiles, aiSkillLog, paramHistory, rewriteLog
- Load-from-backend on startup for coinProfiler, aiSkillEngine, aiLearning (blocking init before first use)
- Signal engine improvements persisted permanently to canister
- CSS fix for login input autofill: `-webkit-text-fill-color` and caret-color to ensure text always visible

### Modify
- backend/main.mo: add stable vars and public functions for coinProfiles, aiSkillLog, paramHistory, rewriteLog
- backendStorage.ts: add helpers for new canister endpoints
- aiLearning.ts: load from canister first, fall back to localStorage
- coinProfiler.ts: load from canister first, fall back to localStorage; sync on every save
- aiSkillEngine.ts: load from canister first, fall back to localStorage; sync on every save
- LoginModal.tsx: fix input visibility with explicit color styles and autofill overrides

### Remove
- Nothing removed

## Implementation Plan
1. Update backend main.mo with new stable vars and CRUD functions for coinProfiles, skillLog, paramHistory, rewriteLog
2. Update backendStorage.ts with new helper functions
3. Update aiLearning.ts, coinProfiler.ts, aiSkillEngine.ts to load from canister on init
4. Fix LoginModal.tsx input text visibility
