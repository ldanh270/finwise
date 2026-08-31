# Web balance-view consumption walkthrough — 2026-08-31

## Scope

This web slice consumes the backend balance-view contract alongside the
overview request. Visible account cards now show the ledger, cleared, and
reconciled amounts when the projection is available, while overview loading
and error handling remain independent from the optional detail projection.

## Non-goals

- No local financial calculation or balance mutation was added.
- Account CRUD, transaction forms, reconciliation inbox, and official
  generated-client migration remain open.
- A failed detail projection does not fabricate values; the card falls back to
  the overview balance.

## Affected files and modules

- `frontend/src/lib/api/contracts.ts` — runtime guard and balance-view type.
- `frontend/src/lib/api/client.ts` — typed `/v1/.../balances` request.
- `frontend/src/features/dashboard/dashboard-page.tsx` — parallel load state
  and account-card rendering.
- `frontend/app/globals.css` — compact detail metadata styling.
- Phase 7/index docs and this walkthrough.

## Business rules

- API payloads are accepted only when all three fields are VND Money DTOs.
- Account cards display only server-provided visible account IDs.
- The overview's primary balance remains the existing account projection;
  detailed views are explanatory and never used for client-side totals.

## Data flow

```text
workspace selection -> overview + balance views in parallel
                    -> independent load/error states
                    -> visible account card detail rows
```

## Public API and UI behavior

The dashboard calls `GET /v1/workspaces/:workspaceId/balances` and renders a
compact `Ledger · Cleared · Reconciled` line on each matching visible account.
If the detail request fails, overview remains usable and no guessed amount is
shown.

## Migration and security implications

No migration is added. The client validator rejects malformed projection
payloads, while the server remains responsible for tenant/account visibility.
No tokens or raw financial payloads are logged.

## Verification

- Frontend ESLint: passed.
- Frontend TypeScript check: passed.
- Frontend Next production build: passed.
- Repository `git diff --check`: passed.
- Frontend Prettier executable: unavailable in its local node_modules (known
  repository dependency-install gap); no formatter rewrite was applied.

## Known gaps and follow-up

1. Replace the local adapter with the generated shared `typescript-fetch`
   client once generator tooling is wired.
2. Add stale/freshness labels and a retry action for detail projection errors.
3. Add browser/E2E assertions for hidden-account omission and partial views.

## Commit message

`feat(web): display scoped balance views`

The body should mention independent projection loading and no client-side
balance calculations.
