# Phase 3 — Accounts and immutable ledger

Status: In progress — in-memory immutable-ledger slice landed; Prisma adapter/full account workflows pending  
Depends on: [Phase 2](02-IDENTITY-WORKSPACE-ACCESS.md), Phase 1 money/UoW ports  
Unblocks: budgets, reports, Group Treasury, ingestion, wealth modules

## Objective

Deliver the first usable financial vertical slice: create an account, enter an
opening balance, post income/expense/transfer, view balances, and correct a
posted event without destroying history.

## Business rules

- Every workspace-owned account and journal is VND and carries `workspaceId`.
- User-entered amounts are positive; entry direction represents increase or
  decrease. Internally every posted journal balances in VND with two or more
  positive entries, including hidden system accounts.
- Account types include cash, bank, savings, investment cash, receivable, and
  liability. System accounts (opening equity, income/expense categories,
  reconciliation, gain/loss) are hidden from normal lists and reports.
- Opening balance is a dated journal against opening equity; never mutate an
  account balance field as the source of truth.
- Income/expense forms post the selected account against a system counter
  account. Transfers debit/decrease source and credit/increase destination in
  one database transaction; source and destination must share workspace,
  currency, visibility permission, and active state.
- Posted journals, entries, classifications, and source links are immutable.
  “Edit” is reversal plus replacement in one unit of work. Void is a full
  reversal with actor/time/reason. No hard delete of financial history.
- Refunds, chargebacks, and reimbursements are linked compensating events; they
  cannot exceed the eligible remaining amount without an audited adjustment.
- Ledger balance includes all posted entries through effective time; cleared and
  reconciled balances are separate views. Pending/imported/provider data never
  changes confirmed balance.

## Data flow

```text
command + actor/workspace -> membership/account-scope policy
 -> validate Money/date/type -> build balanced journal
 -> deterministic account locks -> persist header/entries/source/audit
 -> update/rebuild balance checkpoint -> outbox after commit -> response
```

All multi-row writes use the Unit of Work. Lock accounts in stable ID order to
avoid deadlocks. Balance projections are updated in the same transaction or
returned as stale/unavailable with freshness metadata; never claim a balance
that was not committed.

## Schema and API surface

Create `FinancialAccount` (type, name, currency, lifecycle, visibility policy),
`JournalTransaction` (kind, dates, description, creator/poster, status,
reversal/replacement links), `JournalEntry` (account, positive minor units,
direction, memo), `JournalSourceLink`, `BalanceCheckpoint`, `IdempotencyCommand`,
and financial audit records. Enforce composite workspace references, unique
source/idempotency keys, immutable-posted constraints, and one currency per MVP
journal.

Expose at minimum:

- `GET/POST/PATCH /v1/workspaces/{workspaceId}/accounts` and archive;
- opening-balance command;
- income, expense, and transfer commands requiring `Idempotency-Key`;
- cursor-paginated transaction list/detail with effective/posted dates;
- reverse/void/replace commands with `expectedVersion` where applicable;
- account balance endpoint returning ledger, cleared, reconciled-through, and
  freshness metadata;
- audit/correction-chain detail.

Responses use `MoneyDto { currency: "VND", minorUnits: string }` and typed
errors for invalid amount, cross-workspace reference, archived account,
duplicate idempotency key, unbalanced journal, forbidden scope, and stale
version.

## Client behavior

Web provides account CRUD/archive, opening balance, quick income/expense/transfer
forms, recent transactions, balance cards, detail/audit/correction views, and
retry/empty/loading/permission states. A correction is presented as Edit but
explains that the history remains auditable. Query invalidation refreshes both
transaction list and affected balances after mutation.

The shared generated client is the only transport surface mobile will use.
Mobile online quick-add and history arrive in Phase 8; no client may calculate
or persist a confirmed balance locally.

## Test matrix

| Area | Required cases |
| --- | --- |
| Domain | positive Money, balanced journal, account normal-balance direction, VND only |
| Posting | opening, income, expense, transfer, zero/overflow, archived account |
| Atomicity | transfer failure rolls back both accounts; deterministic lock order |
| Idempotency | same key/body returns same result; same key/different body conflicts |
| Correction | reversal/replacement, void, refund/chargeback links, audit chain |
| Persistence | tenant FKs, immutable posted rows, unique source links, projection rebuild |
| Authorization | account-scope on details, both transfer ends, aggregates and exports |
| API/UI | typed errors, cursor paging, stale retry, loading/empty/denied states |

## Migration notes

The current Prisma schema is an obsolete draft and is not extended. Phase 0
database preflight chooses either a fresh baseline or a preserving migration.
For a real-data migration, map old single-entry records into balanced journals,
retain original IDs/source snapshots, and produce a reconciliation report before
cutover. Never infer an opening balance by silently overwriting current totals.

## Exit criteria

- A user can complete account → opening balance → income/expense/transfer and
  see correct ledger/cleared/reconciled values.
- A projection rebuild from immutable entries equals cached balances.
- Every financial command is tenant-scoped, idempotent, atomic, and audited.
- Posted events cannot be updated/deleted and correction chains are inspectable.

## First-slice evidence

`backend/src/core` now supports VND string amounts, opening balances, manual
income/expense/transfer journals, idempotency replay, transaction listing,
audit history, void-by-reversal, account archive, reversal/replacement
correction, journal-based balance rebuild, scoped ledger/cleared/reconciled
balance views, and visibility-checked journal source links through an
in-memory adapter. PostgreSQL repositories, split/category lines, durable
checkpoints, and durable source-link constraints remain before this phase can
exit. See the [ledger correction walkthrough](../../reviews/2026-08-30-ledger-correction-projection-walkthrough.md),
[balance views walkthrough](../../reviews/2026-08-31-balance-views-walkthrough.md),
and [source-link walkthrough](../../reviews/2026-08-31-ledger-source-links-walkthrough.md).
