# Phase 5 — Group Treasury MVP

Status: Ready after Phase 4  
Depends on: [Phase 2](02-IDENTITY-WORKSPACE-ACCESS.md), [Phase 3](03-LEDGER-ACCOUNTS-TRANSACTIONS.md), [Phase 4](04-CLASSIFICATION-BUDGETING-REPORTING.md)  
Unblocks: group-facing web MVP and future mobile group flows

## Objective

Support family/class/trip treasury workflows while keeping submissions and
claims separate from confirmed cash and excluding general peer-debt settlement.

## Business rules

- `Participant` is workspace-scoped and may be a non-user. Linking to a member
  never grants access; merge/link operations are authorized and audited.
- Collection campaigns define purpose, due date, default requested amount,
  category, and partial/late policy. Each participant receives a copied or
  custom obligation. Status derives from verified allocations:
  `waived|unpaid|partial|paid|overpaid`.
- Submission is evidence and never changes balance. Verification by a permitted
  reviewer posts group-account inflow and allocates one receipt to one or more
  obligations. Overpayment always reaches `NEEDS_USER_ACTION` for credit,
  refund, or obligation adjustment; never auto-hide it.
- Direct group spending posts a Ledger expense when the authorized actor posts;
  controlled templates separate submit and post and default to no self-approval.
  Family templates may explicitly allow self-approval.
- Sponsored member-paid expense records value, payer, category, and receipt but
  changes no group account and consumes no treasury budget. It is reported
  separately.
- Reimbursable claim: submit (no balance), approve (freeze accepted amount,
  create group expense/payable, no cash), reimburse (post group cash outflow and
  settle payable). Multiple partial reimbursements are allowed; total cannot
  exceed approved amount without audited adjustment. Reimbursement does not
  count expense twice.
- All posting commands enforce account scope, workspace membership, business
  state, actor/submitter separation when required, and idempotency.

## Data flow

```text
participant/campaign -> obligation -> submission or claim (workflow only)
 -> authorized verify/approve -> Ledger posting or payable snapshot
 -> allocation/report projection -> audit/outbox notification after commit
```

Domain writes and Ledger postings share a Unit of Work. Notification failure
must not roll back a verified contribution, approved claim, or reimbursement.

## Schema and API surface

Create `Participant`, participant-link/alias records, `CollectionCampaign`,
`ContributionObligation`, `ContributionSubmission`, `ContributionReceipt`,
`ReceiptAllocation`, `SponsoredExpense`, `Claim`, `ClaimApproval`,
`ReimbursementPayable`, `ReimbursementPayment`, and group report projections.
Store submitted and approved amounts separately, lifecycle versions, actor/time/
reason, and Ledger source links. Use tenant composite keys and unique active
allocation/idempotency references.

Expose:

- participant CRUD/link/merge;
- campaign/obligation list and progress;
- contribution submission, review, verify, allocate, and overpayment action;
- direct group expense submit/post;
- claim submit/edit/withdraw/approve/reject and sponsored conversion workflow;
- reimbursement post/reverse and payable status;
- separate treasury balance/cashflow, collection, group expense, payable,
  sponsored-value, and workflow-queue reports.

## Client behavior

Web leads participant/campaign setup, partial collection progress, reviewer inbox,
receipt allocation, claim approval, overpayment resolution, reimbursement, and
separate reports. UI shows pending values as pending, not cash; self-approval and
account-scope controls are visible. All screens handle loading, stale, empty,
retryable, business-error, denied, and partial-data states.

Mobile later supports contribution/claim submission, receipt capture, and an
approval inbox through the same commands. It does not locally post or invent
treasury balances; offline submission is out of the initial mobile offline scope.

## Test matrix

| Area | Required cases |
| --- | --- |
| Participants | non-user participant, link/unlink, audited merge, revoked membership |
| Collections | common/custom target, partial/multi-participant allocation, waiver, overpayment |
| Workflow | submission no balance, verification posting, idempotent retry, reviewer scope |
| Expenses | direct treasury, sponsored exclusion, approved claim payable, partial reimbursement |
| Safety | no self-approval in controlled mode, actor/submitter distinction, over-allocation rejection |
| Reporting | expense once, reimbursement not duplicate, sponsored separate, pending not cash |
| Persistence/API | tenant constraints, source links, version conflicts, typed errors |
| UI | reviewer/submitter views, loading/empty/error/denied/partial states |

## Migration notes

Existing notes or group rows are not ledger transactions. Import them as
participants/campaign metadata only, mark amounts as unverified, and require
review before creating any Ledger source link. If historical group cash exists,
reconcile it through Phase 3 opening/adjustment journals and preserve the
original evidence.

## Exit criteria

- Collection partial payment, shared receipt allocation, direct treasury spend,
  sponsored expense, approved payable, and partial reimbursement run end to end.
- No submission/approval changes balance before the specified posting action.
- Group reports keep cash, expense, payable, sponsored value, and pending queue
  distinct and do not double count reimbursements.
