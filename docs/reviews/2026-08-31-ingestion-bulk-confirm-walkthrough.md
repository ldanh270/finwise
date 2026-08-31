# Ingestion bulk-confirm walkthrough — 2026-08-31

## Scope

This Phase 6 slice adds a bounded bulk-confirm command for CSV inbox rows.
`POST /v1/workspaces/:workspaceId/imports/records/confirm` accepts 1–500 unique
record IDs and a required `Idempotency-Key`, then returns an outcome per row.
Valid rows confirm through the existing one-row path; invalid/terminal rows
return a safe typed error without rolling back other valid rows.

## Non-goals

- This does not add streaming uploads, object-storage retention/deletion,
  source-link tables, or a durable unit-of-work transaction.
- Bulk match, ignore, reconciliation bulk actions, and background workers are
  deferred.

## Affected files and modules

- `backend/src/ingestion/application/ingestion.service.ts` — row-list parsing,
  bounded result contract, independent error handling.
- `backend/src/ingestion/presentation/ingestion.controller.ts` — bulk route
  and header mapping (declared before the dynamic record route).
- `backend/src/ingestion/application/ingestion.service.spec.ts` — valid/error
  isolation and balance assertion.
- `contracts/openapi.json` — request/result schemas and endpoint contract.

## Business rules

- `recordIds` is unique and capped at 500 to bound request/response work.
- The batch key is required; each row uses a stable `batchKey:recordId`
  idempotency key so a retry cannot duplicate a journal.
- A row failure is represented in the result and does not prevent other rows
  from confirming.
- Only the existing `confirmRecord` transition can post a journal; matched,
  ignored, needs-attention, and already-confirmed semantics remain unchanged.

## Data flow

```text
bulk body + Idempotency-Key
 -> validate unique row ids
 -> per-row confirm transition/idempotency
 -> {recordId, ok, record|safe error}[]
```

## Public API and UI behavior

The OpenAPI contract exposes a `201` per-row result envelope. A future web
inbox can render mixed success/error rows and retry only failures using the same
batch key; no existing UI was changed in this backend slice.

## Migration and security implications

No migration yet. The in-memory implementation proves behavior but production
must persist source/idempotency uniqueness and transaction boundaries in
PostgreSQL. Error payloads expose stable code/message only and never include
stack traces, tokens, or raw CSV content.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Ingestion Jest suite: passed (3 tests).
- Nest build: passed.
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add durable row/source links, raw-file encryption/30-day retention, and
   manual delete after resolution.
2. Add bulk UI with progress, partial failure, retry, and permission states.
3. Move per-row command execution behind a database unit-of-work/idempotency
   adapter when PostgreSQL is available.

## Commit message

`feat(ingestion): add partial-failure bulk confirmation`

The body should explain the 1–500 bound, per-row results, and stable retry keys.
