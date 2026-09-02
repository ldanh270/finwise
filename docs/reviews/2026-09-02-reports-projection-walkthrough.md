# Reports projection walkthrough

Date: 2026-09-02  
Phase: 4 — Classification, budgeting and reporting  
Status: Implemented for the MVP ledger/report surface

## Scope and non-goals

This slice replaces the web and mobile Reports placeholders with a
permission-filtered monthly movement and category-spending report. It reads
posted income/expense journals and immutable classification lines through the
existing application boundary. It does not add charting, scheduled exports,
wealth analytics, or a second reporting database.

## Affected files and modules

- `backend/src/core/domain/report.ts` — pure bigint report projection.
- `backend/src/core/application/core.service.ts` and `core.ports.ts` — report
  authorization and response mapping.
- `backend/src/core/presentation/core.controller.ts` — `GET /v1/workspaces/:workspaceId/reports`.
- `contracts/openapi.json` and `scripts/check-openapi.mjs` — public contract.
- `packages/api-client/src/index.ts` — shared client operation and DTOs.
- `frontend/src/features/reports/*` and dashboard wiring — web report UI.
- `mobile/src/features/reports/*` and `mobile/app/(app)/reports.tsx` — mobile
  report UI using the shared client.

## Business rules and data flow

The request first checks `report.read`, then obtains the already policy-filtered
transaction set and category set. Voided journals, transfers, adjustments, and
opening balances never enter income/spending totals. Expense classification
lines populate category totals; an unclassified expense is shown as
`Uncategorized`. Amounts remain bigint on the server and VND minor-unit strings
at the API boundary. A partial account scope is returned as an explicit
indicator; hidden accounts are not inferred in aggregates.

```text
GET reports?from=YYYY-MM&to=YYYY-MM
  -> report.read + workspace policy
  -> visible posted journal set
  -> bigint monthly/category projection
  -> MoneyDto response
  -> web/mobile loading, error, partial and report states
```

## Public API and UI behavior

`GET /v1/workspaces/{workspaceId}/reports` accepts optional `from` and `to`
month query parameters. When omitted, it returns the current month and the five
preceding months. The response includes totals, one row per month, category
spending, and `hasPartialAccess`.

Web and mobile expose month range inputs, refresh/retry actions, income,
spending and net totals, monthly rows, category spending, empty activity copy,
and a partial-access notice. No client performs financial aggregation.

## Migration and security implications

No migration is required because the projection reads existing journals and
classification state. The endpoint reuses server-side report permission and
account visibility checks, and does not expose hidden-account counts or raw
journal entries. Future normalized persistence can replace the store adapter
without changing this contract.

## Verification

- Backend report domain and application tests: passed (56 tests).
- Mobile tests: passed (60 tests, including report service delegation).
- Backend/frontend/mobile typecheck: passed.
- Backend and frontend production builds: passed.
- `pnpm format:check`: passed.
- `pnpm contracts:check`: passed (88 unique operations).
- `git diff --check`: passed.

## Known gaps and follow-up

1. Report charts and CSV report export remain follow-up UI slices; the current
   table is the accessible baseline.
2. The transitional runtime snapshot adapter is still the persistence seam;
   replacing it with normalized repositories remains a production gate.
3. Native iOS/Android physical-device verification remains an operations gate.

## Commit message

```text
feat(reports): ship permission-filtered ledger projections

Expose monthly and category report projections through the shared API contract
and replace the web/mobile Reports placeholders with usable stateful screens.
```
