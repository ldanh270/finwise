# Phase 4 — Classification, budgets, and reporting

Status: Ready after Phase 3  
Depends on: [Phase 3](03-LEDGER-ACCOUNTS-TRANSACTIONS.md), Phase 2 account policies  
Unblocks: Group budget views and web MVP reporting

## Objective

Add category/tag classification, split transactions, soft monthly budgets,
rollover, goals, and permission-filtered reports without changing account
balances or making budgets a second cash ledger.

## Business rules

- Categories form at most two levels. A parent is a roll-up; post to a parent
  only when it has no active children or use a visible `Other` child. Archive,
  do not delete, categories referenced by history.
- Classification lines are positive, each has exactly one category, and their
  sum equals the user-facing transaction amount. Account movement happens once;
  tags attach to lines and cannot alter amount.
- Budgets are soft monthly limits. Actuals are eligible posted expense lines by
  effective date/category descendant, subject to account visibility. Transfers,
  opening balances, loan principal, investment activity, pending imports,
  sponsored group costs, and reimbursement settlement are excluded.
- One active monthly plan per workspace in MVP. `BY_CHILDREN` funds children and
  rolls up; `SHARED_POOL` funds the parent; `HYBRID` reserves fixed and
  percentage children and leaves a flexible remainder. Percentages use the new
  period base after fixed allocations, excluding rollover.
- Rollover modes are `NONE`, `POSITIVE_ONLY`, and `FULL_BALANCE`. Only the
  funded-cap owner rolls over. `available = base + carry`; `remaining =
  available - actual`. Negative full-balance carry reduces the next period but
  never changes account money.
- Open-period edits create an auditable plan revision. Closing freezes rollover;
  a late correction requires deliberate reopen or an audited next-period carry
  adjustment. Planning transfers move cap between constraints atomically and
  do not move financial accounts.
- Goals support target/date with manual progress or one linked savings account;
  show the method and never claim that money is reserved. Goals are not assets.
- Reports apply actor/workspace/account scope before aggregation. Hidden values
  cannot leak via totals, ratios, chart scales, counts, net worth, or exports;
  partial visibility is explicitly labeled.

## Data flow

```text
posted journal -> eligible classification lines -> scoped report projection
budget plan + revisions + prior closed period -> constraint calculation
account policy -> filter before aggregation -> report + freshness/partial flag
```

Rebuild projections from posted source records. A refund/reversal reduces actual
on its own effective date. Group approval and lending/investment integrations
use typed source links and their context-specific inclusion rules.

## Schema and API surface

Create `Category` (parent, status, workspace), `Tag`, `ClassificationLine`,
`LineTag`, `BudgetPlan`, `BudgetPeriod`, immutable `BudgetRevision`,
`BudgetConstraint` (mode/fixed/percentage/cap owner/rollover), `RolloverResult`,
`BudgetAdjustment`, `SavingsGoal`, and report projection/checkpoint tables.
Add constraints for category depth/cycles, one active plan, unique category per
period, percentage ≤ 100%, fixed ≤ base, and exact split sums.

Expose:

- category/tag CRUD/archive;
- transaction classify/split/tag commands with `expectedVersion`;
- budget plan/period/constraint/revision/close/reopen/carry-adjustment APIs;
- goal CRUD/progress/link/unlink;
- monthly overview, cashflow, spending-by-category, budget-vs-actual, and
  goal-progress queries with `partialData` and freshness metadata;
- CSV export using the same authorization filter as on-screen reports.

## Client behavior

Web leads category tree management, split-line editor, tag filters, nested budget
editor with fixed/percentage/flexible explanation, period close/reopen prompts,
goal progress, dashboards, drill-downs, and export. Forms show exact VND string
inputs, server validation, stale projection indicators, partial-data banners,
and retry/empty/denied states.

Mobile consumes overview, transaction classification, budget remaining, and goal
progress after Phase 8 using the generated client. It must not duplicate budget
calculation or show hidden-account totals from a stale local cache.

## Test matrix

| Area | Required cases |
| --- | --- |
| Category | two-level limit, cycle/depth rejection, archive/reference, parent posting |
| Split | positive lines, exact sum, remainder assignment, account effect once |
| Budget | all three modes, fixed/percentage constraints, rollover modes, negative carry |
| Close/revision | revision audit, close freeze, deliberate reopen/carry adjustment |
| Actuals | exclusions, refund/reversal, effective date, hidden account filtering |
| Goals | manual vs linked progress, no reserved-money claim |
| Reports | partial indicator, no aggregate/count/ratio/chart/export leak |
| API/UI | concurrency version conflicts, loading/empty/stale/error/denied states |

## Migration notes

Do not reinterpret legacy category/budget rows as ledger truth. If old rows are
retained, map them to archived categories and explicit budget revisions, flag
ambiguous parent/child relationships, and require an operator review. Build
actuals from Phase 3 classification lines after ledger migration, then compare
old/new totals before enabling reports.

## Exit criteria

- Split transactions classify one account movement exactly and feed reports and
  budgets correctly.
- Monthly nested budgets calculate available/actual/remaining and rollover with
  no double counting.
- Reports are rebuildable, scope-filtered, freshness-aware, and safe for partial
  visibility; goals clearly separate planning from balances.
