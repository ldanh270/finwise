# Ledger correction and projection walkthrough — 2026-08-30

## Scope

This slice extends the immutable ledger vertical slice with:

- account archive without deleting transaction history;
- correction as reversal plus replacement under one application command;
- idempotent replacement replay;
- deterministic balance projection rebuild from every journal entry.

Prisma repositories, cleared/reconciled checkpoints, source links and
transaction-level optimistic versions remain outside this slice.

## Business rules

1. A user account can be archived only with `account.update`; system accounts
   cannot be archived. Archived accounts remain readable in historical journals
   but cannot receive new postings.
2. A posted transaction is never edited. Replacement first validates the new
   balanced journal, creates a compensating reversal, marks the original
   `voided`, then posts the replacement. The original/reversal/replacement are
   returned together and the original audit chain records the reason.
3. `Idempotency-Key` plus request hash replays an identical replacement and
   rejects reuse for a different command.
4. Rebuild sums all immutable entries, including a voided original and its
   posted reversal. Excluding voided headers would double-count the reversal.

## Data flow

```text
replacement command
 -> validate target + replacement journal
 -> reverse original
 -> mark original voided/audit
 -> post replacement
 -> cache balance and replay response by idempotency key

rebuild query
 -> zero workspace account map
 -> sum every journal entry direction
 -> return exact bigint/string projection
```

Application code calls `CoreStorePort`; persistence and HTTP concerns stay at
their boundaries.

## Domain/schema changes

- Added archive, replacement and rebuild methods to `CoreStorePort`.
- Added `status` to account response and exposed immutable projection output.
- Kept existing `TransactionAuditAction.replaced` and reversal links.
- No Prisma migration was changed before Phase 0 database preflight.

## API contract

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/v1/workspaces/:workspaceId/accounts/:accountId/archive` | Archive a user account. |
| GET | `/v1/workspaces/:workspaceId/balances/rebuild` | Recompute balances from journal source of truth. |
| POST | `/v1/workspaces/:workspaceId/transactions/:transactionId/replace` | Reverse original and post replacement; requires `Idempotency-Key`. |

Replacement accepts the normal income/expense/transfer fields plus a required
`reason`. All monetary values remain VND minor-unit strings.

## Web/mobile behavior

No presentational UI was added. The API response supports a future correction
dialog that explains immutable history and an account archive action. Mobile
must call the same mutation online and must not derive confirmed balances from a
local draft.

## Verification

- Backend Prettier, ESLint and TypeScript checks — pass.
- Unit suite — 12 tests pass, including archive/history preservation,
  reversal/replacement, replay and projection equality.
- E2E suite — 2 tests pass.
- Nest build — pass.
- OpenAPI contract check — pass after adding archive/rebuild/replacement paths.

## Migration/security notes

The rebuild deliberately includes both voided source journals and their
compensating entries, preserving an auditable append-only source. Account and
transaction authorization is enforced server-side before projection or
mutation. No financial rows are hard-deleted.

## Follow-ups / exit gap

- Replace in-memory writes with Prisma transaction boundaries and deterministic
  row locks.
- Add cleared/reconciled balance checkpoints and source-link tables.
- Add `expectedVersion`/optimistic concurrency for mutable workflow commands.
- Add web account/correction UI and full cursor pagination.
