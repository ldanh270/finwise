# Phase 9 — Wealth modules and bank beta

Status: Loan/investment API boundary complete with workspace authorization and idempotent snapshot-backed writes; normalized persistence and bank provider work remain
Depends on: ledger source links, access policies, ingestion/reconciliation, Phase 7 release controls  
Blocks: none for MVP

## Objective

Add savings goals, lending, investments, and the first provider-neutral bank
adapter only after the core ledger/inbox contracts are stable and a provider
passes sandbox, Vietnam coverage, consent, token-lifecycle, and commercial gates.

## Business rules

- Savings goals use target/date with manual progress or one linked savings
  account; show the progress method and do not claim funds are reserved.
- Lending distinguishes `LENT` receivables from `BORROWED` liabilities. Contracts
  own immutable schedule versions, due items, and allocation policy. MVP
  expansion ships interest-free plus one explicit reducing-balance convention,
  cash-basis actual postings, and labeled unpaid interest projections.
  Allocation defaults `fee → interest → principal`; overdue is not payment.
- Investments model exact-quantity instruments (stock, crypto, gold),
  portfolios, trades, acquisition data, and manual valuation snapshots. Buy/sell
  cash effect and position event commit atomically. Valuation is not cash income;
  realized and unrealized gain remain separate. Display weighted-average cost
  while preserving lot data; defer short, margin, staking, corporate actions,
  tax claims, and automated price mutation.
- Bank adapters return provider-neutral normalized records. Pending provider
  data remains inbox evidence; only posted provider records can be confirmed.
  Consent, refresh/revocation, custody delegation, encryption, and provider
  source IDs are explicit. Retries must be idempotent.
- Add BullMQ/Redis/worker only when sync, large imports, notifications, or price
  feeds require durable background work. PostgreSQL remains financial truth;
  queue payloads contain IDs, not credentials or raw bank payloads.

## Data flow

```text
loan/trade/bank provider -> normalized context record -> policy/review
 -> Ledger posting through application port + audit/source link
 -> projections/reporting -> outbox worker for external notification/sync
```

Loan schedules and investment valuations are projections/expectations; only
confirmed events post. Provider disconnect/revocation disables new sync writes
but preserves normalized history and existing journals.

## Schema and API surface

Savings: `SavingsGoal`, progress/link snapshots. Lending: `LoanContract`,
`LoanScheduleVersion`, `DueItem`, `LoanPayment`, `PaymentAllocation`,
`LoanAdjustment`. Investments: `Portfolio`, `Instrument`, `Trade`,
`PositionEvent`, `ValuationSnapshot`, rebuildable position projections. Bank:
`BankConnection`, consent/token metadata, provider account mapping,
`ProviderRecord`, sync run/outcome, and source links.

Expose goal progress; loan contract/schedule/due/payment/allocation; portfolio,
instrument, trade, valuation, position, and net-worth views; bank connect,
consent/revoke, sync status, inbox, and confirmation APIs. All commands use
typed Money/Decimal DTOs, idempotency, actor/workspace scope, and safe errors.

## Client behavior

Web leads contract/schedule setup, investment trade/valuation entry, bank
consent/sync/review, detailed reports, stale valuation and expected-vs-actual
labels. Mobile consumes daily balances, goal progress, loan due summaries, and
review notifications after online support exists; it cannot confirm bank data
offline. Both clients clearly distinguish projected, pending, confirmed,
realized, and unrealized values.

## Test matrix

| Area | Required cases |
| --- | --- |
| Goals | manual/linked progress, clear no-reservation semantics |
| Lending | schedule versioning, partial/early payment, fee-interest-principal allocation, cash vs projection |
| Investments | exact quantities, weighted-average display/lots, buy/sell atomicity, valuation not cash |
| Bank | consent/revoke, token secrecy, normalization, pending visibility, duplicate sync, provider failure |
| Persistence | source/idempotency uniqueness, projection rebuild, tenant/account policy |
| Jobs | outbox atomicity, retry/backoff, duplicate delivery, small non-sensitive payload |
| API/UI | expected-vs-actual labels, stale prices, permission/denied/error states |

## Migration notes

Do not infer loan principal, investment holdings, or bank confirmation from
generic legacy accounts. Import historical evidence into context-specific
unconfirmed/adjustment workflows, preserve original references, and reconcile
against Phase 3 balances. Provider selection and credentials are operations
gates; code must remain adapter/provider-neutral.

## Exit criteria

- Wealth modules preserve expected-vs-actual and valuation-vs-cash boundaries,
  with passing schedule/quantity/projection rebuild tests.
- A selected bank provider can sync/retry into the shared inbox without duplicate
  records or journals, and revoked/pending data is handled safely.
- Worker failure cannot roll back committed financial truth or leak secrets.

## Delivered slices

- 2026-09-02: exposed the loan schedule/payment and manual investment
  trade/valuation application slice through authenticated workspace-scoped
  REST endpoints. Commands require `Idempotency-Key`, replay the same result,
  reject payload reuse, and preserve bigint values as decimal strings. The
  transitional snapshot adapter persists the wealth store; normalized Prisma
  models and bank-provider integration remain release gates. See the [wealth
  API walkthrough](../../reviews/2026-09-02-wealth-api-boundary-walkthrough.md).

- 2026-08-31: exact bigint loan schedules/payment allocation and weighted-
  average investment position/valuation calculators. See the [change
  walkthrough](../../reviews/2026-08-31-wealth-domain-calculators-walkthrough.md).
- 2026-08-31: workspace-scoped application ports now orchestrate version-one
  loan schedules, repeat payment allocation, investment trades, and valuation
  snapshots over the pure calculators. See the [wealth application boundary walkthrough](../../reviews/2026-08-31-wealth-application-boundary-walkthrough.md).

The phase remains open until context persistence, confirmed-ledger
coordination, portfolio/loan APIs, and a provider-gated bank adapter pass their
respective tests and security review.
