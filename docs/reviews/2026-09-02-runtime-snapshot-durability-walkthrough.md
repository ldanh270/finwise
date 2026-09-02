# Runtime snapshot durability walkthrough

Date: 2026-09-02  
Phase: 3 — Accounts and immutable ledger / platform persistence  
Status: Implemented as a transitional durability barrier; normalized persistence is not claimed complete

## Scope and non-goals

This slice closes the crash-after-response gap in the current runtime snapshot
adapter. A request that mutates a persistent store now waits for the queued
PostgreSQL upsert before the HTTP response is returned, and the exception
pipeline can report a failed snapshot write. It does not replace the JSON
snapshot with normalized bounded-context repositories, solve multi-instance
concurrency, or introduce a queue/worker.

## Affected files and modules

- `backend/src/shared/infrastructure/prisma-runtime-snapshot.repository.ts` —
  tracks queued write failures and exposes a failing flush.
- `backend/src/shared/presentation/runtime-snapshot-flush.interceptor.ts` —
  request boundary that awaits snapshot durability.
- `backend/src/app.module.ts` — registers the interceptor globally.
- `backend/src/shared/presentation/runtime-snapshot-flush.interceptor.spec.ts` —
  success and failure propagation tests.

## Business rules and data flow

The in-memory bounded-context stores remain the domain/application source for
this transitional release. Their proxy schedules a namespace snapshot after a
mutation. Nest's global interceptor awaits the shared write queue after the
handler completes. If an upsert fails, the failure is retained and propagated
through the normal HTTP error filter rather than returning a false success.

```text
command -> application use case -> store mutation
        -> queued namespace snapshot upsert
        -> handler response waits for flush
        -> success only after persistence, error otherwise
```

## Public API and UI behavior

No endpoint shape changed. Existing account, transaction, budget, Group
Treasury, import, and reconciliation commands retain their contracts; their
success response now implies that the transitional snapshot write completed.
The web/mobile clients need no changes.

## Migration and security implications

No database migration is required. The adapter continues to use the existing
`FinwiseRuntimeSnapshot` table and namespace rows. Error messages remain behind
the existing typed exception filter, and the implementation does not log
payloads or credentials. Because the adapter is still a single JSON snapshot,
operators must not treat this as a multi-replica production persistence design.

## Verification

- Backend typecheck: passed.
- Backend tests: passed (16 suites, 58 tests).
- Interceptor unit tests cover successful flush and propagated persistence
  failure.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Replace runtime snapshots with normalized Prisma repositories and database
   transactions per bounded context before horizontal scale-out.
2. Add repository integration tests against PostgreSQL/Cockroach-compatible
   environments, including row locks and rebuildable projections.
3. Add retry/alert policy at the operations layer once background workers are
   introduced.

## Commit message

```text
fix(persistence): await runtime snapshot durability

Wait for queued PostgreSQL snapshot writes before returning HTTP success and
propagate persistence failures through the standard error pipeline.
```
