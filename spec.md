# Luxia Crypto Trade

## Current State
- Backend canister has all storage methods: saveUsers/getUsers, saveTrackedTrades/getTrackedTrades, saveAILearning/getAILearning, saveCoinProfiles/getCoinProfiles, AI skill logs, global stats.
- `backendStorage.ts` wraps all canister calls with fire-and-forget semantics, silently swallowing errors.
- `AuthContext.tsx` loads backend users on mount and merges with localStorage, but does NOT save the merged result back to the backend.
- `AdminPage.tsx` `createUser()`/`deleteUser()` read directly from `getUsers()` (localStorage) instead of using component `users` state — creating a race condition: if backend load hasn't completed, newly created users overwrite backend data.
- When credit edits are saved, `setUsers(getUsers())` re-reads localStorage, which may not reflect state.
- AI learning services save fire-and-forget; if canister is slow on first write, the call returns before data is committed.

## Requested Changes (Diff)

### Add
- After merging backend + local users in `AuthContext`, save merged data back to backend if the merged set has more users than what the backend returned (ensures local-only users get pushed).
- On first run when backend has no users, save DEFAULT_USERS to backend as bootstrap.
- In `AdminPage`, after credit save, re-read from `users` state (not localStorage) to reflect the update.

### Modify
- `AdminPage.tsx` `createUser()`: use `users` state instead of `getUsers()` to build the updated list — prevents race condition.
- `AdminPage.tsx` `deleteUser()`: use `users` state instead of `getUsers()`.
- `AdminPage.tsx` credit save button `onClick`: refresh `users` state from updated source.
- `AuthContext.tsx` backend load `useEffect`: after merging, call `saveUsersToBackend(merged)` if merged has more entries than backendUsers alone.
- `AuthContext.tsx` `seedUsers`: also trigger a backend bootstrap if backend returns empty.

### Remove
- Nothing removed.

## Implementation Plan
1. Fix `AdminPage.tsx`: `createUser` uses `users` state, `deleteUser` uses `users` state, credit save updates `users` state correctly.
2. Fix `AuthContext.tsx`: after backend merge, save merged list back to backend if it grew; bootstrap DEFAULT_USERS to backend if backend was empty.
3. Ensure AI data and tracked trades are re-synced on load using the same pattern (load backend → merge → save merged back).
