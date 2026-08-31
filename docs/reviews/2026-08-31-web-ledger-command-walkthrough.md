# Web ledger command vertical slice walkthrough — 2026-08-31

## Scope

This slice turns the existing web dashboard into a usable ledger command
surface. Members can add visible accounts, post opening balances, and record
income, expense, or transfer journals from feature-owned forms. Successful
commands refresh the workspace overview so balances and activity do not remain
stale.

## Non-goals

- Supabase OTP/session screens, role administration, and production SMTP/rate
  limits remain operational gates.
- Classification splits, correction dialogs, budget editing, CSV inbox, and
  reconciliation UI remain separate slices.
- The browser never computes or caches confirmed balances; Nest remains the
  financial authority.

## Affected files and modules

- `frontend/src/features/ledger/ledger-service.ts` — command orchestration and
  stable browser idempotency keys.
- `frontend/src/features/ledger/ledger-action-panel.tsx` — accessible account,
  opening-balance, and transaction forms.
- `frontend/src/features/dashboard/dashboard-page.tsx` — account/transaction
  action panels and refresh handoff.
- `frontend/src/lib/api/client.ts` — typed POST transport for ledger commands.
- `frontend/app/globals.css` — responsive form styling and focus states.

## Business rules

- Amounts are submitted as VND minor-unit strings; no floating point is used.
- Opening balance and all financial commands carry an idempotency key where the
  API requires one.
- Transfer forms require a distinct destination account; backend validation
  remains authoritative for every account and permission scope.
- Successful mutations trigger a fresh workspace read; error responses remain
  typed and visible to the user.

## Data flow

```text
form -> feature ledger service -> Finwise REST client -> Nest use case/Ledger
     -> typed success/error -> workspace refresh -> overview/account cards
```

## Public API and UI behavior

The web consumes:

- `POST /v1/workspaces/:workspaceId/accounts`;
- `POST /v1/workspaces/:workspaceId/accounts/:accountId/opening-balance`;
- `POST /v1/workspaces/:workspaceId/transactions`.

Accounts render an add-account form and opening-balance form. Transactions
render income/expense/transfer controls, account selectors, amount/date/
description inputs, pending state, and inline success/error feedback.

## Migration and security implications

No schema migration is added. Workspace IDs and account options originate from
the server's bootstrap/overview responses; the backend re-checks membership,
permissions, archived state, and account scope. Idempotency keys are generated
per browser command and are not persisted as financial data by the client.

## Verification

- Frontend ESLint: passed for changed files.
- Frontend TypeScript check: passed.
- Next production build: passed.
- Backend Jest suite: passed (42 tests).
- Nest production build: passed.
- OpenAPI contract check and `git diff --check`: passed.

## Known gaps and follow-up

1. Add browser component/E2E coverage for duplicate submit, denied account,
   session expiry, and transfer validation.
2. Add OTP/protected-layout integration after the Supabase SSR adapter and
   production environment are configured.
3. Add transaction correction/classification and budget editor workflows.

## Commit message

`feat(web): add ledger command forms`

The body should mention server-authorized account/opening/transaction commands,
idempotency, and refresh-after-success behavior.
