# Ledger, accounts, and transaction domain

Status: Proposed; financial safety rules in the SRS are Confirmed  
Last updated: 2026-08-26

## 1. Business purpose

This context answers one authoritative question: **what financial position does
this workspace have, and which posted events produced it?** It must remain
rebuildable, auditable, and correct when Finwise later adds loans, investments,
refunds, imports, and group reimbursements.

## 2. Ledger representation alternatives

### Option A: single-entry transaction with `type`, `accountId`, and amount

Advantages:

- simplest schema for initial income/expense;
- maps directly to a basic mobile form.

Disadvantages:

- transfer needs special source/destination columns;
- loans, liabilities, reimbursements, refunds, and investment trades add a
  growing conditional matrix;
- correcting or proving a balance is difficult;
- opening balance becomes a mutable field rather than a financial event.

### Option B: account-effect entries without requiring balance

A transaction has one or more positive entries with explicit
increase/decrease effects on tracked accounts. Income/expense classification is
stored separately.

Advantages:

- supports atomic transfers and split classification;
- simpler than accounting-grade double entry.

Disadvantages:

- value can appear/disappear without a balancing explanation;
- invariants differ by transaction type;
- lending and liabilities remain special cases.

### Option C: internally balanced journal with hidden system accounts

Each posted journal has two or more positive entries. Entry direction determines
the debit/credit effect; entries balance in one currency. Finwise exposes
friendly “income / expense / transfer” forms and generates balanced entries
behind them. budgets may map to hidden income/expense ledger accounts while
user-facing financial accounts represent assets/liabilities.

Advantages:

- every change has a counter-effect and can be proven balanced;
- opening balance, transfer, lending, borrowing, refunds, and investment cash
  can share one posting engine;
- immutable correction and audit behavior is consistent;
- future net-worth and reconciliation work is safer.

Disadvantages:

- more tables and domain knowledge;
- system accounts must be hidden from normal UX;
- reporting/classification boundaries need explicit mapping;
- implementation tests must cover sign/direction semantics thoroughly.

**Recommendation: Option C internally, simple money-tracker UX externally.**
Finwise's confirmed scope is already beyond a basic expense list. The extra
ledger structure pays for itself in transfers, loans, investment cash, group
reimbursements, and trustworthy corrections. Do not expose debit/credit jargon
to normal users.

## 3. Core model

### FinancialAccount aggregate

Represents a workspace-owned financial position:

- asset: cash, bank, savings, investment cash, loan receivable;
- liability: borrowed money or other payable;
- hidden system account: opening equity, income budget, expense budget,
  reconciliation adjustment, realized gain/loss.

An account has lifecycle state, normal balance behavior, VND currency, access
policy ID, and optional subtype metadata. Current balance is a projection, not a
field users directly overwrite.

### JournalTransaction aggregate

Recommended fields/concepts:

- workspace, transaction ID, business kind;
- `effective_at` (when the financial event happened);
- `recorded_at` and `posted_at` (when Finwise learned/committed it);
- description, payee/counterparty snapshot, creator/poster;
- immutable entries after posting;
- budget/tag allocation lines for the user-facing purpose;
- optional source links to import, group claim, loan payment, or investment
  trade;
- reversal relationship and audit metadata.

### JournalEntry

Each entry has one account, positive Money, direction, and optional memo. For
MVP, every transaction balances in VND. Do not store negative input amounts;
direction carries the effect.

### ClassificationLine

A transaction can be divided into lines whose amounts sum exactly to the
user-facing transaction total. Each line has one budget and zero or more tags.
Classification controls budget/report meaning and must not repeat the account
balance effect.

## 4. Example posting rules

| Business event | Balanced financial effect | Budget/classification effect |
| --- | --- | --- |
| Opening bank balance | Increase bank; offset opening-equity account | None |
| Salary received | Increase bank; offset income-budget account | Income budget line |
| Food paid from cash | Decrease cash; offset expense-budget account | Expense budget line |
| Same-workspace transfer | Decrease source; increase destination | Excluded from income/expense and budget |
| Lend another person money | Decrease bank; increase loan receivable | Not ordinary expense |
| Receive loan repayment | Increase bank; decrease receivable for principal; interest to income | Only interest/fee is income |
| Borrow money | Increase bank; increase liability | Not income |
| Repay borrowed loan | Decrease bank; reduce liability for principal; interest to expense | Only interest/fee is expense |
| Investment purchase | Decrease investment cash; record position/cost effect | Not ordinary expense |
| Reconciliation adjustment | Adjust financial account against explicit adjustment account | Report separately, require reason |

## 5. Draft, submission, import, and posted truth

Do not overload one status-heavy `transactions` table with unrelated mutable
lifecycles.

- Manual draft: optional client/server draft, freely editable, no balance.
- Group submission/claim: owned by Group Treasury, approval workflow, no balance.
- Imported record: owned by Ingestion, mutable provider lifecycle, no balance.
- Posted journal: owned by Ledger, immutable financial truth.

Confirmation/approval creates or matches one posted journal atomically and
stores the source link. Retrying with the same idempotency key returns the same
result rather than posting twice.

## 6. Mutation and correction alternatives

### Edit posted rows in place

Easy UX, but destroys historical truth and can invalidate reconciliation,
budgets, and external matches. Reject.

### Keep versions of one mutable transaction

Preserves some audit information, but balance queries must choose the correct
version and concurrent edits are difficult.

### Reverse and replace

The original posted journal remains immutable. A correcting journal reverses
its entries, and a replacement journal records the corrected event.

**Recommendation: reverse and replace.** The UI may present this as “Edit,” but
the application executes reversal + replacement in one transaction and shows
the correction chain in audit details. A void is a full reversal without a
replacement. Never hard-delete a posted journal.

## 7. Refunds, reimbursements, and chargebacks

These require explicit links rather than generic negative expenses.

- Refund: new receipt transaction linked to the original expense; default
  classification reduces spending in the same budget at the refund's
  effective date.
- Chargeback/reversal: linked compensating transaction; preserve the provider's
  reason and lifecycle.
- Group reimbursement: group cash outflow settles an approved claim but does
  not add a second copy of the underlying group expense to expense reports.
- Partial refund/reimbursement: allocations cannot exceed the eligible
  remaining amount unless a privileged adjustment explains why.

For MVP reporting, use cash-period behavior: the refund affects the period when
it occurs. Restating a closed historical period can be added later as an
explicit reporting option.

## 8. Dates and period closing

Use both effective and recorded timestamps. Cashflow and budget reports default
to effective date; audit and operational reports use recorded/posted time.

Recommended period behavior:

- open periods recalculate after valid late entries;
- a closed/reconciled period is never silently rewritten;
- corrections remain possible through reversal/replacement, but generate an
  explicit carry/reconciliation adjustment or require a deliberate reopen;
- timezone belongs to the workspace so a mobile client cannot shift a monthly
  boundary.

## 9. Cross-workspace movement

### One atomic transfer spanning workspaces

Feels convenient but violates independent authorization, visibility, correction,
and tenant ownership. Reject.

### Two independent records with an optional correlation

One side is authorized and posted in each workspace. A convenience workflow may
create both only when the actor has permission to both; failure must not leave
one side claiming an atomic cross-tenant transfer.

**Recommendation:** no cross-workspace transfer aggregate. Start with manual
recording on each side. Later add a paired workflow using a neutral correlation
token and clearly show each side's independent status.

## 10. Balance, cleared state, and reconciliation

Recommended balance views:

- ledger balance: all posted entries through a date;
- cleared balance: posted entries marked as cleared/verified;
- reconciled-through balance/date: checkpoint proven against an external
  statement;
- available balance: provider/user value if known, informational and not a
  substitute for ledger truth.

Cached balances are updated transactionally with postings or rebuilt from
entries. A rebuild must produce exactly the same result.

## 11. Aggregate and transaction boundaries

- Posting one journal and all entries is one database transaction.
- Same-workspace transfer locks/updates both affected balance projections in a
  deterministic order.
- Reversal + replacement is one use-case transaction.
- Loan repayment and its principal/interest entries commit atomically with the
  Lending payment record.
- Investment trade cash effects and position event commit atomically through an
  application-level unit of work while modules share the database.

## 12. Decisions still needing product-owner confirmation

1. Confirm balanced internal journal rather than the lighter unbalanced posting
   model.
2. Confirm reverse-and-replace as the implementation behind editing a posted
   transaction.
3. Confirm cash-period refunds for MVP.
4. Decide whether users may close a month manually, or reconciliation alone
   marks history as protected.
5. Decide whether opening-balance date may precede all imported history or must
   align with an import start date.

## 13. External design references

- [Modern Treasury ledger overview](https://docs.moderntreasury.com/ledgers/docs/overview)
  for balanced double-entry as a scalable value-tracking model.
- [Ledger guarantees](https://docs.moderntreasury.com/ledgers/docs/ledgers-guarantees)
  for balance-per-currency, immutability, idempotency, auditability, and
  transaction isolation.
- [Transaction status and reversals](https://docs.moderntreasury.com/ledgers/docs/transaction-status-and-balances)
  for immutable posted entries and correcting them with reversing transactions.
