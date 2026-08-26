# Lending, investments, goals, reporting, and future entitlements

Status: Proposed around confirmed loan and manual-investment scope  
Last updated: 2026-08-26

## Part A: Lending

### 1. Business distinction

Finwise supports both directions:

- `LENT`: the workspace gave money and owns a receivable asset;
- `BORROWED`: the workspace received money and owes a liability.

Principal is not income or expense. Interest and fees are income/expense as
appropriate. A due schedule is an expectation; only confirmed disbursement and
repayment events change actual account/loan balances.

### 2. Modeling alternatives

#### Generic account plus notes

- Pros: minimal scope.
- Cons: cannot calculate schedules, principal/interest allocation, overdue
  amounts, reminders, or early payment.

#### One mutable loan record with current balance

- Pros: simple dashboard.
- Cons: balance loses its event history; schedule edits rewrite expectations;
  repayment components become ambiguous.

#### Loan contract + versioned schedule + actual payment allocations

- Pros: expected and actual stay distinct; supports interest strategies,
  partial/early payments, audit, reminders, and exact ledger postings.
- Cons: more domain objects and calculation tests.

**Recommendation:** contract + immutable schedule versions + actual payment
allocations. Current principal is derived from confirmed principal events, not
copied from the latest expected schedule item.

### 3. Core model

- `LoanContract`: direction, counterparty/participant snapshot, principal,
  disbursement date, term, interest strategy, rate convention, payment frequency,
  allocation policy, status.
- `LoanScheduleVersion`: immutable assumptions and generation time; an amendment
  creates a new version effective from a date.
- `DueItem`: due date and expected principal/interest/fee components.
- `LoanPayment`: actual confirmed payment linked to one money transaction.
- `PaymentAllocation`: exact amount applied to fees, interest, and principal,
  optionally across several due items.
- `LoanAdjustment`: approved principal/interest correction with reason.

### 4. Interest strategy alternatives

| Strategy | Meaning | Pros | Cons/use caution |
| --- | --- | --- | --- |
| Interest-free | Principal only | Common for friends/family; simplest | Still needs due schedule and partial payments |
| Flat/simple on original principal | Interest calculated from original principal for agreed term | Easy to explain and common in informal agreements | Effective cost can look lower than reducing-balance rate; early payoff rule must be explicit |
| Reducing balance/amortized | Interest calculated on outstanding principal; periodic payment may be level | Matches many formal loans; economically accurate | Requires day-count, rounding, frequency, and schedule strategy |
| Custom schedule | User enters expected component amounts | Represents irregular agreements | Finwise cannot validate rate economics; edits need versioning |

**Recommendation:** strategy port with `INTEREST_FREE`, `FLAT`,
`REDUCING_BALANCE`, and `CUSTOM`. For the first implementation, ship
interest-free + one well-specified reducing-balance convention before claiming
“all formulas.” Add flat/custom when their examples and rounding rules are
tested. A generic formula field is unsafe.

### 5. Required calculation conventions

A rate alone is insufficient. Store:

- annual vs monthly rate and nominal/effective meaning;
- day-count convention or fixed periodic convention;
- payment frequency and due-day handling;
- currency rounding at each component/payment;
- first/last irregular-period behavior;
- allocation order;
- early-payment strategy;
- grace/late-fee policy.

Recommended default allocation is fee -> accrued interest -> principal, but the
contract owns this policy. Never infer an allocation from one total payment
after the fact.

### 6. Cash vs accrual reporting

#### Cash basis only

Interest appears when paid. Simple and aligned with a personal tracker, but
outstanding earned/owed interest is invisible.

#### Full accrual into the money ledger

Recognizes interest over time. More complete net worth/income, but requires
daily/monthly jobs, reversals, and accounting rules users may not understand.

#### Contractual accrual projection plus cash-ledger actual

**Recommendation for MVP.** Show accrued/expected interest as a Lending
projection, clearly labeled unpaid. Post income/expense only on confirmed
payment. Later make accounting accrual an advanced option, never silently mix
the two bases in one report.

### 7. Repayment and early-payment rules

- One repayment may cover multiple due items and components.
- Partial payment updates actual allocation, while remaining due stays open.
- Extra principal is explicit; do not silently treat all excess as future
  interest.
- Early payoff choices: reduce future payment, shorten term, or custom lender
  quote. Store the chosen strategy and create a new schedule version.
- Passing a due date changes status to overdue and triggers reminders; it never
  creates a payment or reduces principal.
- Late fees should be explicit/manual in the first version because legality and
  contract practice vary. Never invent a fee automatically from a generic rule.

### 8. Ledger coordination

For `LENT` disbursement: decrease cash/bank and increase loan receivable. For
repayment: increase cash/bank, reduce receivable by principal, record interest
income and fee income separately. `BORROWED` mirrors this with a liability and
interest/fee expense. Lending payment record and all journal entries commit in
one unit of work.

### 9. Lending decisions to confirm

1. Which interest strategies ship first: recommended interest-free + reducing
   balance, or all four?
2. Confirm cash-basis ledger plus projected unpaid accrual for MVP.
3. Confirm default allocation fee -> interest -> principal, configurable per
   contract.
4. Choose early-payment default: shorten term or reduce periodic payment.
5. Confirm late fees are manual/explicit initially.

Reference: the [US Consumer Financial Protection Bureau explanation of loan
amortization](https://www.consumerfinance.gov/ask-cfpb/how-does-paying-down-a-mortgage-work-en-1943/)
illustrates why a level payment can contain changing principal/interest
components as the outstanding balance declines. Finwise still needs explicit
contract conventions rather than assuming every loan follows that example.

## Part B: Investments

### 10. Tracking alternatives

#### Current-value snapshots only

- Pros: fastest net-worth tracking for stocks, crypto, and gold.
- Cons: cannot explain performance, cost basis, realized gains, or cashflow.

#### Holdings plus trades, no valuation history

- Pros: position quantity and cost are explainable.
- Cons: historical net worth and price movement are unavailable.

#### Holdings/trades plus valuation snapshots

- Pros: correct separation of cash, quantity, cost basis, realized gain, and
  unrealized value; supports manual now and price providers later.
- Cons: requires quantity precision, instrument identity, and valuation policy.

**Recommendation:** holdings/trades plus manual valuation snapshots. The same
model later accepts provider prices through an adapter without rewriting trades.

### 11. Core model

- `Portfolio`: workspace-owned grouping and optional linked investment-cash
  account; this is not a workspace.
- `Instrument`: type (`STOCK`, `CRYPTO`, `GOLD`), symbol/name, quote currency,
  quantity unit, market metadata; user-defined instruments allowed for manual
  assets.
- `Trade`: buy/sell, quantity, unit price, fees, effective time, cash account,
  source/audit.
- `PositionEvent`: trade, transfer-in/out, split, reward, or audited adjustment.
- `ValuationSnapshot`: instrument/position price, source, as-of time, quote
  currency, confirmation state.
- `PositionProjection`: derived quantity, cost basis, realized gain, current
  value, and unrealized gain.

### 12. Investment invariants

1. Quantity uses an exact decimal with instrument-specific precision; VND money
   precision and crypto quantity precision are different concerns.
2. Buying is not ordinary spending: it exchanges cash for an asset position.
3. Selling is not ordinary income: proceeds contain returned cost plus realized
   gain/loss.
4. Fees are separate components and included consistently in cost basis/gain.
5. Price change creates a valuation, never a fake cash transaction.
6. Manual quantity/balance correction is an adjustment event with actor, reason,
   before/after, not an overwritten holding.
7. Trade cash effect and position event commit atomically.

### 13. Gold and crypto specifics

- Store a canonical quantity unit and explicit conversions. For gold, support
  user-facing gram/chỉ/lượng labels through exact conversion rules rather than
  embedding unit assumptions in amounts.
- Crypto instruments require enough quantity scale for small fractions and
  transaction/network fees that may use a different asset.
- Do not promise tax reporting in MVP. Cost-basis display method (weighted
  average or FIFO) must be labeled, versioned, and kept separate from any
  jurisdiction-specific tax claim.

Recommended first display method is weighted-average cost because it is easier
for manual tracking. Preserve lot-level acquisition data so FIFO or other views
can be added without losing information.

### 14. Valuation and net worth

- Manual price/total-value entry records source `USER` and as-of time.
- Stale valuations remain visible with an age warning; do not silently carry a
  price as current forever.
- Net worth uses the latest permitted valuation at/before the report time.
- Unrealized gain is displayed separately from realized income.
- Automatic price feeds later implement a price-provider port and do not gain
  permission to mutate trades.

### 15. Investment decisions to confirm

1. Confirm holdings/trades + manual valuation for the first investment version.
2. Confirm weighted-average display while preserving acquisition lots.
3. Confirm canonical quantity units with exact gold unit conversions.
4. Decide whether short positions, margin, staking, dividends, and corporate
   actions are all deferred (recommended).

## Part C: Reporting and entitlements

### 16. Reporting architecture

Alternatives:

- query normalized write tables for every screen: consistent but increasingly
  slow/complex and easy to leak hidden-account data;
- independent analytics database immediately: scalable but introduces delayed
  consistency and operations too early;
- permission-aware read projections in the same database: best initial balance.

**Recommendation:** maintain rebuildable read models/projections in the modular
monolith. This is not full event sourcing. Posted journals and context-owned
records remain authoritative.

### 17. Report definitions

| Report | Default basis | Important exclusions/separation |
| --- | --- | --- |
| Account balance | Posted ledger through effective time | Hidden accounts; provider-only pending data |
| Cashflow | External income/outflow on effective date | Same-workspace transfers, principal exchanges, valuations |
| Spending by category | Eligible expense lines | Transfers, investment buys, loan principal, sponsored group value |
| Budget vs actual | Budget period/effective date | Same rules as Planning document; reimbursement counted once |
| Net worth | Assets minus liabilities using permitted latest valuations | Goals and budgets are not assets; stale prices labeled |
| Group treasury | Actual group accounts | Submissions not verified, member personal accounts |
| Loan actual vs expected | Confirmed principal/payment vs active schedule | Due does not mean paid; projected accrual labeled |
| Portfolio performance | Trades, cashflows, valuations | Unrealized vs realized clearly separated |

Every report query receives actor/workspace context and account scope. A user
with partial visibility sees a partial-data indicator; totals must not leak
hidden values through subtraction, percentages, chart scales, counts, or export.

### 18. Projection consistency

- Store projection version/checkpoint and `updated_at`.
- A financial commit either updates critical balance projections in the same
  transaction or makes the result temporarily unavailable until a reliable
  projector catches up; never show fabricated success.
- Rebuild command recomputes from posted source records and compares totals.
- Notifications/search/analytics may use post-commit outbox processing.
- API exposes data freshness where delayed projections matter.

### 19. Billing and feature entitlement boundary

Future SaaS billing must not be mixed with workspace RBAC.

```text
entitlement: does this subscription include bank sync / more accounts / exports?
permission: may this member perform that action in this workspace?
```

An operation requiring a premium capability passes both gates. The workspace
owner manages billing, but owner status does not manufacture a missing paid
entitlement. On downgrade/expiry, prefer disabling new premium writes while
preserving read/export of user data and offering a grace/recovery path. Never
hide or delete financial history because a subscription ended.

### 20. Reporting/entitlement decisions to confirm

1. Confirm effective date as default for cashflow/budget and posted date for
   operational audit.
2. Confirm partial-data indicators when account visibility filters a report.
3. Confirm same-database rebuildable projections for the initial architecture.
4. Later: define subscription limits only after MVP usage validates which
   capabilities have value.
