# Budget-as-Classification Design

## Goal

Use one user-facing concept, `Budget`, for both transaction allocation and
monthly spending limits. Remove the separate `Category` concept from the
active domain, API contracts, web UI, mobile UI, and tests.

## Business rules

- A budget has a stable name, optional parent, and lifecycle status.
- A monthly budget period contains constraints that point to budgets.
- An expense can be allocated to one or more budget lines; line amounts must
  be positive and sum exactly to the transaction amount.
- An optional `budgetId` on quick-add creates one allocation line for the full
  transaction amount. Transfers do not accept a budget.
- Budget actuals are posted expense allocation lines in the matching month,
  including descendant budgets when a parent constraint is used.
- Income may be allocated for reporting, but it does not consume budget actuals.
- Tags remain cross-cutting metadata and are not budgets.
- A transaction without a budget remains `Unassigned` and does not consume a
  budget constraint.

## Data flow

```text
budget bucket CRUD -> budget period constraint -> transaction budget line
                                      -> monthly budget actual/remaining
```

The existing immutable classification-line storage is retained as the
allocation mechanism, but its foreign key is renamed from `categoryId` to
`budgetId`. The ledger balance remains independent of budget allocation.

## API changes

- `GET/POST /v1/workspaces/{workspaceId}/budgets` manages budget buckets.
- `POST /v1/workspaces/{workspaceId}/budgets/{budgetId}/archive` archives a
  bucket without removing historical allocations.
- Monthly plans move to `/budget-periods` and
  `/budget-periods/{month}`.
- Budget allocation responses and constraints expose `budgetId`.
- Reports expose `budgets` and `budgetId` instead of `categories` and
  `categoryId`.
- Transaction creation accepts optional `budgetId`; the server creates the
  matching full-amount allocation in the same application operation.

## Non-goals

- No new bank-provider integration.
- No tag removal or tag redesign.
- No hard deletion of historical budget buckets or allocation lines.
- No separate budget selector in the transaction UI.

## Verification

- Domain tests cover budget tree validation, allocation sums, budget actuals,
  and no-budget transactions.
- Backend/application tests cover budget CRUD, renamed API payloads, and
  quick-add allocation.
- Web/mobile tests cover budget selection and request payload propagation.
- Typecheck, lint/format checks, unit tests, and affected builds run before
  completion.
