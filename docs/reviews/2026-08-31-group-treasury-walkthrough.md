# Group Treasury walkthrough — 2026-08-31

## Scope

This Phase 5 slice introduces a separate `group/` bounded context with:

- workspace participants and collection campaigns;
- participant obligations and partial contribution submissions;
- reviewer verification that posts one Ledger inflow;
- explicit overpayment `needs_user_action` handling;
- sponsored member-paid expense records;
- claims, self-approval prevention, payable snapshots and partial/full
  reimbursement transfers.

Split-receipt allocation, direct group-expense templates, durable source links,
workflow idempotency, and production persistence are not claimed complete.

## Business rules

1. Group records are workspace-scoped. A participant link does not grant
   membership or account access; every command first resolves an active core
   member.
2. Submission is evidence only. Verification validates the obligation's
   outstanding amount, marks overpayment as `needs_user_action`, or posts an
   exact VND inflow through the Ledger port and increments the obligation.
3. Sponsored expenses remain separate workflow values and do not change cash.
4. Claims can only be submitted by the claimant. A claimant cannot approve
   their own claim. Approval creates a payable without cash or a duplicate
   expense; reimbursement posts one transfer and updates payable/claim status.
5. Partial reimbursement is allowed, never exceeds the payable outstanding
   amount, and reaches `settled`/`paid` only on the final payment.

## Data flow

```text
participant -> collection -> obligation -> submission (no cash)
                                      -> verify -> Ledger income (cash)
participant -> claim (no cash) -> another member approves -> payable
                              -> payer transfer -> reimbursement settlement
```

`InMemoryGroupStore` depends on the core application `CoreStorePort`, so the
group service never imports NestJS, Prisma, HTTP DTOs or provider SDK types.

## Affected files/modules

- `backend/src/group/domain/group.types.ts` — participant, collection,
  submission, sponsorship, claim, payable and reimbursement records.
- `backend/src/group/application/group.ports.ts` — group store and Ledger ports.
- `backend/src/group/application/group.service.ts` — validated commands and
  MoneyDto response mapping.
- `backend/src/group/infrastructure/in-memory-group.store.ts` — state machine,
  authorization and Ledger adapter calls.
- `backend/src/group/presentation/group.controller.ts` — `/v1/workspaces/:id/group/*` routes.
- `backend/src/group/group.module.ts`, `backend/src/app.module.ts` — module wiring.
- `contracts/openapi.json` — group request/response paths and schemas.
- `backend/src/group/application/group.service.spec.ts` — end-to-end use-case
  coverage for contribution and reimbursement flows.

## Public API and client behavior

The controller exposes participant, collection, obligation, submission/verify,
sponsored expense, claim/approve/reimburse and payable list routes under
`/v1/workspaces/{workspaceId}/group`. Responses distinguish pending workflow
states from verified journal IDs and return all amounts as VND strings.

No web/mobile UI was added in this slice. Future screens must show pending
submissions as pending (not cash), block self-approval, and keep sponsored,
treasury and payable reports separate. Mobile submission/claim flows remain
online-only until the Phase 8 outbox is delivered.

## Migration/security implications

The group store is intentionally in-memory while Phase 0 database preflight is
incomplete. Verification and reimbursement call core Ledger posting, so account
scope, active-account and workspace checks remain server-side. Overpayment is
never silently applied. Production must add composite tenant constraints,
idempotency keys, durable audit/source links and reviewer policy roles.

## Verification

- Backend Prettier, ESLint and TypeScript checks — pass.
- Unit suites — 16 tests pass, including group submission no-balance behavior,
  verification posting, self-approval rejection and partial reimbursement.
- E2E suite — 2 tests pass.
- Nest build — pass.
- OpenAPI contract check — pass after group paths/schemas were added.
- `git diff --check` — pass before commit.

## Known gaps and follow-up

- Add receipt allocation across multiple obligations and explicit overpayment
  apply-credit/refund/obligation-adjustment commands.
- Add controlled direct-expense templates, claim rejection/withdrawal and
  reimbursement reversal.
- Add command idempotency/expectedVersion and durable authorization/audit rows.
- Add participant/campaign/reviewer web UI and separate group reports.
