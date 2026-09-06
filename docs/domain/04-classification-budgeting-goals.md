# Classification, budgeting, and savings-goal domain

Status: Proposed, except budget/tag/soft-budget/rollover requirements already Confirmed
Last updated: 2026-08-26

## 1. Business purpose

Classification explains **why** money moved. Budgeting compares eligible actual
spending with a plan. Goals track intended progress toward a future target.
None of these concepts is a financial account balance.

## 2. Budget bucket, tag, and workspace distinction

| Concept | Cardinality/use | Changes balance? | Consumes budget? |
| --- | --- | --- | --- |
| Budget bucket | Exactly one per income/expense classification line; primary purpose such as Housing/Rent | No | Expense budget may |
| Tag | Zero to many per line; cross-cutting lens such as `vacation-2026` or `tax-deductible` | No | Not in MVP |
| Workspace | Separate ownership, members, accounts, permissions, and reports | Contains ledger | Has its own budgets |
| Goal | Target amount/date and progress rule | No by itself | No by itself |

Do not add Project now. Use a tag for an event/campaign that only needs filtering
and reporting. Create a workspace when the activity needs its own shared money,
participants, permissions, accounts, and treasury governance.

## 3. budget hierarchy alternatives

### Flat budget list

- Pros: simplest transaction entry and reporting.
- Cons: cannot express Housing -> Rent/Utilities or Essential -> Food/Rent.

### Unlimited tree

- Pros: maximally flexible.
- Cons: mobile navigation and roll-up calculations become confusing; moving a
  subtree can rewrite historical reports; users create overly deep taxonomies.

### Shallow tree with stable historical IDs

**Recommendation:** support parent + child, initially maximum two levels. The
parent gives a reporting roll-up; the child is the normal posting budget.
Allow posting directly to a parent only when it has no active children, or use a
visible `Other` child. Archive instead of delete. Renaming changes the label,
while reports retain the stable budget ID.

Parent and child can each have budget constraints, but calculation rules must
avoid counting the same planned money twice.

## 4. Budget scope alternatives

### One budget constraint per budget bucket per month

- Pros: simple and understandable.
- Cons: no nested/flexible pool; yearly or custom periods require redesign.

### Envelope/pot that holds money

- Pros: strong allocation discipline.
- Cons: conflicts with confirmed soft-budget semantics; creates confusion with
  accounts and transfers.

### Budget plan with budget constraints

A `BudgetPlan` defines period cadence and policy. A period contains constraints
for budget nodes. Money remains in accounts; actual is derived from eligible
posted expense lines.

**Recommendation:** budget plan + budget constraints. Start with monthly
periods, one active plan per workspace, and leave cadence extensible. Prevent two
active constraints for the same budget and period in one plan.

## 5. Nested budget model

The requested example is valid:

```text
Essential: 12,000,000
  Rent: fixed 5,000,000
  Food: 40% of distributable base
  Utilities: flexible pool
```

Recommended parent allocation modes:

### `BY_CHILDREN`

Parent planned amount equals the sum of child allocations. The parent is a
roll-up and has no independent cap.

- Best for detailed plans where every amount is assigned.
- Parent rollover is derived from child results; do not roll both levels.

### `SHARED_POOL`

Parent owns one cap; children classify actual spending but have no hard/soft
individual allocations.

- Best for flexible spending such as Food + Entertainment sharing one amount.
- Child reports show actual only.

### `HYBRID`

Parent owns a total cap. Some children receive fixed or percentage guidance;
the remainder is a shared flexible pool for unallocated children.

- Best match for Rent fixed + Food percentage + flexible utilities.
- More powerful but requires the UI to show reserved and flexible amounts.

Recommended HYBRID calculation:

```text
parent_available = parent_base + parent_rollover
fixed_total = sum(fixed child allocations)
percentage_base = parent_base - fixed_total
percentage_child = percentage_base * configured percentage
flex_pool = parent_available - fixed_total - sum(percentage children)
```

Percentages use the new period's **base**, not rollover, so an unusually large
carry does not inflate every percentage child. Rollover enters the flexible
remainder unless the product later supports child-specific rollover.

Validation:

1. fixed allocations cannot exceed parent base;
2. percentage sum cannot exceed 100%;
3. calculated fixed + percentage allocations cannot exceed parent available;
4. actual at a child rolls up to ancestors exactly once;
5. planned totals count the funded parent once, never parent plus children;
6. changing hierarchy cannot create cycles.

## 6. Rollover alternatives and rules

Confirmed modes:

```text
NONE          carry = 0
POSITIVE_ONLY carry = max(previous_remaining, 0)
FULL_BALANCE  carry = previous_remaining

available = base_limit + carry
remaining = available - eligible_actual
```

Negative full-balance rollover means overspending reduces next period's
available plan. It never creates a debt or changes an account.

Recommended scope: configure rollover at the node that owns the funded cap. In
`BY_CHILDREN`, each funded child may have its own rollover and the parent derives
the total. In `SHARED_POOL`/`HYBRID`, the parent owns rollover; child allocations
do not independently carry. This avoids double carry.

## 7. What counts as budget actual

Default inclusion:

- posted expense classification lines;
- effective date falls in the budget period;
- budget is the constrained budget or descendant;
- account and transaction are not excluded by policy;
- reversal/refund components reduce eligible actual at their own effective date.

Default exclusions:

- transfers, opening balances, loan principal, investment purchases/sales,
  valuation changes, ignored/pending imports;
- sponsored group expense borne by a member;
- group reimbursement cash movement when the approved underlying claim has
  already counted as the group expense;
- reconciliation adjustments unless explicitly categorized as spending.

For a viewer with hidden accounts, reports must not reveal hidden actuals. Show
“partial data due to access restrictions” rather than presenting a misleading
workspace total as complete.

## 8. Split transactions

One account movement may have multiple classification lines:

```text
Supermarket charge 1,000,000
  Food       750,000
  Household  250,000
```

Rules:

1. line amounts are positive and sum exactly to the transaction total;
2. each expense/income line has exactly one budget;
3. tags attach to individual lines, allowing different purposes in one charge;
4. account balance changes once by 1,000,000;
5. budgets consume 750,000 and 250,000 separately;
6. rounding remainder is assigned explicitly to one line, never lost through
   floating-point arithmetic.

## 9. Budget revision and period close

Alternatives:

- overwrite the current limit: simple, but destroys “what was the plan then?”;
- immutable plan only: auditable, but too rigid for daily budgeting;
- versioned plan with an explicit close: balanced approach.

**Recommendation:** changes during an open period create a revision/audit entry
and recompute remaining. Closing a period freezes its rollover result. A late
financial correction can either deliberately reopen the period or produce an
audited carry adjustment in the next open period. Never silently rewrite a
closed rollover chain.

Budget “transfer” is a planning reallocation, not money movement. Allow it only
between constraints under the same plan/period; decrement one planned amount
and increment another atomically, preserve total planned amount, and audit the
reason. In a flexible parent pool, reallocating between children may be only a
guidance change because the parent cap already owns the money plan.

## 10. Goal model alternatives

### Goal is just a target and manual progress

- Pros: simple, works without dedicated accounts.
- Cons: progress can disagree with actual savings and be double-counted.

### Goal equals one financial account

- Pros: objective balance and very understandable.
- Cons: one savings account may fund several goals; an account may contain money
  unrelated to the goal.

### Virtual goal allocations over eligible accounts

- Pros: multiple goals can share an account without moving real money; prevents
  double allocation if constrained.
- Cons: introduces a second allocation ledger and transfer/release rules.

**Recommendation for MVP:** support target amount/date with either manual
progress or one dedicated linked savings account, clearly label the progress
method, and do not claim funds are reserved. **Future:** add virtual goal
allocations only after users need multiple goals per account. Then enforce that
active allocations do not exceed the eligible linked-account balance and make
allocation changes auditable.

## 11. Decisions still needing product-owner confirmation

1. Confirm maximum two budget levels for the first version.
2. Confirm parent allocation modes `BY_CHILDREN`, `SHARED_POOL`, and `HYBRID`.
3. Confirm percentages exclude rollover and apply after fixed allocations.
4. Confirm only the funded cap owner rolls over, preventing parent/child double
   carry.
5. Confirm one active monthly budget plan per workspace for MVP.
6. Choose MVP goal progress: manual only, dedicated-account link, or both as
   recommended.
