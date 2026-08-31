# Web MVP hardening walkthrough — 2026-08-31

## Scope

This slice makes the existing web transaction export action real. The Nest
application now exposes a policy-filtered CSV endpoint, and the dashboard
downloads the response with accessible loading, success, and error feedback.
The implementation keeps the existing overview/workspace state model and adds
no new financial truth.

## Non-goals

- This is not the full pilot release gate: Supabase OTP, SMTP/rate limits,
  PostgreSQL persistence, audit explorer, Group/CSV workflow screens, and
  backup/restore drills remain open work.
- The export is currently a complete in-memory transaction snapshot; cursor
  pagination and streaming exports are deferred until the persistence adapter
  is available.

## Affected files and modules

- `backend/src/core/application/core.service.ts` — policy-filtered CSV
  projection and RFC-style field escaping.
- `backend/src/core/presentation/core.controller.ts` — `GET
  /v1/workspaces/:workspaceId/transactions/export` with download headers.
- `backend/src/core/application/core.service.spec.ts` — exact amount and CSV
  escaping coverage.
- `frontend/src/lib/api/client.ts` — typed text transport and export method.
- `frontend/src/features/dashboard/dashboard-page.tsx` — download behavior and
  state feedback.
- `frontend/app/globals.css` — feedback/disabled-action styling.
- `contracts/openapi.json` — `text/csv` contract entry.

## Business rules

- The server remains authoritative: export calls the same scoped transaction
  query as the transaction list and never trusts the active route or cached
  client data for authorization.
- Amounts remain decimal-safe strings (`amountMinorUnits`) and are never
  converted to JavaScript floating point.
- CSV fields containing commas, quotes, or line breaks are quoted and embedded
  quotes are doubled.
- Hidden account details are not inferred by the client; the server emits a
  visible account label when a visible transaction has no visible account name.

## Data flow

```text
Dashboard export click
  -> typed API client (credentials/bearer token, no-store)
  -> Nest /v1 export route
  -> CoreService + scoped store list
  -> escaped CSV text + Content-Disposition
  -> Blob download + status feedback
```

## Public API and UI behavior

`GET /v1/workspaces/{workspaceId}/transactions/export` returns `text/csv` with
`finwise-transactions.csv` as the suggested filename and `403` for denied
workspace access. The dashboard disables the action while preparing, reports a
retryable error without exposing internals, and confirms that the downloaded
file uses account visibility rules.

## Migration and security implications

No database migration is required; this is an additive in-memory/application
projection. The endpoint is guarded by the existing auth guard and workspace
policy path. Export responses use `no-store` on the browser transport and do
not log tokens, raw bank payloads, or request contents. Production storage
must replace the in-memory query before pilot and should add export audit
events, bounded pagination, and streaming limits.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Core service Jest suite: passed (15 tests).
- Frontend ESLint: passed.
- Frontend TypeScript check: passed.
- Frontend production build: passed.
- OpenAPI validation: passed.

The repository does not currently install a frontend Prettier binary, so the
frontend Prettier command could not be run; the changed TS/TSX files were
formatted with the backend workspace formatter and the build/lint gates pass.

## Known gaps and follow-up

1. Wire the generated `typescript-fetch` client once the root dependency
   install is unblocked; the current client is a transport seam.
2. Add export audit events, date/category filters, cursor pagination, and a
   dedicated audit explorer backed by PostgreSQL.
3. Add browser E2E coverage for download, denied export, and session expiry.

## Commit message

`feat(web): add policy-filtered transaction CSV export`

The body should mention that the endpoint is additive, keeps server-side
visibility enforcement, and exposes a new `text/csv` contract.
