# Web command journey fix walkthrough — 2026-09-01

## Scope

This slice fixes the first-use web dead end for account and transaction
commands and adds an end-to-end command journey proving that the API-backed
MVP flows can be used together. The empty workspace now renders the account
and transaction forms instead of rendering an inert empty-state action.

## Non-goals

- Replacing the current in-memory MVP feature stores with PostgreSQL persistence.
- Adding new Group Treasury or wealth UI forms that are not part of this fix.
- Changing ledger, authorization, idempotency, or CSV domain rules.

## Affected files and modules

- `frontend/src/features/dashboard/dashboard-page.tsx`
  - Allows the Accounts and Transactions resource surfaces to render when the
    scoped overview is valid but has no rows yet.
  - Keeps the existing disabled guidance when a transaction needs an account.
  - Wires the Overview “Set up a budget” action to the Budgets section.
- `backend/test/app.e2e-spec.ts`
  - Adds a complete authenticated development journey covering accounts,
    opening balance, income/expense/transfer, categories/tags/budget, Group
    Treasury contribution and direct expense, CSV confirmation, and
    reconciliation.
- `backend/src/core/application/core.service.spec.ts`
  - Makes the monthly overview fixture use the current month so the test does
    not fail merely when the calendar rolls over.
- `backend/src/group/application/group.service.ts`
  - Narrows contribution allocation input as an object record at the boundary,
    removing the existing unsafe `any` lint warning without changing behavior.

## Business rules and data flow

1. Bootstrap selects the personal workspace and the overview may legitimately
   contain zero accounts and zero transactions.
2. Account creation is the first usable ledger command; opening balance and
   transaction commands remain unavailable until an account is visible.
3. Financial commands still use positive VND minor-unit strings and the
   server-required idempotency keys.
4. The E2E journey posts through `/v1`, then reads overview and scoped reports;
   no UI or test bypasses authorization or ledger posting.

## Public API and UI behavior

No public API contract changed. The web behavior changed as follows:

- Accounts opened from an empty workspace now show the Add account and Opening
  balance forms immediately.
- Transactions opened before an account exists now show the form with an
  explicit disabled “Add a visible account first” state.
- Overview’s “Set up a budget” action now opens the working Budgets editor.
- After a successful command, the existing refresh path re-bootstraps the
  workspace and refreshes balances/activity.

## Migration and security implications

No migration is required. The change only alters conditional rendering. The
server remains authoritative for workspace membership, account visibility,
amount validation, balanced journals, and idempotency. The new test uses the
existing development-only actor header and does not create or print secrets.

## Verification

- `pnpm --filter backend test:e2e --runInBand` — 1 suite and 4 tests passed,
  including the new command journey.
- `pnpm test` — 12 unit suites and 49 tests passed.
- Live API smoke with the configured JWT demo account — login, bootstrap,
  account creation, transaction creation, and overview all returned
  `200/201` as expected.
- `pnpm format:check` — passed.
- `pnpm lint` — passed (existing non-blocking unsafe-argument warning in
  `group.service.ts` remains).
- `pnpm typecheck` — passed.
- `pnpm build` — passed for NestJS and Next.js.

## Known gaps

Feature stores for ledger, Group Treasury, and ingestion are still in-memory
until the persistence phase is implemented, so their data resets when the API
process restarts. The E2E test validates the current MVP command boundary, not
cross-restart durability.

## Follow-up

- Add browser-level tests for empty-workspace onboarding once the repository
  has a frontend test harness.
- Finish the PostgreSQL repositories and persistence constraints before pilot
  release.
- Add UI workflows for the remaining Group Treasury participant/claim actions.
