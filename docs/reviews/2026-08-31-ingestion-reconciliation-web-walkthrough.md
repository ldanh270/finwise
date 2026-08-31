# Ingestion and reconciliation web boundary walkthrough

Date: 2026-08-31
Phase: 6 — CSV ingestion and reconciliation
Status: Implemented in the in-memory MVP boundary; durable persistence and object-storage gates remain.

## Scope and non-goals

This slice makes the existing CSV inbox and reconciliation application ports usable from the web dashboard. It adds session/record/checkpoint reads, CSV staging and upload, row-level confirm/ignore actions, and a reconciliation checkpoint form.

It does not ship candidate matching UI, bulk confirmation UI, adjustment resolution UI, durable PostgreSQL repositories, encrypted object storage, malware scanning, automatic 30-day cleanup, bank adapters, or browser E2E coverage.

## Affected files and modules

- `frontend/src/lib/api/contracts.ts` — runtime-validated import and reconciliation response contracts.
- `frontend/src/lib/api/client.ts` — typed HTTP operations for inbox and reconciliation routes.
- `frontend/src/features/ingestion/ingestion-service.ts` — feature orchestration and refresh behavior.
- `frontend/src/features/ingestion/ingestion-page.tsx` — dashboard inbox, record decisions, upload, and checkpoint forms.
- `frontend/src/features/dashboard/dashboard-page.tsx` — navigation and feature mounting.
- `frontend/app/globals.css` — responsive inbox/checkpoint/record layout.
- `docs/implementation-plan/phases/06-INGESTION-RECONCILIATION.md` and the implementation index — phase status and evidence.

## Business rules

- CSV sessions and normalized records remain evidence until a reviewer confirms a row; importing or matching does not change a balance.
- Confirm uses the record endpoint with an idempotency key and is the only web action in this slice that posts the record through the ingestion application port.
- Ignore is mapped to the backend `ignore` route and is terminal; terminal records cannot be confirmed again from this UI.
- Reconciliation captures external versus ledger balances and displays the difference. It does not overwrite a balance or silently create an adjustment.
- Amounts are transported as `MoneyDto` minor-unit strings and formatted only at the presentation edge.
- Every request is scoped by the selected workspace through the existing API client and server authorization boundary.

## Data flow

```text
dashboard workspace -> load sessions + checkpoints -> load selected session records
CSV File.text() -> create import session -> refresh and select session
record confirm/ignore -> ingestion endpoint -> refresh selected rows
account/date/external balance -> reconciliation checkpoint -> refresh list
```

The browser only stages the selected file content for the upload request. It does not calculate ledger balances, create journals directly, or hold provider credentials.

## Public API and UI behavior

The client now covers:

- `GET /v1/workspaces/:workspaceId/imports`
- `GET /v1/workspaces/:workspaceId/imports/:sessionId/records`
- `POST /v1/workspaces/:workspaceId/imports`
- `POST /v1/workspaces/:workspaceId/imports/records/:recordId/confirm`
- `POST /v1/workspaces/:workspaceId/imports/records/:recordId/ignore`
- `GET /v1/workspaces/:workspaceId/reconciliations`
- `POST /v1/workspaces/:workspaceId/reconciliations`

The dashboard adds an `Imports & reconciliation` tool section. It provides loading, no-workspace, empty-list, retryable-error, action-error, and success feedback states. Sessions can be selected to inspect normalized rows; each non-terminal row exposes Confirm and Ignore controls. Reconciliation checkpoints show date, status, and difference. The UI labels raw data as private evidence and does not include it in overview balances.

## Migration and security implications

No database schema or migration was changed. The slice consumes the existing in-memory application ports, so no rebaseline or data conversion is implied. Production rollout still requires tenant-safe repositories, encrypted object storage, raw-file retention enforcement, and durable audit/source-link storage.

The client validates response shapes before rendering, encodes workspace/session/record path identifiers, uses bearer/cookie transport already configured by the shared client, and never logs file content or tokens. File size, CSV shape, authorization, idempotency, and ledger posting remain backend responsibilities.

## Verification

- Backend Jest: 9 suites, 42 tests passed (`backend/.\\node_modules\\.bin\\jest.cmd --runInBand`).
- Backend ESLint: passed with one pre-existing warning in `group.service.ts:741`.
- Frontend ESLint: passed (`frontend/.\\node_modules\\.bin\\eslint.cmd src`).
- Frontend TypeScript: passed (`frontend/.\\node_modules\\.bin\\tsc.cmd --noEmit`).
- Frontend production build: passed (`frontend/.\\node_modules\\.bin\\next.cmd build`).
- OpenAPI contract check: passed (`node scripts/check-openapi.mjs`).
- Diff whitespace check: passed (`git diff --check`).
- Frontend Prettier check could not run because the local frontend install has no `prettier` binary; this is recorded as an environment/install gap rather than auto-installing dependencies.

## Known gaps and follow-up

1. Add candidate match/unmatch and bulk-confirm review flows, including per-row partial failure summaries.
2. Add explicit reconciliation discrepancy resolution and adjustment command UI with `expectedVersion`.
3. Replace in-memory stores with PostgreSQL repositories and encrypted object storage after Phase 0 preflight.
4. Add raw-file deletion controls and the 30-day cleanup worker once retention infrastructure exists.
5. Add browser E2E for upload → review → confirm → reconciliation and accessibility checks on the new forms.

## Phase commit message

```text
feat(ingestion): complete web inbox and reconciliation boundary

Expose CSV session review, idempotent row confirmation, terminal ignore actions,
and reconciliation checkpoints in the workspace dashboard while preserving the
evidence-before-ledger workflow.
```
