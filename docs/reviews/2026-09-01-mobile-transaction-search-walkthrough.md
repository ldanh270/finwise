# Mobile transaction search walkthrough — 2026-09-01

## Scope and non-goals

This slice adds a local transaction search field to the mobile Transactions
screen. It filters the server-authorized or workspace-partitioned cached
snapshot by description, type, status, effective date, transaction ID, and
exact VND minor-unit amount. It does not add a new endpoint, change account
visibility, alter confirmed balances, or implement server-side full-text
search.

## Affected files and modules

- `mobile/src/features/ledger/transaction-search.ts` — pure filter boundary.
- `mobile/src/features/ledger/transaction-search.spec.ts` — unit coverage.
- `mobile/app/(app)/transactions.tsx` — search input, result count, and empty
  match state.
- Mobile README, Phase 8 plan, and implementation-plan index — behavior and
  delivery record.

## Business rules and data flow

```text
Nest transaction list or authorized SQLite snapshot
  -> filterTransactions(query)
  -> rendered result list / no-match state
```

Search operates only on data the API already returned for the active user and
workspace. It cannot retrieve or infer hidden accounts, and an empty query
returns the original list in its existing order.

## Public API and UI behavior

No HTTP or OpenAPI change. Transactions now show a labeled search field. The
screen displays the filtered count and an actionable no-match message while
preserving loading, stale-cache, retry, and void behavior.

## Schema, migration, and security implications

No database or migration changes. Search is presentation-only and does not log
the query or send it to the server. Existing token, workspace partition, and
server-side authorization boundaries are unchanged.

## Verification

- `pnpm --filter mobile test -- --runInBand` — pass (9 suites, 34 tests).
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile export:android` — pass.
- `pnpm --filter mobile export:ios` — pass.

## Known gaps and follow-up

This is intentionally local search for the mobile daily workflow. A future
server-side search can add pagination and richer filters without changing the
pure UI boundary.

## Commit message

```text
feat(mobile): add authorized transaction search

Filter the existing workspace transaction snapshot locally by common daily
search fields while preserving server-owned visibility and ledger truth.
```
