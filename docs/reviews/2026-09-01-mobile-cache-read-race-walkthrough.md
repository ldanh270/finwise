# Mobile cache read race walkthrough — 2026-09-01

## Scope and non-goals

This slice closes a workspace-isolation race in mobile cache reads. Overview,
accounts, transactions, new-transaction account loading, and budgets now ignore
an asynchronous SQLite result after their workspace/user effect has been
superseded. It does not change the server API, cache key format, query
invalidation, or financial calculations.

## Affected files and modules

- `mobile/app/(app)/index.tsx` — guarded overview/balance snapshot hydration.
- `mobile/app/(app)/accounts.tsx` — guarded account snapshot hydration.
- `mobile/app/(app)/transactions.tsx` — guarded transaction snapshot hydration.
- `mobile/app/(app)/transaction/new.tsx` — guarded account options hydration.
- `mobile/app/(app)/budgets.tsx` — guarded budget snapshot hydration.
- Phase 8 plan and implementation-plan index — delivery record.

## Business rules and data flow

```text
workspace/user scope changes
  -> cleanup marks the old effect inactive
  -> old SQLite read may finish, but cannot update React state
  -> new scope reads its own partition and renders only current data
```

The existing user/workspace cache partition remains the first isolation barrier;
the lifecycle guard is the second barrier for in-flight read completions. Writes
from an old scope still target their own key and cannot authorize or mutate the
new scope.

## Public API and UI behavior

No HTTP, OpenAPI, or route contract changed. Fast workspace switches now keep
the screen empty/loading or on the new scope's snapshot until its own read
completes; stale data from the previous scope is never reintroduced by a late
promise callback.

## Schema, migration, and security implications

No database or local schema migration. No tokens or additional sensitive data
are introduced. This is a client-side confidentiality hardening measure and
does not replace backend workspace authorization.

## Verification

- `pnpm --filter mobile format` — pass.
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile test -- --runInBand` — pass (11 suites, 39 tests).
- `pnpm --filter mobile export:android` — pass.
- `pnpm --filter mobile export:ios` — pass.

## Known gaps and follow-up

Physical-device workspace switching under weak network and process death
remains a native Phase 8 gate. Component-level interaction tests can be added
when a React Native testing renderer is introduced; the lifecycle behavior is
currently enforced at each route boundary and covered by the existing cache
partition/query-scope tests.

## Commit message

```text
fix(mobile): ignore stale workspace cache reads

Guard asynchronous cache hydration so a superseded workspace cannot reinsert
old account, transaction, overview, or budget data after a fast switch.
```
