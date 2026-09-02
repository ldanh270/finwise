# Wealth API boundary walkthrough

Date: 2026-09-02  
Phase: 9 — wealth modules and bank beta  
Status: Implemented for loan/investment manual API boundary; bank beta is not claimed shipped

## Scope and non-goals

The existing pure loan/investment calculators are now reachable through the
authenticated Nest API. Loan schedules, payment allocation, investment trades,
position projections, and manual valuations are persisted through the current
durability-barrier snapshot adapter. This slice does not add savings goals,
provider-specific bank sync, normalized wealth tables, automatic prices, or
ledger cash postings for wealth events.

## Affected files and modules

- `backend/src/wealth/application/wealth.service.ts` and `wealth.ports.ts` —
  command replay and list boundaries.
- `backend/src/wealth/infrastructure/in-memory-wealth.store.ts` — tenant-scoped
  idempotency records included in the snapshot state.
- `backend/src/wealth/presentation/wealth.controller.ts` and `wealth.module.ts` —
  request parsing, workspace authorization, and transport mapping.
- `packages/api-client/src/index.ts` — shared client operations and DTOs.
- `contracts/openapi.json` and `scripts/check-openapi.mjs` — documented routes,
  schemas, and required idempotency headers.

## Business rules and data flow

Every route first calls the existing workspace authorization path. Commands
require an `Idempotency-Key`; the parsed request is hashed, a matching replay
returns the original result, and reusing a key with a different payload returns
a conflict. All monetary and quantity values remain bigint in the domain and
decimal strings at the API boundary. Loan payments allocate `fee → interest →
principal`, while investment positions use the existing weighted-average
projection and reject oversells.

```text
JWT actor + workspace route
  -> workspace authorization
  -> typed boundary parser + idempotency hash
  -> WealthService calculator/store
  -> snapshot queue + HTTP flush
  -> decimal-string response
```

## Public API and UI behavior

Added:

- `GET/POST /v1/workspaces/{workspaceId}/wealth/loans`
- `GET/POST /v1/workspaces/{workspaceId}/wealth/loans/{contractId}/payments`
- `GET /v1/workspaces/{workspaceId}/wealth/investments/positions`
- `POST /v1/workspaces/{workspaceId}/wealth/investments/trades`
- `GET/POST /v1/workspaces/{workspaceId}/wealth/investments/valuations`

Web/mobile screens are not added in this expansion slice; the shared client is
ready for a feature UI without duplicating transport types.

## Migration and security implications

No migration. The wealth snapshot is workspace-keyed and passes through the
global persistence flush. No secret or raw provider payload is logged. Until
normalized Prisma wealth repositories replace the adapter, this is suitable for
single-instance beta use, not horizontal production scale.

## Verification

- Backend typecheck: passed.
- Backend tests: passed (16 suites, 59 tests), including idempotent replay and
  conflict behavior.
- API client typecheck: passed.
- `pnpm contracts:check`: passed (96 unique operations, 11 idempotent commands).
- Backend build: passed.

## Known gaps and follow-up

1. Add normalized loan/investment/savings tables and repositories with database
   transactions and projection rebuilds.
2. Add web/mobile wealth screens and E2E journeys.
3. Select a bank provider with sandbox, Vietnam coverage, consent/token
   lifecycle, and commercial approval before implementing an adapter.

## Commit message

```text
feat(wealth): expose idempotent loan and investment APIs

Publish workspace-authorized wealth commands and projections with bigint-safe
transport, replay-safe idempotency, and the existing persistence boundary.
```
