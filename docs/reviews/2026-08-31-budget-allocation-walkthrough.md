# Nested budget allocation walkthrough — 2026-08-31

## Scope

This slice extracts exact bigint budget allocation into a pure domain
calculator and wires the in-memory budget projection to it. A `BY_CHILDREN`
parent now derives its recurring allocation from child guardrails, while
totals count the parent scope once instead of adding parent and child amounts.
Fixed allocations are applied before percentage guardrails.

## Non-goals

- `SHARED_POOL` and full `HYBRID` flexible-pool UX still need persisted parent
  scope metadata and editor behavior.
- Budget revisions, funded-cap ownership, rollover writes, and PostgreSQL
  constraints remain open.

## Affected files and modules

- `backend/src/core/domain/budget-allocation.ts` and its spec — pure allocation
  and nested-scope rules using bigint.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — projection
  wiring, category depth resolution, and de-duplicated totals.
- `backend/src/core/application/core.service.spec.ts` — nested projection
  integration coverage.
- Phase 4/index docs and this walkthrough.

## Business rules

- Percentage allocation uses the period base after fixed root allocations and
  excludes rollover.
- A nested constraint is a drill-down allocation and does not contribute a
  second time to period totals.
- `BY_CHILDREN` parent allocation is derived from child direct allocations.
- Financial amounts never use floating-point arithmetic.

## Data flow

```text
budget period + category constraints
 -> pure bigint allocation calculator
 -> category actuals from visible classified expense lines
 -> root-scope totals + child drill-down projections
```

## Public API and UI behavior

Existing `GET /v1/workspaces/:workspaceId/budgets/:month` response fields are
preserved. The `allocated`, `actual`, `remaining`, and totals fields now avoid
nested double-counting; no UI changes were required.

## Migration and security implications

No migration is added. A durable adapter must store parent/child category
relationships and calculate root scopes under the requesting member's
visibility policy before exposing aggregates.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Domain and Core service Jest suites: passed (19 tests).
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Model and validate explicit shared-pool/hybrid parent caps and flexible
   remainder in persistence.
2. Add revision/close/reopen and audited rollover integration tests.
3. Add UI nested budget editor and hidden-account aggregate leak tests.

## Commit message

`feat(budget): prevent nested allocation double counting`

The body should mention bigint allocation order and parent-scope totals.
