# Finwise mobile engineering rules

- Expo Router files are route composition only; API calls and business rules
  live under `src/`.
- All confirmed balances and transactions come from the Nest `/v1` API. Mobile
  cache and outbox rows are workflow state, never a second ledger.
- Access and refresh tokens are stored only through the SecureStore adapter.
  Never log, cache, serialize, or put tokens in route params.
- Offline commands are limited to manual income/expense drafts and must retain
  one stable `clientCommandId` for every retry.
- Keep amounts as VND minor-unit strings. Do not use floating point arithmetic.
- Every data screen renders loading, empty, error, offline/stale, and denied
  states as applicable.
- Add a focused unit/component test for each new stateful feature and update
  the Phase 8 walkthrough when a slice is complete.
