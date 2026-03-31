# Luxia Crypto Trade

## Current State

All backend canister methods are defined in `src/backend/main.mo` (saveUsers, getUsers, saveTrackedTrades, getTrackedTrades, saveAILearning, getAILearning, saveCoinProfiles, getCoinProfiles, saveAISkillLog, getAISkillLog, saveAIParamHistory, getAIParamHistory, saveAIRewriteLog, getAIRewriteLog, recordGlobalOutcome, getGlobalStats, getBingXSymbols, getCoinGeckoPage).

However:
1. `src/frontend/src/declarations/backend.did.js` defines `IDL.Service({})` — completely empty. No methods exist in the IDL.
2. `src/frontend/src/declarations/backend.did.d.ts` has `export interface _SERVICE {}` — empty.
3. `src/frontend/src/backend.ts` — `Backend` class has no method implementations. Just a constructor.
4. Because of #1-3, every `actor.getUsers()` / `actor.saveUsers()` etc call silently throws and returns empty string from the catch block in `backendStorage.ts`.
5. `AuthContext.tsx` `login()` is synchronous and only reads localStorage. On a new device, localStorage is empty until the async backend sync completes. User can't login before that completes.

## Requested Changes (Diff)

### Add
- Proper IDL service definition in `backend.did.js` and `backend.did.d.ts` for all canister methods
- Proper method proxy implementations in `Backend` class in `backend.ts`
- `usersLoaded` state in `AuthContext` to track when backend sync is done
- Async `login()` that fetches users from backend if not found in localStorage

### Modify
- `backend.did.js` — replace `IDL.Service({})` with full service definition matching `main.mo`
- `backend.did.d.ts` — replace empty `_SERVICE` with typed interface matching all methods
- `backend.ts` — add all method proxy implementations to `Backend` class
- `AuthContext.tsx` — make `login` async, add backend fallback when user not found locally
- `LoginModal.tsx` — already calls `login` with await; update error message and loading state

### Remove
- Nothing removed

## Implementation Plan

1. **Fix `backend.did.js`** — add full IDL factory matching `main.mo` methods:
   - `saveUsers(Text) -> ()`
   - `getUsers() -> (Text)` query
   - `saveTrackedTrades(Text, Text) -> ()`
   - `getTrackedTrades(Text) -> (Text)` query
   - `saveAILearning(Text) -> ()`
   - `getAILearning() -> (Text)` query
   - `saveCoinProfiles(Text) -> ()`
   - `getCoinProfiles() -> (Text)` query
   - `saveAISkillLog(Text) -> ()`
   - `getAISkillLog() -> (Text)` query
   - `saveAIParamHistory(Text) -> ()`
   - `getAIParamHistory() -> (Text)` query
   - `saveAIRewriteLog(Text) -> ()`
   - `getAIRewriteLog() -> (Text)` query
   - `recordGlobalOutcome(Text) -> ()`
   - `getGlobalStats() -> (Text)` query
   - `transform(TransformArgs) -> (HttpResponsePayload)` query
   - `getBingXSymbols() -> (Text)`
   - `getCoinGeckoPage(Nat) -> (Text)`

2. **Fix `backend.did.d.ts`** — add proper `_SERVICE` interface with `ActorMethod` types for all methods.

3. **Fix `backend.ts`** — add `async` method proxy implementations to `Backend` class for all methods in `backendInterface`. Each method calls `(this.actor as any).methodName(args)` wrapped in try/catch with `processError`.

4. **Fix `AuthContext.tsx`** — make `login` async:
   - Try to find user in current localStorage users
   - If not found: explicitly call `loadUsersFromBackend()` to force fresh sync, then try again
   - Add `usersLoading` state (true while initial backend sync is in progress)
   - Expose `usersLoading` so login button can show 'Loading accounts...' while syncing

5. **Fix `LoginModal.tsx`** — show loading state when `usersLoading` is true ("Syncing accounts..." message)
