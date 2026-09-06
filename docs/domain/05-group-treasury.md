# Group Treasury domain

Status: Proposed around confirmed participant, collection, submission, and reimbursement requirements  
Last updated: 2026-08-26

## 1. Why a group workspace exists

A group workspace is the financial book for money and obligations managed on
behalf of a group: a class fund, family household, trip fund, club, or small
community. It answers:

- how much money the group actually controls;
- who was expected to contribute and what was actually received;
- what the group spent and from which group account;
- which member-paid costs were donated or should be reimbursed;
- who submitted, verified, approved, and posted each event.

It is not merely a notes area. It has real treasury accounts and posted
transactions. It also stores non-financial workflow records that do **not**
change balance until the relevant real-world money movement is verified.

## 2. Scope alternatives

### Option A: shared treasury only

Tracks group-owned cash/bank, contributions received, and direct spending.

- Pros: clearest accounting and smallest scope.
- Cons: cannot accurately represent member-paid expenses or reimbursement.

### Option B: treasury plus collection and reimbursement workflow

Adds participant obligations, submissions, sponsored expenses, claims, and
reimbursement status while keeping actual treasury movement separate.

- Pros: covers class/family use cases; no false balance changes; approval is
  explicit; substantially simpler than peer-debt settlement.
- Cons: more workflow states and reports; payer/beneficiary details matter.

### Option C: full Splitwise-style allocation and settlement

Continuously calculates each participant's share, pairwise/net debt, settlement
payments, partial allocation, and debt simplification.

- Pros: ideal when the primary problem is “who owes whom.”
- Cons: a separate debt engine; complex participant changes, partial payments,
  rounding, multi-payer expenses, and settlement corrections; easily confused
  with treasury cash.

**Recommendation: Option B for Finwise's first group module.** It matches the
confirmed class/family treasury direction. Keep Option C as a later bounded
capability rather than adding unused debt fields to every group transaction.

## 3. Actors and identities

### User

Authenticated platform identity. A user can join many workspaces.

### WorkspaceMembership

The user's authorization relationship to this group. Roles and permissions
determine what they may submit, approve, post, or view.

### Participant

The group-scoped real-world person/entity used in obligations, contributions,
claims, sponsorship, and reports. It may have no Finwise account. A participant
may optionally link to one membership.

Important rules:

1. Creating a participant never creates login access.
2. Inviting a user never automatically merges similarly named participants.
3. Linking requires authorized confirmation; historical records keep the same
   participant ID.
4. Duplicate participants can be merged through an audited operation that
   reassigns references but preserves aliases/history.
5. Removing a membership unlinks/revokes access but does not delete the
   participant or financial history.

The participant does not need a personal account inside the group workspace.
Only accounts whose money is controlled by the group belong there.

## 4. Who may create what

Separate these actions:

| Action | Meaning | Balance changes? | Typical permission |
| --- | --- | --- | --- |
| Submit contribution evidence | “Participant says they paid” | No | `contribution.submit` |
| Verify contribution received | Treasurer confirms cash/bank received | Yes, creates group income/posting | `contribution.verify` + account scope |
| Submit direct group expense | Proposed use of group money | No until approved/posted | `transaction.submit` |
| Post direct group expense | Group cash/bank actually paid | Yes | `transaction.post` + account scope |
| Submit member-paid claim | Member paid personally for group benefit | No treasury balance change | `claim.submit` |
| Approve claim | Group accepts it as reimbursable expense | No cash movement; creates approved obligation | `claim.approve` |
| Post reimbursement | Group pays the member from group account | Yes; settles approved claim | `reimbursement.post` + account scope |
| Record sponsorship | Member bore cost with no repayment expected | No group balance | `claim.submit` or dedicated permission |

A family may grant `transaction.post` to all trusted adults, effectively
skipping approval. A class fund may only grant submit permissions to members and
reserve verification/posting for the treasurer. The workspace template sets
defaults; permissions decide the actual rule.

## 5. Maker-checker alternatives

### Mandatory approval for everything

- Pros: strongest control.
- Cons: burdens family use; owner/treasurer becomes bottleneck.

### Anyone with create permission posts immediately

- Pros: fast and familiar for trusted groups.
- Cons: unsuitable for class funds and weak fraud/error control.

### Submission and direct-post are separate capabilities

**Recommendation.** A member with only submit permission creates a pending
record; a member with post permission can post directly. For controlled
templates, default to “submitter cannot approve their own submission,” but allow
the owner to configure self-approval for small trusted groups. Always require
account scope for the financial posting.

## 6. Collection campaign model

### CollectionCampaign

Defines purpose, due date, status, default requested amount, optional budget,
and whether late/partial contributions are allowed.

### ContributionObligation

One per participant, with requested amount (copied from default or customized),
waiver/adjustment history, due status, and amount received derived from verified
allocations.

### ContributionSubmission

Evidence from a participant/member: amount, paid date, payment method, receipt,
note, submitter, and intended participant/obligation. It does not change group
balance.

### ContributionReceipt allocation

When a treasurer verifies actual money received, one posted group-account inflow
is created and allocated to one or more obligations. This supports:

- partial payment;
- one transfer covering several collection obligations;
- one parent paying for multiple participants;
- overpayment recorded as unallocated credit or explicitly applied elsewhere.

Recommended obligation state is derived, not manually toggled:

```text
received = sum(verified allocations) - reversed allocations
remaining = requested - received
status = waived | unpaid | partial | paid | overpaid
```

Never mark an obligation paid merely because a submission exists.

## 7. Three expense flows

### A. Group account pays directly

Example: the class bank account pays 1,000,000 VND for food.

- Post one Ledger expense from the group bank account.
- It changes treasury balance and consumes the applicable treasury budget.
- Submit/approval steps depend on permissions.

### B. Member sponsors the group

Example: Lan personally buys 1,000,000 VND of food and does not want repayment.

- Record an approved sponsored expense with payer participant, budget, tags,
  receipt, and amount.
- It does not change a group account and does not consume treasury budget.
- Show it in a separate sponsored-value report so the contribution is visible.
- Optionally classify it as in-kind support, not group income plus expense; fake
  cash entries would overstate treasury cashflow.

### C. Member pays and expects reimbursement

Example: Lan personally pays 1,000,000 VND, and the group owes her repayment.

1. Claim submission: no treasury balance change.
2. Approval: recognizes one approved group expense and a reimbursement
   obligation, but still no cash account movement.
3. Reimbursement: posted 1,000,000 VND outflow from a group account, allocated
   to the claim.
4. Reporting counts the group expense once at the approved claim's effective
   date; reimbursement is settlement cashflow and is excluded from expense
   totals to prevent double counting.

Whether the approved obligation appears as a formal liability in net worth is a
policy choice. Recommendation: model it as a reimbursement payable so group net
worth is honest, while keeping “cash balance” unchanged.

## 8. Claim and reimbursement invariants

1. Approved amount may differ from submitted amount; store both and the reason.
2. Submitted claim can be edited/withdrawn before approval; approval freezes the
   accepted snapshot.
3. One claim can be reimbursed partially through multiple payments.
4. Sum of active reimbursements cannot exceed approved reimbursable amount
   without a privileged adjustment.
5. Reversing a reimbursement reopens the appropriate outstanding amount.
6. Rejecting a claim records actor, reason, and time; it posts nothing.
7. Changing sponsored to reimbursable after approval is a new audited decision,
   not an invisible flag edit.
8. A payer participant and submitter user can be different.

## 9. Group budget semantics

Alternatives for reimbursable claims:

### Count only when cash reimbursement happens

Simple cash basis, but approved obligations are invisible and a delayed payment
makes the expense appear in the wrong month.

### Count when the claim is submitted

Shows early pressure but unverified or rejected claims distort the budget.

### Count when the claim is approved

**Recommendation.** Approval is when the group accepts the expense and payable.
The later reimbursement changes cash but does not consume budget again. Direct
group expenses count when posted. Sponsored expenses remain outside treasury
budget as confirmed.

Budget views should optionally show:

- posted direct spending;
- approved reimbursable spending;
- pending claims as forecast, not actual;
- sponsored value separately.

## 10. Reporting model

Keep these measures separate:

1. treasury balance: actual group-owned account balances;
2. cashflow: actual posted inflows/outflows;
3. collection progress: requested, verified received, outstanding, overdue;
4. group expense: direct posted expenses + approved reimbursable claims once;
5. reimbursement payable: approved but not yet settled;
6. sponsored value: approved non-reimbursable member-paid cost;
7. workflow queue: pending contribution evidence, transaction submissions, and
   claims.

Never present collection submission totals as cash received or reimbursement
payments as additional expenses.

## 11. Notifications

Notifications are downstream side effects, not the source of workflow truth.
Useful events include obligation due/overdue, submission received, approval
requested, claim approved/rejected, partial reimbursement, and custodian action
required. Persist notification intent/outbox after the state change commits;
notification failure must not roll back a verified financial posting.

## 12. Decisions still needing product-owner confirmation

1. Confirm treasury + collection + reimbursement, without full Splitwise-style
   settlement in MVP.
2. Confirm approved reimbursable claim creates a payable for group net worth.
3. Confirm budget consumption at claim approval rather than reimbursement date.
4. Confirm controlled groups default to no self-approval while family templates
   may enable it.
5. Decide how overpaid collections work: unallocated participant credit, refund,
   or mandatory manual choice.
6. Decide whether one contribution receipt may allocate to multiple participants
   (recommended for parent/class scenarios).
