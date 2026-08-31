# Mobile outbox persistence adapter walkthrough

Date: 2026-08-31
Phase: 8 — React Native mobile
Status: Implemented as a provider-neutral sync/persistence boundary; native runtime gates remain.

## Scope and non-goals

This slice connects the mobile outbox command shape to the generated API client's manual-transaction operation and adds a validated JSON snapshot adapter that can restore queued drafts after process restart. It keeps all state partitioned by user/workspace and preserves the stable `clientCommandId` as the server idempotency key.

It does not add Expo screens, Supabase SecureStore session wiring, SQLite tables, background sync, native development builds, or physical-device verification.

## Affected files and modules

- `mobile/src/sync/online-sync.ts` — structural generated-client adapter.
- `mobile/src/sync/outbox-persistence.ts` — storage port, snapshot serialization, and defensive restore validation.
- `mobile/src/sync/outbox.spec.ts` — adapter and process-restart coverage.
- `mobile/src/index.ts` and `mobile/README.md` — public exports and runtime boundary notes.

## Business rules

- Only manual income/expense drafts can use the offline outbox; transfers and corrections remain online-only.
- A queued draft never changes confirmed balances. Sync posts exact VND minor-unit strings and returns the server transaction ID before marking the record synced.
- Retries reuse the original `clientCommandId`; no new key is generated during sync.
- Snapshot restore rejects malformed JSON or records instead of silently accepting corrupted financial workflow state.
- Storage is addressed through an injected key supplied by the user/workspace cache partition; the adapter has no global account or token state.

## Data flow

```text
draft -> ManualDraftOutbox -> ApiManualDraftSync -> generated API client
       -> server transaction id -> SYNCED
store snapshot -> JSON storage key -> validate -> in-memory outbox after restart
```

The adapter is deliberately unaware of Expo, AsyncStorage, SQLite, Supabase, or React Native APIs. Those implementations can satisfy the small ports at the app edge.

## Public API and UI behavior

`ApiManualDraftSync` implements `ManualDraftSyncPort` using the generated client's `postManualTransaction(workspaceId, input, idempotencyKey)` shape. `PersistentOutboxSnapshot` exposes `load`, `save`, and `clear` over a minimal async key/value storage port. No mobile screen behavior changed in this slice; the existing Router shell remains the native UI boundary.

## Migration and security implications

No server/database migration is added. The snapshot contains workflow drafts and must be stored only in a user/workspace-partitioned local store. It must not contain access/refresh tokens or be included in logs/analytics. The production adapter should replace JSON snapshots with a transactional SQLite table while preserving the same validation and state semantics.

## Verification

- Mobile Jest via the repository's installed Jest runtime: 1 suite, 6 tests passed.
- Mobile TypeScript: passed with the repository TypeScript runtime and backend type roots; the mobile dependency install is absent in this checkout.
- Existing backend Jest suite: 9 suites, 42 tests passed before this mobile-only change.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Install mobile dependencies in a network-enabled environment and run the normal mobile typecheck command without fallback type roots.
2. Wire SecureStore-backed Supabase sessions and a real SQLite outbox with atomic draft persistence.
3. Add Expo online screens for OTP/bootstrap/workspace/accounts/transaction history and explicit offline/retry states.
4. Verify process death, weak network, logout protection, and duplicate retries on Android and iOS development builds.

## Phase commit message

```text
feat(mobile): add generated-client outbox adapter and persistence boundary

Connect manual drafts to the shared transaction contract and validate
user/workspace-partitioned snapshots so queued work survives process restart
without changing confirmed balances or idempotency keys.
```
