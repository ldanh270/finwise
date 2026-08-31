# Mobile outbox scaffold walkthrough — 2026-08-31

## Scope

This slice establishes the React Native/Expo package boundary and the first
offline-safe domain contracts. The app metadata uses Expo Router, development
builds, CNG/Prebuild, typed routes, and the New Architecture. The pure
TypeScript outbox accepts only manual income/expense drafts, partitions records
by user/workspace, keeps a stable command id for retries, and blocks logout
until every record is synced or explicitly discarded.

## Non-goals

- No Supabase SecureStore adapter, SQLite persistence, generated-client screen,
  receipt staging, background sync, or device build is shipped in this slice.
- Transfer, correction, approval, import, reconciliation, and any confirmed
  balance mutation remain online-only by contract.

## Affected files and modules

- `mobile/package.json`, `mobile/app.json`, `mobile/app/*` — Expo Router/CNG
  scaffold and platform identifiers.
- `mobile/src/sync/outbox.ts` — outbox store port, state transitions, exact VND
  validation, stable idempotency key, retry/action-required and logout guard.
- `mobile/src/session/cache-partition.ts` — user/workspace cache partition key.
- `mobile/src/sync/outbox.spec.ts` — retry/idempotency and logout safety tests.
- `mobile/jest.config.cjs`, `mobile/tsconfig.json`, `mobile/README.md` — local
  test/typecheck workflow and security constraints.

## Business rules

- Offline drafts are positive VND minor-unit strings and never use floating
  point arithmetic.
- Only `income` and `expense` can be created offline; the server remains the
  source of truth for balances.
- Reusing a `clientCommandId` with different command data is rejected. The same
  id is the idempotency key for every retry.
- `NEEDS_USER_ACTION` and `RETRYABLE_FAILURE` remain pending for logout. A
  discarded draft is terminal but has no server transaction id.
- Cache keys include both user and workspace; no token is stored by this
  module.

## Data flow

```text
manual form draft -> LOCAL_DRAFT -> QUEUED -> SYNCING
  -> SYNCED(server transaction id)
  -> RETRYABLE_FAILURE(requeue) | NEEDS_USER_ACTION
```

The `OutboxStore` port is intentionally persistence-neutral. The next adapter
will commit a draft and SQLite outbox row atomically, then call the generated
Nest client with `idempotencyKeyFor(clientCommandId)`.

## Public API and UI behavior

The package exports `ManualDraftOutbox`, `InMemoryOutboxStore`,
`createCachePartition`, and `idempotencyKeyFor`. The initial route is a minimal
shell so Expo can resolve navigation while feature screens are added online
first. No UI presents a queued draft as confirmed balance.

## Migration and security implications

This is an additive mobile package; it does not alter backend schema or ledger
semantics. Expo native projects must be generated with Prebuild/CNG and not
hand-edited. Supabase tokens must be wired through SecureStore in the next
slice and excluded from AsyncStorage, SQLite, query caches, logs, and crash
breadcrumbs.

## Verification

- Mobile TypeScript check: passed with the repository TypeScript toolchain.
- Mobile Jest outbox suite: passed (2 tests).
- Mobile Prettier check: passed using the available backend formatter binary.
- Repository `git diff --check`: passed.

Expo dependency installation and iOS/Android development builds remain
unverified because the current workspace has no mobile node_modules and root
pnpm installation is blocked by the configured package release-age policy.

## Known gaps and follow-up

1. Install Expo dependencies and generate native projects on a dev machine or
   CI runner; verify physical Android/iOS builds.
2. Replace `InMemoryOutboxStore` with an encrypted SQLite adapter and add
   process-death/restart tests.
3. Add SecureStore auth restore, generated API client, online account/history
   screens, sync worker, and explicit stale/offline UI states.

## Commit message

`feat(mobile): scaffold Expo outbox contracts`

The body should call out the controlled offline scope, stable idempotency key,
cache partitioning, and the fact that native dependency/device verification is
still pending.
