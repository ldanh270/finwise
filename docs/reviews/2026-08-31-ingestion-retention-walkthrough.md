# Ingestion retention walkthrough — 2026-08-31

## Scope

This Phase 6 slice adds the lifecycle guard for raw CSV evidence. An import
session becomes `resolved` only after every row is `confirmed`, `ignored`, or
`needs_attention`; `DELETE /v1/workspaces/:workspaceId/imports/:sessionId/raw`
then marks raw content deleted and is safe to repeat. Unresolved sessions are
explicitly blocked from deletion.

## Non-goals

- The in-memory adapter does not store raw bytes or implement encrypted object
  storage/automatic 30-day deletion yet.
- This does not add a worker, retention scheduler, or legal-hold workflow.

## Affected files and modules

- `backend/src/ingestion/application/ingestion.ports.ts` — raw-delete port.
- `backend/src/ingestion/application/ingestion.service.ts` — typed delete
  command mapping.
- `backend/src/ingestion/infrastructure/in-memory-import.store.ts` — terminal
  session refresh and idempotent deletion guard.
- `backend/src/ingestion/presentation/ingestion.controller.ts` — DELETE route.
- `backend/src/ingestion/application/ingestion.service.spec.ts` — resolved,
  delete, and repeat-delete coverage.
- `contracts/openapi.json` — retention endpoint contract.

## Business rules

- A session cannot be deleted while any row is still reviewable/matched.
- Terminal rows are `confirmed`, `ignored`, and `needs_attention`; session
  status is recalculated after every decision/confirmation.
- Repeating the delete after `rawDeletedAt` is set returns the same session
  state without mutating timestamps again.
- Financial journals remain untouched; deletion only removes raw evidence.

## Data flow

```text
row decision/confirm -> refresh session terminal state
DELETE raw -> resolved guard -> rawDeletedAt marker -> audit-preserving response
```

## Public API and UI behavior

The DELETE endpoint returns the import session metadata and `409` for unresolved
rows. A future inbox UI should disable deletion until every row is terminal and
show the retention timestamp; no UI was changed in this backend slice.

## Migration and security implications

No migration. Production must map `rawDeletedAt` to encrypted object-storage
deletion, retain normalized audit evidence, support manual deletion after
resolution, and schedule automatic deletion after 30 days with operator/legal
hold controls. No raw CSV payload is returned by the endpoint.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Ingestion Jest suite: passed (3 tests).
- Nest build: passed.
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add object-storage adapter, encrypted upload metadata, 30-day retention
   worker, and delete audit event.
2. Add unresolved-delete/permission E2E and legal-hold tests.
3. Keep normalized source links and reconciliation evidence after raw delete.

## Commit message

`feat(ingestion): guard raw deletion behind resolved sessions`

The body should call out terminal-state recalculation, idempotent deletion, and
the deferred object-storage retention worker.
