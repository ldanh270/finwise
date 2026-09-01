# Mobile budget cache walkthrough — 2026-09-01

## Scope and non-goals

This slice adds offline/stale read continuity to the mobile Budgets screen.
Budget periods, categories, tags, and the selected monthly overview are stored
in the existing user/workspace SQLite cache and reused when their API requests
fail. It does not make budget mutations offline, change budget calculations,
create a second source of financial truth, or change the web budget behavior.

## Affected files and modules

- `mobile/src/cache/workspace-cache.ts` — injectable, serialized read-cache
  storage with budget fields.
- `mobile/src/cache/workspace-cache.spec.ts` — partition and concurrent-write
  coverage using an in-memory storage fake.
- `mobile/app/(app)/budgets.tsx` — stale snapshot loading, explicit warnings,
  and cache writes around the existing planning services.
- `mobile/README.md` — mobile cache behavior documentation.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` and the planning
  index — Phase 8 delivery record.

## Business rules and data flow

```text
authenticated user/workspace
  -> read budget-period/category/tag/overview queries
  -> write successful snapshots to the scoped SQLite cache
  -> API failure with cached data -> render snapshot + stale warning
  -> budget create/category/tag/close -> online API only
```

The cache key is derived from both the authenticated user and active workspace,
so switching either scope cannot reveal another tenant's budget data. Cached
values are presentation continuity only; the server remains authoritative for
constraints, actual spending, rollover, and all ledger effects. Writes are
serialized per cache instance so concurrent query completions merge instead of
overwriting unrelated fields.

## Public API and UI behavior

No HTTP, OpenAPI, or backend contract changed. The existing generated planning
operations are unchanged. The mobile screen now:

- renders cached plans/categories/tags when the corresponding API read fails;
- displays an explicit stale warning instead of silently presenting old data;
- renders a cached selected-month overview with a warning when detail refresh
  fails; and
- keeps create/close/category/tag mutations in the existing online-only flow.

## Schema, migration, and security implications

No server database migration is required. The local JSON cache payload gains
optional budget fields and remains backward-compatible with existing snapshots.
The cache is partitioned by authenticated user/workspace and contains no
access or refresh tokens. Existing logout cleanup and workspace-switch removal
continue to govern lifecycle; cached budget values are never used to authorize
requests or change confirmed balances.

## Verification

- `pnpm --filter backend build` — pass (`nest build`, 0 compile errors).
- `pnpm --filter mobile format` — pass.
- `pnpm format:check` — pass.
- `pnpm typecheck` — pass (API client, backend, frontend, mobile).
- `pnpm --filter mobile test -- --runInBand` — pass (11 suites, 39 tests).

## Known gaps and follow-up

Physical Android/iOS device verification, process-death cache recovery, and
native CNG builds remain Phase 8 release gates. Only the selected monthly
overview is retained per cache write; a future cache policy can retain a
bounded history of months if product needs multi-month offline browsing.

## Commit message

```text
feat(mobile): cache budget workspace reads

Persist budget planning snapshots in the user/workspace SQLite partition and
show explicit stale states when the API is unavailable without changing the
online-only mutation or server-authoritative ledger rules.
```
