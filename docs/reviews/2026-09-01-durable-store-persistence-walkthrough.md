# Durable store persistence walkthrough — 2026-09-01

## Scope

This slice prevents the web MVP's Core, Group Treasury, and CSV/reconciliation
records from disappearing when the NestJS process restarts. Production module
providers now hydrate their stores from PostgreSQL and enqueue a durable snapshot
after each completed store command.

## Non-goals

- This does not redesign the synchronous application ports as asynchronous
  repositories.
- This does not claim that the normalized ledger/group/ingestion tables are
  complete; the runtime snapshot is a compatibility bridge.
- This does not migrate or invent historical data that was already lost from a
  previous in-memory process.
- Raw CSV files are not stored in the snapshot and object-storage retention is
  still a separate hardening slice.

## Affected files and modules

- `backend/prisma/schema.prisma` adds `FinwiseRuntimeSnapshot`.
- `backend/prisma/migrations/20260901000000_runtime_store_snapshots/migration.sql`
  adds the table and unique namespace index without changing existing rows.
- `backend/src/shared/infrastructure/runtime-store-state.ts` encodes and
  decodes bigint, dates, maps, sets, and derived indexes safely.
- `backend/src/shared/infrastructure/prisma-runtime-snapshot.repository.ts`
  provides PostgreSQL hydration, serialized write-behind, ordered writes, and
  shutdown flushing.
- `backend/src/core/core.module.ts`, `group/group.module.ts`, and
  `ingestion/ingestion.module.ts` use the adapter for the `core`, `group`, and
  `ingestion` namespaces.
- `backend/src/shared/infrastructure/runtime-store-state.spec.ts` covers the
  serialization boundary and derived-index rebuild.
- `backend/package.json` fixes the production entry point to the actual Nest
  build output (`dist/src/main.js`).
- Phase 3, 5, and 6 implementation-plan status/evidence now records the
  persistence bridge and its remaining normalized-repository work.

## Business rules and data flow

The public application ports remain synchronous for this compatibility slice.
At module initialization, the adapter reads one private snapshot per bounded
context. A command executes the existing domain validation and invariant logic
against the hydrated store. Only after the command returns successfully does an
ordered write queue upsert the latest state. Failed commands do not enqueue a
state write. On shutdown, the queue is flushed before the repository is
destroyed.

```text
PostgreSQL snapshot -> hydrate Map-backed store -> existing use case rules
  -> successful command -> serialize explicit runtime markers
  -> ordered PostgreSQL upsert -> next process hydrates the same state
```

Derived indexes (`membersByWorkspaceUser`, `personalWorkspaceByUser`, and
`invitationsByToken`) are rebuilt from canonical maps after hydration so object
reference assumptions in the existing domain store remain valid.

## Public API and UI behavior

No endpoint or DTO changed. Existing account, opening balance, transaction,
budget, Group Treasury, CSV inbox, and reconciliation endpoints continue to use
the same generated web client and error envelopes. The visible behavior change
is that successful records remain visible after a backend restart instead of
returning the first-account empty state.

## Migration and security implications

The migration is additive and has no delete, reset, or destructive backfill.
Snapshots are private PostgreSQL data and are never returned as a response. They
may contain invitation tokens and normalized transaction descriptions, so normal
database access controls, backups, encryption at rest, and PII redaction rules
apply. Snapshot serialization rejects unsupported values and non-finite
numbers; bigint values are never converted through JavaScript floating point.

On the current Windows/CockroachDB environment, Prisma CLI migration execution
was blocked by its native TLS credential error (`P1011`). The additive SQL was
applied through the already configured `pg` adapter with certificate validation
disabled only for this local migration command, and the migration row was
recorded with the file checksum. A production rollout must run `pnpm db:deploy`
with a valid Cockroach CA/direct connection instead.

## Verification

- `pnpm --filter backend db:generate` — passed.
- `pnpm format:check:backend` — passed.
- `pnpm lint:backend` — passed.
- `pnpm typecheck:backend` — passed.
- `pnpm build:backend` — passed.
- `pnpm test:backend` — 13 suites, 51 tests passed.
- `pnpm test:e2e` — 4 tests passed, including the full account/transaction/
  planning/group/import/reconciliation journey.
- Runtime smoke test: created an account, Group Treasury participant/collection,
  and CSV import; restarted the compiled backend; all three records were read
  back with the same IDs. PostgreSQL contained `core`, `group`, and `ingestion`
  snapshots.

## Known gaps

- The snapshot is a transitional whole-store compatibility boundary. Multiple
  backend replicas can still experience last-writer-wins behavior.
- Writes are ordered asynchronously because the current ports are synchronous;
  a future async Unit of Work must make financial writes transactionally atomic
  with normalized rows and source links.
- Normalized Prisma repositories, row-level tenant constraints, durable object
  storage, and 30-day raw-file retention remain required before the related
  phases can be marked complete.

## Follow-up

Replace each snapshot namespace with focused Prisma repositories and an async
Unit of Work in Phase 3, then migrate Group Treasury and ingestion tables in
Phases 5 and 6. Keep the snapshot adapter read-only during cutover, compare
rebuilds against normalized rows, and remove it only after a preservation and
rollback drill passes.
