# Group Treasury web vertical slice walkthrough — 2026-08-31

## Scope

This web slice exposes the Group Treasury application contract through a
workspace-scoped dashboard section. It loads collection progress and separated
report measures, renders explicit loading/empty/error states, and lets a member
post an idempotent direct group expense from a visible account.

## Non-goals

- Participant creation, contribution submission/review, claim approval, and
  overpayment resolution screens remain follow-up work.
- Authentication/session wiring still follows the existing dashboard boundary;
  the feature does not add a second auth client.
- No client-side financial calculations change confirmed Ledger truth.

## Affected files and modules

- `frontend/src/features/group/group-service.ts` — feature API orchestration.
- `frontend/src/features/group/group-treasury-page.tsx` — responsive group
  summary, collection progress, and expense form.
- `frontend/src/features/dashboard/dashboard-page.tsx` — navigation and
  workspace/account handoff.
- `frontend/src/lib/api/contracts.ts` and `client.ts` — runtime-checked group
  DTOs and REST calls.
- `frontend/src/components/ui/icons.tsx` — accessible users icon.
- `frontend/app/globals.css` — group cards, form, progress, and responsive grid.

## Business rules

- The UI uses server-returned VND minor-unit strings and only formats at the
  presentation edge; percentage width is derived with `bigint` arithmetic.
- Collection progress renders verified paid/outstanding values, never pending
  submissions as cash.
- Direct expense posting always sends an `Idempotency-Key`; the backend remains
  authoritative for permissions, account scope, and balance mutation.
- API failures are shown as actionable error states instead of fabricated data.

## Data flow

```text
workspace selection -> group service -> collections + report in parallel
                    -> per-collection progress reads
                    -> typed snapshot -> dashboard cards/forms
expense form -> generated boundary client -> REST command + idempotency key
             -> refresh snapshot after successful posting
```

## Public API and UI behavior

The dashboard adds a `Group Treasury` tool section. It consumes:

- `GET /v1/workspaces/:workspaceId/group/collections`;
- `GET /v1/workspaces/:workspaceId/group/collections/:collectionId/progress`;
- `GET /v1/workspaces/:workspaceId/group/reports/summary`;
- `POST /v1/workspaces/:workspaceId/group/expenses`.

The page shows collection progress bars, collected/outstanding/direct-expense/
payable summary cards, separate approved-claim/sponsored/pending metrics, and a
visible-account direct expense form with success/error feedback.

## Migration and security implications

No migration is added. Feature requests carry the selected workspace ID to the
backend, and account choices come from the existing permission-filtered
overview response. The frontend does not treat route or cached account state as
authorization.

## Verification

- Frontend ESLint: passed for changed files.
- Frontend TypeScript check: passed.
- Next production build: passed.
- Backend Group service suite: passed (7 tests).
- OpenAPI contract check: passed.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add participant/submission/reviewer/claim workflows to the web feature.
2. Add component/E2E coverage for permission-denied, stale, and partial data
   states once the browser test harness is available.
3. Replace manual API transport with the generated OpenAPI client when the
   generator dependency can be installed deterministically.

## Commit message

`feat(web): add Group Treasury vertical slice`

The body should mention workspace-scoped progress, separated report measures,
and idempotent direct-expense posting.
