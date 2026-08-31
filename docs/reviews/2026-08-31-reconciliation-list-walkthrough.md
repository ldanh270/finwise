# Reconciliation checkpoint listing walkthrough — 2026-08-31

## Scope

This slice adds a workspace-scoped read endpoint for reconciliation
checkpoints. Owners and members can now review open/resolved checkpoints in
statement-date order before deciding whether an explicit adjustment is
needed.

## Non-goals

- Checkpoints remain in the in-memory adapter; durable Prisma tables,
  checkpoint locking, and cursor pagination are deferred.
- This does not change adjustment math or overwrite any account balance.
- No reconciliation UI was added in this backend contract slice.

## Affected files and modules

- `backend/src/ingestion/application/ingestion.ports.ts` — list checkpoint
  port.
- `backend/src/ingestion/application/ingestion.service.ts` — response mapping.
- `backend/src/ingestion/infrastructure/in-memory-import.store.ts` — scoped,
  deterministic listing.
- `backend/src/ingestion/presentation/ingestion.controller.ts` —
  `GET /v1/workspaces/:workspaceId/reconciliations`.
- `backend/src/ingestion/application/ingestion.service.spec.ts` — listing
  coverage.
- `contracts/openapi.json` — reconciliation list contract.

## Business rules

- Listing requires workspace membership and never crosses tenant boundaries.
- Checkpoints are ordered by statement date descending, then creation time.
- A checkpoint remains an immutable snapshot of external balance, ledger
  balance, and difference; adjustment is a separate journal command.

## Data flow

```text
GET reconciliations
 -> workspace membership
 -> checkpoint store filtered by workspace
 -> typed reconciliation response list
```

## Public API and UI behavior

`GET /v1/workspaces/:workspaceId/reconciliations` returns the existing
reconciliation shape as an array. The existing POST start and adjustment
routes are unchanged.

## Migration and security implications

No migration is added. Production persistence must use tenant foreign keys,
account scope checks, immutable checkpoint snapshots, and an index on
`(workspaceId, statementDate)`.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Ingestion Jest suite: passed (3 tests).
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add durable checkpoint repository and cursor pagination.
2. Add reconciliation UI with discrepancy, explicit adjustment, and retry
   states.
3. Add checkpoint-level optimistic concurrency once mutable workflow versions
   are persisted.

## Commit message

`feat(reconciliation): list workspace checkpoints`

The body should mention scoped ordering and immutable snapshots.
