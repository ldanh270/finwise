# Group Treasury MVP application phase walkthrough — 2026-08-31

## Scope

This phase batch completes the usable in-memory Group Treasury application
slice: collection progress, one-receipt multi-participant allocation, explicit
overpayment decisions, direct group-account expenses, and a separate summary
report. Existing participant, submission, verification, sponsored expense,
claim, payable, and partial reimbursement flows remain covered.

## Non-goals

- Prisma persistence, composite database constraints, durable audit/source-link
  rows, and transactional row locking remain blocked on the Phase 0 database
  environment decision.
- Controlled submit/approve templates, claim edit/withdraw/reversal, and
  notification outbox are not introduced here.
- The `refund` overpayment choice records a rejected workflow state without
  inventing a participant account or fake cash journal; a future refund flow
  needs an explicit destination account and audited transfer policy.
- The web dashboard now includes the read/progress/direct-expense vertical
  slice; participant/reviewer screens and mobile flows remain follow-up work.

## Affected files and modules

- `backend/src/group/domain/group.types.ts` — allocation resolution and direct
  expense records.
- `backend/src/group/application/group.ports.ts` — allocation, resolution,
  direct expense, and report ports.
- `backend/src/group/application/group.service.ts` — boundary validation,
  exact aggregation, idempotent direct expense command, and report mapping.
- `backend/src/group/infrastructure/in-memory-group.store.ts` — atomic
  allocation validation, overpayment state machine, Ledger expense posting,
  and scoped report records.
- `backend/src/group/presentation/group.controller.ts` — verification
  resolution, direct expense, and summary routes.
- `backend/src/group/application/group.service.spec.ts` — multi-participant,
  report, direct expense retry, and overpayment coverage.
- `contracts/openapi.json` — request/response contracts and error outcomes.
- `frontend/src/features/group` and dashboard wiring — workspace-scoped group
  progress/report UI and idempotent direct-expense form.

## Business rules

1. A contribution receipt posts at most one Ledger inflow. Optional allocation
   lines must be positive, workspace/collection-scoped, and sum exactly to the
   submitted amount before any balance changes.
2. An overpayment transitions to `needs_user_action` and cannot post until the
   reviewer chooses `apply_credit`, `adjust_obligation`, or `refund`.
3. `apply_credit` posts the full receipt and preserves the excess as an
   unallocated credit record; `adjust_obligation` increases the obligation by
   the excess before recording full payment; `refund` records a non-posting
   rejection decision.
4. Direct group expenses post a balanced Ledger expense from a visible,
   workspace-scoped account and require `Idempotency-Key`.
5. The report keeps collection expected/received, pending evidence, direct
   expenses, approved claim expense, sponsored value, and open payables as
   separate measures. Reimbursements are not added to expense totals again.
6. All monetary arithmetic uses `bigint` and VND minor-unit strings.

## Data flow

```text
submission -> optional allocation lines -> validate exact sum/outstanding
           -> one Ledger income -> obligation allocation
overpayment -> explicit reviewer resolution -> credit/adjust/reject state
direct expense -> scoped account -> balanced Ledger expense -> report record
all workflow records -> workspace-scoped report summary (no pending cash)
```

## Public API and UI behavior

- `POST /v1/workspaces/:workspaceId/group/submissions/:submissionId/verify`
  accepts optional `allocations[]`.
- `POST /v1/workspaces/:workspaceId/group/submissions/:submissionId/resolve-overpayment`
  accepts the explicit resolution enum.
- `GET/POST /v1/workspaces/:workspaceId/group/expenses` lists or posts direct
  expenses; posting requires `Idempotency-Key`.
- `GET /v1/workspaces/:workspaceId/group/reports/summary` returns typed,
  permission-filtered aggregate measures.

Future clients should display pending submissions separately from received
cash, show overpayment action choices, and never infer group treasury balance
from sponsored or approved-but-unpaid values.

The web slice follows those rules and refreshes the report after a successful
direct expense command.

## Migration and security implications

No migration is added. All new records are currently held by the in-memory
adapter. A persistent implementation must use composite workspace keys,
unique active allocation/source/idempotency constraints, immutable journal
links, and a transaction boundary covering allocation plus Ledger posting.
The controller remains guarded; stores re-check membership and account scope.
Error responses do not expose provider or database internals.

## Verification

- Group service Jest suite: passed (7 tests).
- Backend TypeScript check: passed.
- OpenAPI contract check: passed.
- Frontend ESLint, TypeScript, and Next production build: passed.
- `git diff --check`: passed.
- Full backend Jest/Nest build should be rerun at the phase commit gate.

## Known gaps and follow-up

1. Resolve the Phase 0 database preflight and implement durable Group Treasury
   repositories/migrations without discarding existing data.
2. Add controlled expense templates, claim lifecycle edits/reversal, durable
   audit/source links, and a true refund transfer workflow.
3. Add web reviewer/progress/report screens and mobile online commands.

## Commit message

`feat(group): complete core treasury workflow slice`

The body should mention one-receipt allocation, explicit overpayment decisions,
direct group expense posting, and separated report measures.
