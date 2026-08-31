# Ledger source links walkthrough — 2026-08-31

## Scope

This provenance slice connects confirmed CSV import records to immutable ledger
journals. The Core port now creates and reads workspace-scoped source links;
ingestion confirmation links both newly posted and matched journals, while
the transaction API exposes a read-only source-link query.

## Non-goals

- Source links are still held by the in-memory adapter; Prisma schema/migration,
  database uniqueness, and a transaction/unit-of-work boundary remain open.
- Group/reconciliation source-link writers, bulk source-link exports, and an
  audit explorer UI are deferred.

## Affected files and modules

- `backend/src/core/domain/ledger.types.ts` — `JournalSourceType` and
  `JournalSourceLinkRecord`.
- `backend/src/core/application/core.ports.ts` — link/query port methods.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — unique
  workspace/source index and visibility-checked reads.
- `backend/src/core/application/core.service.ts` and
  `backend/src/core/presentation/core.controller.ts` — source-link response and
  `GET /v1/workspaces/:workspaceId/transactions/:transactionId/source-links`.
- `backend/src/ingestion/infrastructure/in-memory-import.store.ts` — link on
  matched/new confirmation and idempotent replay.
- `backend/src/ingestion/application/ingestion.service.spec.ts` — provenance
  assertion.
- `contracts/openapi.json` — source-link endpoint/schema.

## Business rules

- A source can link to at most one transaction within a workspace and source
  type; a conflicting link is a conflict, not an overwrite.
- Linking requires the same transaction visibility check as reading a journal.
- Confirming an import creates exactly one link whether it posts a journal or
  confirms a manual match; replaying confirmation does not create duplicates.
- Source links carry opaque source IDs only and do not expose raw CSV content.

## Data flow

```text
CSV record confirm/match
 -> Ledger post or existing transaction
 -> linkJournalSource(workspace, import_record, recordId)
 -> source-links query for audit/rebuild provenance
```

## Public API and UI behavior

Clients can query a transaction's source links with the new GET endpoint. The
response is an array of `{id, transactionId, sourceType, sourceId, createdAt}`;
no client UI was changed in this backend provenance slice.

## Migration and security implications

No migration is added. Production must use a unique `(workspaceId, sourceType,
sourceId)` constraint and insert the link in the same transaction as journal
confirmation. Authorization is rechecked through journal visibility; raw
uploads remain outside this response.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Core and ingestion Jest suites: passed (18 tests).
- Nest build: passed.
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add Prisma source-link model/migration only after database preflight and
   preserve existing data if any real user data is discovered.
2. Link group submissions and reconciliation adjustments through the same port.
3. Add audit explorer/export UI and cross-tenant/source uniqueness integration
   tests.

## Commit message

`feat(ledger): preserve journal source links for imports`

The body should explain visibility-checked provenance and the deferred durable
uniqueness/migration work.
