# Finwise domain design index

Status: Proposed domain architecture for product-owner review  
Last updated: 2026-08-26

This directory explains the alternatives considered for each Finwise bounded
context, their trade-offs, and the recommended business model. A recommendation
is not a confirmed product decision until it is copied into the decision log as
Confirmed.

## Architectural posture

Finwise should begin as a **modular monolith** with one PostgreSQL database and
clear domain/application boundaries. This gives financial writes a simple local
transaction boundary while retaining the option to extract a module later.

The alternatives are:

| Direction | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| One CRUD module organized around database tables | Fastest prototype | Business rules scatter across controllers and UI; authorization and balance rules become inconsistent | Reject |
| Modular monolith with bounded contexts | Local atomic writes, simpler deployment, explicit ownership and test boundaries | Requires discipline in module dependencies and mapping | Recommend |
| Microservices from the beginning | Independent deployment and scaling | Distributed transactions, eventual consistency, operational overhead, difficult debugging | Reject until measured scale or team ownership requires it |

Within each backend module, dependencies point inward:

```text
domain <- application use cases <- HTTP/queue adapters <- infrastructure
```

Domain and application code must not import NestJS, Prisma models, provider
SDKs, or frontend types. Modules exchange IDs, commands, results, and explicit
events; they must not import one another's persistence models.

## Context map

| Context | Owns | Does not own | Relationship |
| --- | --- | --- | --- |
| Identity | Login identity, credentials/provider subject, user lifecycle | Workspace roles or financial access | Supplies `UserId` to Workspace |
| Workspace & Access | Workspace, membership, invitations, roles, permissions, account-access policies | Authentication secrets or financial balances | Upstream policy provider for every workspace context |
| Ledger & Transactions | Financial accounts, immutable posted journals, entries, reversals, balance checkpoints | Raw imports, budgets, loan schedules, market prices | Source of truth for money balances |
| Classification & Planning | Budget buckets, tags, budget plans/periods, goals | Account balances or bank data | Consumes posted ledger allocation data |
| Ingestion & Reconciliation | Bank connections, file imports, normalized records, matching, inbox review, statement checkpoints | Posted financial history after confirmation | Creates or matches ledger transactions through a port |
| Group Treasury | Participants, collections, obligations, submissions, claims, reimbursements | General peer-to-peer debt optimization | Requests ledger posting when group money really moves |
| Lending | Loan contracts, schedule versions, due items, allocation rules | Assuming a due item was paid | Posts confirmed disbursement/repayment components to Ledger |
| Investments | Instruments, portfolios, trades, position quantities, valuation snapshots | Treating price movement as cash income | Coordinates trade cash postings with position events |
| Reporting | Permission-filtered read models and projections | Authoritative financial writes | Downstream of all relevant contexts |
| Billing & Entitlements | Subscription, plan limits, feature availability | Workspace member authorization | Future context; limits capability availability, not data ownership |

## Dependency and consistency rules

1. Workspace is the tenant boundary. Every workspace-owned aggregate carries a
   `WorkspaceId`; cross-workspace references are rejected at the use-case and
   database boundaries.
2. A domain command that changes multiple ledger records commits in one local
   database transaction.
3. Posted ledger data is the balance source of truth. Projections and caches
   are disposable and rebuildable.
4. Raw provider records and mutable workflow submissions are not ledger
   transactions. Only a successful confirmation/posting crosses that boundary.
5. Synchronous application orchestration is preferred while all modules share
   one process/database. Introduce an outbox for notifications or external side
   effects that must survive process failure; do not add a message broker merely
   to make the architecture look distributed.
6. Reporting uses dedicated read models when joins and aggregations become
   complex. This is pragmatic read/write separation, not a requirement for full
   CQRS or event sourcing.
7. Domain events are emitted only after the database transaction commits.

## Domain documents

1. [`01-identity-workspace-access.md`](01-identity-workspace-access.md)
2. [`02-ledger-transactions.md`](02-ledger-transactions.md)
3. [`03-ingestion-reconciliation.md`](03-ingestion-reconciliation.md)
4. [`04-classification-budgeting-goals.md`](04-classification-budgeting-goals.md)
5. [`05-group-treasury.md`](05-group-treasury.md)
6. [`06-loans-investments-reporting.md`](06-loans-investments-reporting.md)

## Cross-context terms that must remain distinct

| Terms | Difference |
| --- | --- |
| Account balance vs budget remaining | Balance is actual money/value; budget remaining is a planning calculation |
| User vs member vs participant | User authenticates; member receives workspace access; participant is a workspace-scoped real-world person and may have no account |
| Imported record vs transaction | Imported record is external evidence awaiting a decision; transaction is posted financial truth |
| Loan schedule item vs repayment | Schedule item is expected; repayment is an actual confirmed event |
| Investment valuation vs income | Valuation estimates current worth; only realized proceeds/income produce appropriate financial postings |
| Permission vs entitlement | Permission answers who may act in a workspace; entitlement answers whether the subscription includes the capability |
