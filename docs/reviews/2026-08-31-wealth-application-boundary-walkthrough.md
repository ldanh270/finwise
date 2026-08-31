# Wealth application boundary walkthrough

Date: 2026-08-31
Phase: 9 — Wealth modules and bank beta
Status: Implemented as an in-memory application slice; persistence, API, and provider gates remain.

## Scope and non-goals

This slice turns the pure wealth calculators into workspace-scoped application ports. It creates immutable loan schedule records, allocates repeat payments against remaining fee/interest/principal, records exact-quantity investment trades, and stores valuation projections separately from trades.

It does not add REST controllers, Prisma models, ledger cash-posting coordination, savings-goal UI, bank providers, consent/token storage, workers, or automated prices.

## Affected files and modules

- `backend/src/wealth/application/wealth.ports.ts` — loan/trade/valuation records and focused store/input ports.
- `backend/src/wealth/application/wealth.service.ts` — schedule creation, payment allocation, trade projection, and valuation orchestration.
- `backend/src/wealth/infrastructure/in-memory-wealth.store.ts` — workspace-isolated adapter used by tests and development.
- `backend/src/wealth/application/wealth.service.spec.ts` — exact-bigint application coverage.
- `mobile` and frontend are intentionally unchanged; this is an expansion backend boundary.

## Business rules

- Loan schedules are versioned from version one and retain exact `bigint` principal, rate, fee, and due values.
- Interest-free and reducing-balance schedules use the already-approved domain calculators; the application layer does not introduce a second formula.
- Repeated payments for one installment subtract prior allocations before applying the next payment in `fee → interest → principal` order. Overpayment remains unapplied for explicit user handling.
- Investment trades are projected from the complete workspace trade history before a new trade is stored; selling beyond the position is rejected by the domain.
- Valuation stores market value/unrealized gain only. It does not create cash income or a ledger transaction.
- Every store lookup includes `workspaceId`, preventing cross-workspace loan/payment/trade reads.

## Data flow

```text
workspace command -> WealthService -> pure bigint calculator
                  -> in-memory port -> immutable record/projection
loan payment      -> prior allocations + due item -> new allocation
trade/valuation   -> position rebuild -> weighted-average/market projection
```

The application service is framework-independent and can later receive PostgreSQL and Ledger ports without moving provider or HTTP code into the domain.

## Public API and UI behavior

No HTTP or UI contract is claimed as shipped. The internal application surface includes `createLoan`, `recordLoanPayment`, `recordInvestmentTrade`, `recordInvestmentValuation`, and `listInvestmentPositions`, plus focused persistence ports. REST DTO mapping and expected-vs-actual UI labels remain follow-up slices.

## Migration and security implications

No database migration is added. The in-memory adapter is not production financial storage. A production adapter must persist schedule versions, payment allocation evidence, trade lots, valuation snapshots, idempotency, audit/source links, and tenant constraints atomically. Provider credentials and raw bank payloads remain outside these records and logs.

## Verification

- Backend TypeScript: passed.
- Backend ESLint: passed with one pre-existing warning in `group.service.ts:741`.
- Backend Jest: 10 suites, 44 tests passed.
- Nest production build: passed.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add loan/trade/valuation controllers, DTO validation, idempotency, and OpenAPI schemas.
2. Add Ledger application ports for confirmed loan cash payments and investment buy/sell cash effects.
3. Add PostgreSQL persistence with schedule-version and projection-rebuild constraints.
4. Select a bank provider only after sandbox, Vietnam coverage, consent/token lifecycle, and commercial review.

## Phase commit message

```text
feat(wealth): add loan and investment application boundaries

Orchestrate exact-bigint loan schedules, repeat payment allocation, investment
trade projections, and valuation snapshots behind workspace-scoped ports while
keeping expected values separate from confirmed ledger cash.
```
