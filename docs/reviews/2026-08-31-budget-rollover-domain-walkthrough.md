# Budget rollover domain walkthrough — 2026-08-31

## Scope

This Phase 4 slice isolates the budget rollover rule as a pure domain
calculation. It computes the closing balance and carry amount for `NONE`,
`POSITIVE_ONLY`, and `FULL_BALANCE` modes using bigint minor units. The result
is ready for a future explicit close/reopen workflow without mutating ledger
rows.

## Non-goals

- No persisted rollover result, carry-adjustment journal, period reopen command,
  or audit record is added yet.
- Category-tree allocation and monthly report APIs are unchanged; PostgreSQL
  persistence remains the source-of-truth migration gate.

## Affected files and modules

- `backend/src/core/domain/budget-rollover.ts` — pure rollover input/result and
  mode calculation.
- `backend/src/core/domain/budget-rollover.spec.ts` — positive, overspend, and
  disabled mode coverage.

## Business rules

- Closing balance is `allocated - actual`; overspend is therefore negative.
- `NONE` carries zero, `POSITIVE_ONLY` carries only a positive remainder, and
  `FULL_BALANCE` carries the signed remainder.
- Values are bigint minor units and are never converted through floating point.
- Applying a carry must be an explicit next-period projection/adjustment; this
  function has no side effects.

## Data flow

```text
closed-period allocation + actual -> calculateBudgetRollover
 -> signed closing/carry projection -> future audited carry adjustment
```

## Public API and UI behavior

`calculateBudgetRollover(input)` is an internal domain port for the future
budget close use case. No new HTTP or web/mobile behavior is claimed as shipped
by this slice.

## Migration and security implications

No migration or authorization surface changes. The eventual persistence
adapter must scope rollover records by workspace, funded-cap owner, and source
period, and must retain adjustment audit evidence rather than silently
rewriting a closed chain.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Rollover Jest suite: passed (3 tests).
- Nest build: passed.

## Known gaps and follow-up

1. Add versioned rollover records and explicit close/reopen/carry-adjustment
   commands once the Prisma baseline is available.
2. Connect rollover to `BY_CHILDREN`, `SHARED_POOL`, and `HYBRID` allocation
   projections with funded-cap ownership checks.
3. Add API/UI state and hidden-account/report leakage tests.

## Commit message

`feat(budget): add deterministic rollover calculator`

The body should explain the signed closing balance and the three carry modes,
and note that persistence/audited adjustment remains deferred.
