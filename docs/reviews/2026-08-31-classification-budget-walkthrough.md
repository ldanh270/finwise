# Classification and budget walkthrough — 2026-08-31

## Scope

This Phase 4 slice adds a usable classification/planning loop on top of the
immutable ledger:

- two-level categories with archive semantics;
- workspace tags and line-level tag assignments;
- immutable transaction split/classification with exact VND sums;
- monthly budget periods with fixed/percentage constraints, descendant actuals,
  remaining totals and explicit close.

It does not claim the full Phase 4 exit: rollover/reopen/carry adjustments,
savings goals, CSV export, durable Prisma constraints and complete report
projections remain follow-ups.

## Business rules

1. Category depth is limited to a root and one child level. A parent with active
   children cannot receive a classification line; archive preserves history and
   requires children to be archived first.
2. Classification lines are positive bigint minor units, each points to one
   active leaf category, and their sum must exactly equal the transaction amount.
   Classification never posts another journal or changes account balance.
3. Tags are workspace-scoped and attached to lines only. Unknown, archived or
   cross-workspace tags are rejected.
4. A workspace has at most one budget period per month. Fixed allocations cannot
   exceed the base and percentage basis points cannot exceed 10000 in total.
   Percentage allocations use the base after fixed allocations.
5. Budget actuals include only visible, posted expense transactions whose
   effective date is in the period. A constraint includes descendant category
   lines; transfers/opening/voided/pending rows are excluded.

## Data flow

```text
transaction -> classification command -> leaf/category/tag validation
            -> immutable ClassificationLine records

budget period + constraints + visible classifications
            -> fixed/percentage allocation -> descendant actuals
            -> allocated/actual/remaining response
```

Application ports carry bigint values and domain records; HTTP DTO parsing and
response mapping stay in `CoreService`.

## Affected files/modules

- `backend/src/core/domain/ledger.types.ts` — category/tag/classification and
  budget records plus permissions.
- `backend/src/core/application/core.ports.ts` — classification and budget
  ports/projections.
- `backend/src/core/application/core.service.ts` — boundary validation and
  MoneyDto responses.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — scoped maps,
  invariants, descendant aggregation and close state.
- `backend/src/core/presentation/core.controller.ts` — category/tag,
  classification and budget routes.
- `contracts/openapi.json` — public schemas and paths.
- `docs/implementation-plan/README.md` and Phase 4 plan — status/evidence.

## Public API and client behavior

| Method | Path | Behavior |
| --- | --- | --- |
| GET/POST | `/v1/workspaces/:workspaceId/categories` | List/create category tree. |
| POST | `/v1/workspaces/:workspaceId/categories/:categoryId/archive` | Archive an unused leaf. |
| GET/POST | `/v1/workspaces/:workspaceId/tags` | List/create workspace tags. |
| POST/GET | `/v1/workspaces/:workspaceId/transactions/:transactionId/classification` | Save once/read split lines. |
| GET/POST | `/v1/workspaces/:workspaceId/budgets` | List/create monthly period. |
| GET | `/v1/workspaces/:workspaceId/budgets/:month` | Return allocation, visible actuals and remaining. |
| POST | `/v1/workspaces/:workspaceId/budgets/:month/close` | Freeze the open period. |

No presentational UI was added yet; web/mobile will consume these generated
client-ready contracts with exact VND strings and loading/empty/error/denied
states in their respective slices.

## Migration/security implications

All records remain in the in-memory adapter until Phase 0 proves whether a
database baseline can be safely replaced. Workspace membership and account
visibility are checked before classification/report aggregation. No account
balance or financial journal is overwritten by budget operations.

## Verification

- Backend Prettier, ESLint and TypeScript checks — pass.
- Unit suite — 14 tests pass, including category depth, exact split sums,
  balance preservation, descendant actuals and period close.
- E2E suite — 2 tests pass.
- Nest build — pass.
- OpenAPI contract check — pass.
- `git diff --check` — pass before commit.

## Known gaps and follow-up

- Implement BY_CHILDREN/SHARED_POOL/HYBRID semantics beyond the common
  allocation baseline, rollover modes, period reopen and audited carry.
- Add category/report projection endpoints, CSV export and savings goals.
- Move maps to Prisma with composite tenant constraints, revisions and locks.
- Add web category/split/budget editors and permission-aware dashboard states.
