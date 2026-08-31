# Web budget planning walkthrough

Date: 2026-08-31
Phase: 4 — Classification, budgeting, and reporting
Status: Implemented as a web planning boundary; split classification, durable rollover, goals, and full reports remain.

## Scope and non-goals

The dashboard Budgets section now manages a two-level category tree and tags, creates a monthly soft budget with explicit allocation mode/fixed/percentage/rollover inputs, lists periods, displays actual/remaining projections, and explicitly closes a period.

It does not add transaction split/tag editing, persisted rollover revisions, savings goals, report charts, or PostgreSQL repositories.

## Affected files and modules

- `frontend/src/lib/api/contracts.ts` — category, tag, budget-period, constraint, and overview response contracts/guards.
- `frontend/src/lib/api/client.ts` — typed category/tag/budget operations.
- `frontend/src/features/budget/budget-service.ts` — parallel planning reads and command wrappers.
- `frontend/src/features/budget/budget-page.tsx` — category/tag forms, monthly editor, period selector, overview, close action, and state feedback.
- `frontend/src/features/dashboard/dashboard-page.tsx` and `frontend/app/globals.css` — feature mounting, navigation, and responsive layout.

## Business rules

- Category creation offers root or one-level parent selection; backend remains authoritative for the two-level limit and workspace scope.
- Budget amounts and actuals remain `MoneyDto` minor-unit strings. The browser never uses floating-point financial arithmetic.
- `BY_CHILDREN`, `SHARED_POOL`, and `HYBRID` modes, fixed allocation, percentage basis points, and rollover mode are sent unchanged to the core use case.
- Budget periods are planning state: save/close does not move cash. Actual and remaining values come from the server's ledger/classification projection.
- Closing is explicit and the UI disables it after the server reports a non-open period.

## Data flow

```text
BudgetPage -> budget service -> categories/tags/periods in parallel
           -> selected period overview -> editor/overview projections
form command -> Nest core use case -> refreshed planning snapshot
```

All reads and writes use the selected workspace path and typed response validation.

## Public API and UI behavior

The client now covers `GET/POST /categories`, `GET/POST /tags`, `GET/POST /budgets`, `GET /budgets/:month`, and `POST /budgets/:month/close`. The page handles loading, no-workspace, empty, retryable error, action error, and success states. Period rows select a month; the overview shows allocated/actual/remaining totals and per-category constraints.

## Migration and security implications

No schema migration is added. Category/budget persistence remains the existing in-memory adapter. Server authorization, account visibility, and exact allocation validation remain authoritative; the client does not infer hidden actuals or mutate balances.

## Verification

- Frontend ESLint: passed.
- Frontend TypeScript: passed.
- Next production build: passed.
- Backend Jest: 11 suites, 46 tests passed before this frontend-only slice.
- OpenAPI JSON validation: passed.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add transaction classification split/tag UI with exact-sum validation and query invalidation.
2. Add rollover close/reopen/carry-adjustment workflow and persistence constraints.
3. Add permission-filtered report projections and charts with hidden-account aggregate tests.
4. Replace manual budget rows with PostgreSQL-backed revisions after Phase 0 evidence.

## Phase commit message

```text
feat(web): add category and budget planning workspace

Expose scoped category/tag management, monthly soft-budget editing, projection
overview, and explicit period close while preserving exact minor-unit values and
server-derived actuals.
```
