# Wealth domain calculators walkthrough — 2026-08-31

## Scope

This expansion slice adds framework-independent loan and investment calculation
primitives. Loans support interest-free schedules and one explicit
reducing-balance convention (equal principal, opening-balance monthly interest
floored to whole VND units), plus deterministic fee → interest → principal
payment allocation. Investments project exact scaled quantities, weighted
average cost basis, realized gain, and valuation/unrealized gain without
posting valuation as cash income.

## Non-goals

- No Prisma tables, REST routes, ledger posting adapter, portfolio UI, or bank
  provider was added.
- Schedule versions, due-item persistence, manual trade commands, source links,
  idempotency records, and provider consent/sync remain the next application
  slices.

## Affected files and modules

- `backend/src/wealth/domain/wealth.types.ts` — exact bigint domain records.
- `backend/src/wealth/domain/loan-calculator.ts` — schedule and payment rules.
- `backend/src/wealth/domain/investment-calculator.ts` — position/valuation
  projections.
- `backend/src/wealth/domain/index.ts` — bounded-context exports.
- `backend/src/wealth/domain/wealth-calculators.spec.ts` — schedule, allocation,
  quantity, and valuation tests.

## Business rules

- Loan principal, fees, interest, quantities, and costs use `bigint`; no
  JavaScript floating-point arithmetic is used.
- The reducing-balance convention is explicit and deterministic: equal
  principal installments, interest based on opening principal and
  `annualRateBasisPoints / (12 * 10_000)`, rounded down to whole minor units.
- Payment allocation consumes fee first, then interest, then principal; excess
  remains unapplied for deliberate user handling.
- Sell trades cannot exceed the current position. Weighted-average cost basis
  is reduced proportionally; realized gain is separate from remaining basis.
- Valuation computes market/unrealized gain only and does not create a ledger
  income event.

## Data flow

```text
validated contract/trade inputs -> pure calculator
 -> immutable schedule/position projection
 -> future application port -> ledger only for confirmed cash events
```

## Public API and UI behavior

The bounded context exports pure functions for application services:
`buildInterestFreeSchedule`, `buildReducingBalanceSchedule`,
`allocatePayment`, `projectPositions`, and `addValuation`. No UI or HTTP
contract is claimed as shipped in this slice.

## Migration and security implications

There is no schema migration. Future persistence must preserve schedule/trade
versions and exact quantities, and must keep provider credentials/raw bank
payloads outside domain records and logs. A bank adapter must normalize pending
records into review evidence before any confirmed ledger posting.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Wealth Jest suite: passed (3 tests).
- Nest build: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add loan contract/schedule/payment persistence and application ports with
   expected-vs-actual labels and idempotent confirmed cash postings.
2. Add portfolio/trade/valuation commands and rebuildable position projections.
3. Select a bank provider only after sandbox, Vietnam coverage, consent/token
   lifecycle, and commercial gates; then add provider-neutral inbox sync.

## Commit message

`feat(wealth): add exact loan and investment domain calculators`

The body should state that the formulas are pure bigint projections and that
valuation remains outside cash income until application/persistence slices are
implemented.
