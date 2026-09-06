# Budget as the only transaction classification walkthrough

## Scope

This slice removes the active `Category` concept from Finwise's core ledger
classification flow. A `Budget` is now both the user-facing transaction bucket
and the monthly spending-plan bucket. A transaction may remain unassigned.

## Non-goals

- No bank-provider linking or sync behavior was added.
- Tags remain optional cross-cutting metadata.
- Historical allocation lines and budget buckets are not hard-deleted.
- The transitional in-memory core was not replaced with durable repositories.

## Affected modules

- Backend domain/application/store/controller and core/e2e tests.
- Shared API client, frontend contracts/client, Expo validation and offline
  outbox transport.
- Web budget planning, dashboard, reports, and transaction quick-add.
- Mobile budget planning, reports, transaction quick-add, transaction detail,
  cache, and offline sync.
- OpenAPI contract and active classification/budget requirements.

## Business rules

- Budget buckets have stable IDs, optional parent buckets, and active/archived
  lifecycle state.
- Monthly constraints use `budgetId`; descendant actuals roll up through budget
  parents.
- Quick-add income/expense accepts optional `budgetId` and creates one immutable
  allocation line for the full amount in the same application operation.
- Transfers and opening balances do not accept or consume a budget.
- Split allocation lines remain positive and must sum exactly to the journal
  amount. An unassigned transaction does not consume a monthly constraint.
- Account balances remain independent from planning allocations.

## Data flow

```text
budget bucket -> monthly budget constraint -> transaction budget allocation
                                             -> actual / remaining projection
```

The server validates workspace ownership, lifecycle state, leaf posting rules,
line totals, and tag ownership. If allocation creation fails after journal
posting, the transitional store reverses the posted journal before returning
the error.

## Public API and UI behavior

- `GET/POST /v1/workspaces/:workspaceId/budgets` manages budget buckets.
- `/budget-periods` manages monthly plans; constraints expose `budgetId`.
- Reports expose `budgets` and `budgetId`.
- Transaction creation accepts optional `budgetId`; classification lines expose
  `budgetId`.
- Web and mobile quick-add show one optional `Budget` selector for income and
  expense, with `Unassigned` as the default. Transfers hide the selector.
- Budget planning and report screens use budget names, not category names.

## Migration and security implications

The current production-shaped Prisma schema has no active category model; the
core feature still uses its documented in-memory transitional adapter. Legacy
migration SQL and old dated walkthroughs are preserved as historical records
and are not used by the new routes. New API paths validate budget and workspace
ownership server-side, and archived buckets cannot receive new allocations.

## Verification

- Backend unit: 16 suites, 60 tests passed.
- Backend e2e: 1 suite, 4 tests passed.
- Mobile Jest: 19 suites, 61 tests passed.
- Backend/shared/mobile/frontend typechecks passed.
- Backend format check, mobile format check, frontend lint passed.
- Backend and frontend production builds passed; frontend build required network
  access for Next Google Fonts.
- OpenAPI validation passed: 96 unique operations and 11 idempotent financial
  commands checked.
- `git diff --check` passed.

## Known gaps and follow-up

- Durable Prisma repositories and migrations for budget allocation persistence
  remain a later phase; this slice preserves the existing transitional store.
- The UI supports a single quick-add budget and existing split-line editing;
  richer allocation editing remains online-only and server-authoritative.
- Bank linking/sync remains outside this slice.
