# Mobile workspace switch isolation walkthrough — 2026-09-01

## Scope and non-goals

This slice hardens workspace switching so the active scope changes immediately,
old workspace transport requests are aborted, and old workspace query data is removed
without clearing bootstrap or the new workspace's queries. It does not change
server authorization, cache storage format, workspace membership, or ledger
behavior.

## Affected files and modules

- `mobile/src/ui/app-shell.tsx` — switch orchestration and scoped query cleanup.
- `packages/api-client/src/index.ts` — workspace request tracking and transport
  cancellation.
- `mobile/src/app/workspace-query-scope.ts` — pure query-key scope predicate.
- `mobile/src/app/workspace-query-scope.spec.ts` — isolation unit coverage.
- `mobile/src/index.ts` — exports the shared pure boundary.
- Phase 8 plan and implementation-plan index — delivery record.

## Business rules and data flow

```text
workspace chip press
  -> immediately select next workspace (old data cannot render)
  -> abort transport requests keyed to previous workspace
  -> cancel query observers
  -> remove previous workspace query cache
  -> new workspace routes fetch/cache their own data
```

The global `bootstrap` query remains available for the workspace picker. Query
cleanup matches only the workspace ID in the second query-key segment, so a
new workspace request cannot be accidentally removed during the switch.

## Public API and UI behavior

No HTTP, OpenAPI, or route contract changed. Switching a workspace now clears
the previous scope's visible query state and starts the selected workspace's
loading lifecycle; the existing picker and feature screens remain unchanged.

## Schema, migration, and security implications

No database or migration changes. The server remains the authorization boundary;
this client-side cleanup prevents stale data display but never grants access.
The per-user/per-workspace SQLite cache partition remains unchanged.

## Verification

- `pnpm --filter mobile test -- --runInBand` — pass (10 suites, 37 tests).
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile export:android` — pass.
- `pnpm --filter mobile export:ios` — pass.

## Known gaps and follow-up

Physical-device workspace-switch testing remains part of the Phase 8 release
gate, including weak-network and process-death scenarios.

## Commit message

```text
fix(mobile): isolate workspace switch query state

Cancel and remove only the previous workspace's requests while changing the
active scope immediately so stale financial data cannot render across tenants.
```
