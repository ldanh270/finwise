# Mobile overview legacy-cache fix walkthrough — 2026-09-06

## Scope and non-goals

This slice fixes the mobile dashboard render crash caused by an older cached or
provider response that does not contain the newer `accountBalances` field. It
does not change the API contract, database schema, balance calculation, or
currency aggregation rules.

## Affected files

- `mobile/app/(app)/index.tsx` — consumes a compatibility-normalized balance
  list before rendering the dashboard card.
- `mobile/src/features/overview/overview-service.ts` — provides the boundary
  fallback for missing account balances.
- `mobile/src/features/overview/overview-service.spec.ts` — regression test for
  legacy overview snapshots.

## Business rules and data flow

```text
authorized overview/cache snapshot
  -> overview compatibility boundary
  -> accountBalances ?? []
  -> dashboard render
```

Current server responses still provide `accountBalances`. A stale local cache
is read-only presentation data, so a missing optional field renders no
currency-breakdown rows while the server remains authoritative for balances.

## Public API and UI behavior

No endpoint, payload, or generated type changed. The dashboard no longer throws
`Cannot read property 'length' of undefined` when opening a workspace with a
legacy cached overview; it renders the total and other overview cards normally.

## Migration and security implications

No migration or data rewrite is required. The fallback does not alter cached
financial values, authorization, account visibility, or credentials.

## Verification

- `pnpm --filter mobile test` — pass (21 suites, 63 tests).
- `pnpm --filter mobile test:native-config` — pass (3 tests).
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile export:android` — pass (Hermes bundle exported).
- `pnpm --filter mobile export:ios` — pass (Hermes bundle exported).
- `pnpm typecheck` — pass.
- `npm run build` — pass (backend and frontend).
- `npm run lint` — pass.
- `npm run format:check` — pass.
- `npm run contracts:check` — pass.
- `npm test` — pass (18 suites, 67 tests).
- `npm run test:e2e` — pass (4 tests).

## Known gaps and follow-up

The exports verify JavaScript bundles on Windows; physical-device rendering
and native signed builds remain the Phase 8 device/operations gates.

## Commit message

```text
fix(mobile): tolerate legacy overview cache balances

Prevent stale overview snapshots without accountBalances from crashing the
dashboard while preserving the current API and currency presentation.
```
