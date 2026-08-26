# Finwise Requirements and Domain Specification (RDS)

Status: Living draft  
Last updated: 2026-08-26

This document defines Finwise domain language and business rules. It intentionally
separates confirmed rules from proposed modeling choices.

## 1. Domain boundaries

### 1.1 Identity

Owns users and authentication identity. It does not own financial data.

### 1.2 Workspace and access control

Owns workspaces, membership, custom roles, permissions, and invitations. A
workspace is the tenant and authorization boundary.

### 1.3 Money ledger

Owns accounts, opening balances, financial transactions, transfers, corrections,
and auditable balance effects.

### 1.4 Planning

Owns categories, budget periods, soft budget limits, and budget-versus-actual
calculation. A budget does not hold money.

### 1.5 Import and bank sync

Owns connections, external accounts, sync runs, normalized imported records,
deduplication, review status, matching, and confirmation into the money ledger.

### 1.6 Wealth modules

Savings, loans, and investments extend the account/ledger model with domain
details such as maturity, principal, holdings, valuation, and repayment. Their
MVP depth is still open.

### 1.7 Group Treasury

Owns participants, collection campaigns and obligations, contribution evidence,
member-paid claims, sponsorship, approval, and reimbursement workflow. It asks
the money ledger to post only when actual group money or an accepted payable
changes.

### 1.8 Reporting

Owns permission-filtered, rebuildable read models. It never becomes the source
of truth for money balances.

Detailed context alternatives and recommendations are indexed in
[`../domain/README.md`](../domain/README.md).

## 2. Ubiquitous language

| Term | Meaning |
| --- | --- |
| Workspace | An isolated financial book belonging to an individual or group |
| Membership | A user's participation in one workspace |
| Permission | A named capability enforced by the backend, such as `transaction.read` |
| Role | A workspace-defined collection of permissions |
| Account | A place, obligation, or tracked position whose value/balance is measured |
| Transaction | A confirmed business event that changes the financial ledger |
| Transfer | One atomic transaction moving value between two accounts in one workspace |
| Category | The purpose of income or expense; it does not hold money |
| Tag | A reusable cross-cutting label that may classify a transaction line along multiple dimensions |
| Soft budget | A periodic target/limit compared with eligible confirmed spending |
| Imported record | Provider/file data that has not necessarily become a ledger transaction |
| Review inbox | Persisted imported records waiting for confirm, match, edit, or ignore |
| Custodian | Member responsible for reviewing records from a bank connection |
| Valuation | Estimated current value of an asset; not necessarily realized cash income |

Do not use `fund`, `wallet`, `pot`, `account`, and `budget` interchangeably in
code or product copy.

## 3. Workspace isolation rules

Status: **Confirmed**

1. Every financial aggregate belongs to exactly one workspace.
2. A reference between workspace-owned records must remain inside the same
   workspace.
3. A user may participate in many workspaces, but that does not create a shared
   ledger between them.
4. Reports and balances are computed from one workspace at a time.
5. A personal workspace is private by membership configuration, not a different
   database model.

### 3.1 Cross-workspace money movement

Status: Ownership boundary **Confirmed**; detailed account taxonomy is Proposed

A financial transfer must not directly span workspaces. A contribution from a
personal workspace to a group workspace represents two independently authorized
views of the real-world movement:

1. an expense/contribution or external transfer-out in the personal workspace;
2. an income/contribution or external transfer-in in the group workspace.

The product may offer a convenience workflow that creates both records after
checking permission in both workspaces. The resulting records retain independent
IDs, audit histories, visibility, and correction workflows. An optional
correlation ID may express that they describe the same real-world movement; it
must not weaken tenant isolation or create a cross-workspace foreign key that
leaks data.

## 4. Account taxonomy

Status: **Proposed**

Workspace type should not be used to distinguish cash, saving, lending, or
investment. They represent financial positions within the same ownership and
access boundary.

| Account/position | Normal meaning | Balance source |
| --- | --- | --- |
| Cash | Physical cash | Confirmed ledger transactions |
| Bank | Current/payment bank account | Confirmed ledger transactions plus reconciliation with imported data |
| Savings | Deposit or savings account | Transfers, interest, fees, and confirmed bank data |
| Receivable/loan asset | Principal another party owes the workspace | Disbursement, principal repayment, and adjustments |
| Investment cash | Cash held at a broker/platform | Transfers and confirmed cash activity |
| Investment holding | Quantity of an instrument | Buy, sell, split, and adjustment events |
| Liability | Amount the workspace owes | Borrowing, principal repayment, fees, and adjustments |

An opening balance is a dated ledger adjustment for one account. It must be
auditable and must not be silently overwritten.

## 5. Ledger rules

### 5.1 Confirmed rules

1. Money is represented with an exact decimal/money type.
2. A transaction and all of its balance effects commit atomically.
3. Transfers only use accounts in the same workspace.
4. Corrections preserve audit history; financial transactions are not hard
   deleted.
5. Derived balance snapshots are never the source of truth.
6. Imported data does not affect normal visible account balances until it is
   confirmed or matched to a confirmed transaction.

### 5.2 Ledger representation

Status: **Proposed**

Use a transaction header plus one or more postings/entries rather than placing
all balance behavior in a large transaction-type conditional. Each posting has
a positive money amount and an explicit direction/financial effect.

Examples:

| Event | Posting A | Posting B |
| --- | --- | --- |
| Salary | Increase bank account | Income classification |
| Food purchase | Decrease cash/bank account | Expense classification |
| Internal transfer | Decrease source account | Increase destination account |
| Lend money | Decrease bank account | Increase loan receivable principal |
| Receive principal | Increase bank account | Decrease loan receivable principal |
| Receive loan interest | Increase bank account | Interest income |

This is a pragmatic ledger, not a promise to expose accounting debit/credit
terminology to end users. The exact persistence model remains an architecture
decision.

## 6. Soft budget rules

Status: **Confirmed**, except where marked Proposed

1. A budget is a limit/plan for a defined period, initially monthly.
2. Creating or editing a budget does not move money and does not alter any
   account balance.
3. Actual spending includes eligible confirmed, posted expense transactions in
   the budget period.
4. Transfers between the workspace's own accounts do not count as spending.
5. Voided transactions do not count toward actual spending.
6. Remaining budget is `limit - eligible actual spending`; it may be negative.
7. A budget may warn but does not block spending in the MVP.
8. **Proposed:** budget scope is one or more expense categories, with optional
   rollover disabled for the first MVP.
9. Rollover behavior is configurable per budget with three modes:
   `none`, `positive_only`, and `full_balance`.
10. **Open:** treatment of refunds, reimbursements, split transactions, and
   transactions posted late into a closed month.

The UI must label account balance and budget remaining distinctly. “Hũ còn 2
triệu” means remaining plan, not necessarily that 2 million VND exists in cash.

For a period, calculate:

```text
available = base planned amount + carry in
remaining = available - eligible actual spending
```

Then calculate the next period's carry in:

```text
none          => 0
positive_only => max(remaining, 0)
full_balance  => remaining
```

`full_balance` therefore carries both unused positive amount and negative
overspending. Rollover changes future planning availability; it never moves
money between financial accounts.

### 6.1 Category and budget relationship

Status: **Proposed**

Category answers “this spending was for what?” Budget answers “how much does the
workspace plan to spend for a category during a period?” For the first version,
the simplest model is a monthly budget plan containing allocations for expense
categories. A category should contribute to at most one allocation in the same
plan so the same spending is not counted twice.

A split transaction has one account-level payment and multiple category lines.
The sum of line amounts must equal the transaction amount. The account balance
changes once by the full amount; each budget consumes only its matching line.

Example: one 900,000 VND supermarket payment may contain 600,000 VND groceries,
200,000 VND household supplies, and 100,000 VND personal care. The bank account
decreases by 900,000 VND once, while three category budgets consume their own
line amounts.

### 6.2 Proposed nested budget modes

A transaction line is assigned to one leaf category. Its actual amount rolls up
through every ancestor category for reporting. A parent and child may both show
budget constraints, but their planned amounts are not added together as if they
were separate spending; the child constraint is inside the parent's scope.

A parent category can choose one of three planning modes:

1. `by_children`: each child has its own budget and the parent is a derived
   rollup;
2. `shared_pool`: the parent has one budget and all children share it without
   individual limits;
3. `hybrid`: the parent has one overall cap, selected children have fixed or
   percentage guardrails, and the remaining children share the unallocated
   flexible pool.

For a hybrid parent with a 15,000,000 VND base plan:

```text
Essential spending                         15,000,000
|- Rent (fixed)                             7,000,000
|- Food (30% of parent base)                4,500,000
`- Flexible pool for remaining categories  3,500,000
```

Percentage rules use the parent's base planned amount, excluding rollover, so a
carry balance does not silently inflate the recurring percentage. The sum of
fixed and percentage child guardrails cannot exceed the parent base plan unless
the user explicitly increases the parent plan. Flexible children consume one
shared remainder and do not each pretend to own that entire remainder.

In `shared_pool` and `hybrid`, the parent budget is the amount counted in the
workspace's total planned spending. Child limits are drill-down guardrails and
must not be added again. In `by_children`, the parent planned amount is derived
from its funded children.

Rollover is configured on the budget constraint being enforced. A flexible pool
rolls at pool level. A child with its own fixed/percentage guardrail may have its
own rollover display, but it does not create extra money or increase the parent
cap unless the parent also carries a balance.

### 6.3 Product research notes

- Monarch documents both traditional category budgeting and a flex bucket for
  variable categories. Its flex parent is standalone rather than the sum of
  optional child guardrails.
- Monarch group budgeting lets a category group use a group-level budget instead
  of separate child budgets.
- YNAB attaches targets to categories and distinguishes adding the full planned
  amount again from refilling only to a target.
- Goodbudget distinguishes adding a new period's amount to the prior balance
  from resetting the envelope, and its add behavior carries negative balances.

Official references:

- https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting
- https://help.monarch.com/hc/en-us/articles/18345219809940-Group-Budgeting
- https://help.monarch.com/hc/en-us/articles/4411119762196-Rollover-Budgets
- https://support.ynab.com/how-to-use-targets-rk5kkI9ks
- https://goodbudget.com/help/budgeting-with-goodbudget/how-to-start-the-new-month/

## 7. Custom role and permission rules

Status: **Confirmed** at product level; detailed permission catalog is Open

1. Roles are defined within a workspace and group named permissions.
2. A role may be assigned to multiple members; a member may receive one or more
   roles.
3. Effective permissions are the union of active assigned roles.
4. Every protected API declares and enforces a required permission.
5. Resource policy checks run after coarse permission checks. For example,
   `transaction.import.review` is insufficient to review another custodian's
   private pending bank record unless explicitly delegated.
6. Role changes are audited.
7. Each workspace has exactly one owner. The protected owner role cannot be
   deleted or modified in a way that leaves the workspace unmanageable.
8. Deny rules are not proposed for MVP; explicit allow permissions keep the
   model understandable.

### 7.1 Account-scoped authorization

Status: **Confirmed**

Authorization combines capability and resource scope:

```text
allowed = has required permission AND account is inside allowed scope
```

The owner always retains access to every workspace account. Other roles or
members may be scoped to all accounts or selected accounts. A transfer checks
both source and destination. Transaction search, dashboard totals, cash flow,
reports, exports, and notifications must filter inaccessible accounts rather
than leaking them through aggregates.

Bank-import custody remains an additional resource policy on top of account
access. Access to the destination account does not automatically reveal raw
pending provider data from another member's connection.

Account visibility uses one explicit mode:

```text
workspace_default  => role/member account scopes apply normally
exclude_selected   => selected roles/members cannot access the account
include_only       => only selected roles/members and owner can access
owner_only         => only the protected workspace owner can access
```

The owner always bypasses account-visibility exclusion. For everyone else,
visibility is necessary but not sufficient: the actor still needs the required
capability such as `account.read`, `transaction.create`, or
`account.reconcile`.

Hidden accounts are excluded from that viewer's account lists, transaction
search, balances, dashboards, budget actuals, reports, exports, notifications,
and aggregate totals. A future explicit aggregate-only permission may expose a
total without details, but this is not MVP behavior.

### 7.2 Category and tag

Status: **Confirmed**

- Category is the primary budget/report classification. Each transaction line
  has exactly one category.
- Tag is optional cross-cutting metadata. A line may have zero or more tags, and
  the same tag may span unrelated categories and periods.

Tags do not change balances and do not drive the MVP category budget. Attach
them to transaction lines with a convenience action to apply one tag to every
line of a transaction.

Examples:

```text
Category: Food
Tags: business, tax-deductible
```

```text
Category: Transport
Tags: reimbursable, da-lat-trip-2026
```

Finwise does not introduce a Project entity in the current domain. A personal
event or context uses tags; an activity that needs its own members, accounts,
permissions, budgets, and shared reports uses a workspace. Project may be
reconsidered only if a validated use case cannot be represented by either.

Potential permission namespaces include:

```text
workspace.read
workspace.update
member.read
member.invite
member.manage
role.read
role.manage
account.read
account.manage
transaction.read
transaction.create
transaction.update
transaction.void
budget.read
budget.manage
report.read
bank_connection.manage
bank_import.review_own
bank_import.delegate
```

This catalog is illustrative until the use-case/API inventory is approved.

## 8. Import and bank inbox flow

Status: **Confirmed** at workflow level

```text
Provider API / CSV / Excel
          |
          v
Fetch and normalize external record
          |
          v
Idempotency and duplicate candidate detection
          |
          v
Persistent review inbox
     |          |          |
  confirm      match      ignore
     |          |
     +----> confirmed workspace transaction
```

1. A background job queue may run provider synchronization, but the review
   inbox itself is durable domain data, not a transient job queue.
2. External provider ID is the preferred idempotency key. A stable fingerprint
   is required when an importer does not supply a trustworthy ID.
3. Duplicate detection must distinguish an exact imported-record duplicate from
   a possible match to a transaction the user already entered manually.
4. Confirming creates a transaction or matches the imported record to an
   existing transaction in one atomic operation.
5. The original normalized imported record remains for audit and future sync
   idempotency.
6. Pending bank records are visible to the connection custodian; confirmed
   transactions follow normal workspace permissions.
7. Failed syncs do not fabricate financial success and may be safely retried.

## 9. Savings, loans, and investments

### 9.1 Savings

Status: **Proposed**

A savings deposit normally remains in the same workspace because ownership and
access have not changed. Moving money from a current account to savings is an
internal transfer, not an expense. Interest is income; bank fees are expense.
Term, maturity date, and interest rate are optional savings metadata.

### 9.2 Money lent to another party

Status: Core scope **Confirmed**; detailed calculation rules are Open

Lending principal converts cash into a receivable asset; it is not ordinary
spending. The receivable principal decreases when principal is repaid. Interest
received is income. The system should separate principal, interest, and fees so
net worth and income reports remain correct.

The balance can update automatically from confirmed disbursement and repayment
events. Schedule-based expected balance and actual balance must be distinct:
missing a due date does not mean money was repaid.

Loan scope includes principal, interest, repayment schedules, due dates, actual
repayments, and reminders. Open calculation choices include flat versus reducing
balance interest, accrual versus cash-basis reporting, early repayment, late
fees, and allocation order when one payment covers principal, interest, and fee.

### 9.3 Investments

Status: Initial asset scope **Confirmed**; accounting details are Proposed

Moving cash to an investment platform is a transfer, not an expense. Buying an
asset exchanges investment cash for a holding. Current investment value is
`quantity x latest valuation price`; this valuation changes net worth but is not
realized income. A sale realizes gain/loss; dividends and coupons are income.

Investment value may update automatically only from a trusted price feed or a
user-confirmed valuation. Price changes must create valuation records, not fake
cash transactions. The MVP may begin with manual valuations before automatic
market data.

The initial supported asset families are stocks, cryptocurrency, and gold.
Holdings, trades, and valuations may be entered manually. Automatic price feeds
are deferred.

## 10. Group workspace business modes

Status: Shared treasury, collections, submissions, sponsored/reimbursable modes
are **Confirmed**; detailed accounting and full settlement boundary are Proposed

Group membership alone does not decide how money is tracked. Three related but
different capabilities must not be silently combined.

### 10.1 Shared treasury

The workspace tracks money actually owned or controlled by the group: class
cash, a shared bank account, collected membership dues, and expenses paid from
those accounts. Only real movement in a workspace-owned account changes its
balance.

Example: the class fund pays 1,000,000 VND for a meal from its bank account. The
bank balance decreases and the group expense report increases.

### 10.2 Member-paid group expense note

A member personally pays for something that benefited the group. The workspace
may record an expense note with amount, category, payer, receipt, and whether it
should be reimbursed. Because no money moved through a group-owned account, this
record does not immediately change group cash/bank balances.

If reimbursement is only a workflow status, the product can derive “pending
reimbursement” from approved notes without creating a general member-debt
ledger. When the group later reimburses the member, the actual group account
outflow is linked to the note and excluded from expense totals to avoid counting
the same group expense twice.

### 10.3 Member settlement / Splitwise-style balances

This optional mode allocates expenses among members and continuously calculates
who owes whom. It requires debt/receivable balances, settlement transactions,
partial payments, and allocation rules. It is substantially broader than a
shared treasury and is not assumed to be MVP scope.

The product owner must choose whether Finwise needs only shared treasury, shared
treasury plus reimbursement notes, or full member settlement.

### 10.4 Proposed group roles and posting workflow

A workspace member does not need a personal financial account inside the group
workspace. Group accounts represent money controlled by the group. A member is
referenced as contributor, submitter, payer, approver, or bank-connection
custodian without exposing accounts from the member's personal workspace.

The protected owner can define custom roles. Suggested initial role templates
are Treasurer, Member, and Viewer; these are editable templates rather than
hard-coded authorization enums.

- A member with `transaction.create` may post a transaction directly.
- A member with only `contribution.submit` may report that they paid, but the
  report does not change a group account balance until an authorized member or
  confirmed bank import verifies receipt.
- A member with `expense_claim.submit` may submit a member-paid expense. This is
  a claim/note, not an immediate group-account transaction.
- A member with `transaction.approve` or an equivalent treasury permission may
  approve/post the financial effect.

This lets a family grant posting permission to several members while a class
fund can restrict posting to its treasurer. The permission model, not a fixed
workspace type, selects the workflow.

A Participant is distinct from User and WorkspaceMembership. Participant is the
workspace-scoped financial identity used in collections, sponsorships, claims,
and reimbursements. It may optionally link to one membership. This permits a
class fund to track people who do not have Finwise accounts and later link them
without rewriting historical records.

### 10.5 Proposed group reporting views

Group reporting should keep these measures separate:

1. treasury balance: sum of actual workspace-owned account balances;
2. cash flow: posted inflows and outflows of group accounts;
3. collection progress: expected, received, partial, and overdue contributions;
4. approved group spending: direct group expenses plus approved reimbursable
   expenses, without double-counting reimbursement;
5. sponsored activity: member-funded, non-reimbursable expenses shown separately;
6. pending workflow: submissions awaiting verification, approval, or
   reimbursement.

## 11. Open domain questions

The complete questions and rationale live at the end of each document under
[`../domain/`](../domain/). The decisions that block persistence/API design most
directly are:

1. Confirm the internally balanced ledger and reverse-and-replace correction
   model.
2. Confirm account-policy precedence when role and member exceptions conflict.
3. Confirm guarded owner transfer and audited bank-custodian takeover.
4. Confirm nested budget modes, percentage base, rollover ownership, and first
   category depth.
5. Confirm Group Treasury stops at collection + reimbursement for MVP rather
   than implementing full Splitwise-style settlement.
6. Confirm when approved claims consume group budget and whether they create a
   reimbursement payable.
7. Select first loan calculation strategies, payment allocation, early-payment,
   and cash/accrual reporting rules.
8. Confirm manual holdings/trades/valuation and first cost-basis display method.
9. Confirm private file-import sessions and raw bank metadata visibility.
10. Confirm goal progress method and whether month closing is explicit.
