# Ledger balance views walkthrough — 2026-08-31

## Scope

This slice adds an explicit balance-view API that separates `ledger`,
`cleared`, and `reconciled` amounts while preserving the existing rebuild
endpoint for compatibility. The in-memory MVP currently has no pending bank
clearing state, so all manually posted journals are represented consistently
in each view.

## Non-goals

- This does not invent clearing or reconciliation state for imported records.
- Durable checkpoints, Prisma projections, and provider pending transactions
  remain deferred until the database preflight and reconciliation persistence
  work are complete.
- Account response compatibility is unchanged; `balanceMinorUnits` remains a
  ledger convenience field.

## Affected files and modules

- `backend/src/core/application/core.service.ts` — detailed balance-view
  response and application mapping.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — rebuild
  projection now filters inactive, system, and account-inaccessible rows.
- `backend/src/core/presentation/core.controller.ts` —
  `GET /v1/workspaces/:workspaceId/balances`.
- `backend/src/core/application/core.service.spec.ts` — separated-view and
  hidden-account authorization coverage.
- `contracts/openapi.json` — balance-view endpoint and MoneyDto response
  contract.
- `docs/implementation-plan/phases/03-LEDGER-ACCOUNTS-TRANSACTIONS.md` and
  `docs/implementation-plan/README.md` — evidence and index links.

## Business rules

- A balance projection is tenant-scoped and includes only active, non-system
  accounts visible to the requesting member.
- Owner-only and include-only account policies are applied before returning an
  aggregate projection, preventing hidden-account balance leakage.
- All amounts remain VND minor-unit strings; no floating-point conversion is
  introduced.
- Until a clearing/checkpoint model exists, posted manual journal amounts are
  deterministically exposed as ledger, cleared, and reconciled views.

## Data flow

```text
GET balance views
 -> workspace membership + account permission
 -> journal-based rebuild with account visibility filter
 -> MoneyDto mapping for ledger/cleared/reconciled fields
```

## Public API and UI behavior

`GET /v1/workspaces/:workspaceId/balances` returns an array of
`{ accountId, ledger, cleared, reconciled }`, where each amount is a
`MoneyDto`. No UI was changed in this backend contract slice; web clients can
consume the endpoint without parsing an untyped numeric field.

## Migration and security implications

No migration is added. A production adapter must derive all three views from
durable journals and reconciliation checkpoints, retain tenant constraints,
and apply the same account-scope policy before calculating aggregates. The
visibility filter closes a previously possible hidden-account leak in the
rebuild endpoint.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Core service Jest suite: passed (16 tests).
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add cleared/reconciled checkpoint fields and import pending-state semantics
   after Phase 0 database preflight.
2. Add persistence constraints and projection rebuild integration tests.
3. Add web balance cards and stale/freshness indicators using this contract.

## Commit message

`feat(ledger): expose scoped balance views`

The body should mention the ledger/cleared/reconciled contract and the hidden
account filtering on rebuild projections.
