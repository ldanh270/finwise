# Database deploy runner and preflight truthfulness walkthrough — 2026-09-01

## Scope and non-goals

This slice makes `pnpm db:deploy` usable from the current Windows development
environment, where Prisma 7's native migration engine cannot establish the
CockroachDB Cloud TLS connection. It also makes the read-only preflight detect
real rows instead of relying only on stale PostgreSQL-compatible statistics.

It does not reset, drop, rewrite, or migrate existing user data. It does not
replace Prisma schema generation or migration authoring; checked-in SQL remains
the migration source of truth. The direct `pg` runner only applies those SQL
files and records Prisma-compatible migration metadata.

## Affected files and modules

- `scripts/database-deploy.mjs` — deterministic, transactional migration runner
  over the already configured `DIRECT_URL`/`DATABASE_URL` connection.
- `scripts/database-deploy.test.mjs` — checksum, ordering, identifier-safety,
  and redaction tests without a live database.
- `scripts/database-preflight.mjs` — exact `EXISTS` row-presence checks in the
  existing read-only transaction, alongside the estimated statistic.
- `package.json` and `backend/package.json` — `db:deploy` uses the safe runner;
  `db:deploy:prisma` remains available for Linux/CI Prisma-engine execution.
- `backend/README.md`, Phase 0 plan, and this walkthrough — operational and
  migration guidance.

## Business rules and data flow

1. Load only backend environment variables; no database URL is returned in
   output.
2. Connect through the direct/session URL with its configured TLS mode.
3. Ensure `finwise` and `finwise._prisma_migrations` exist without dropping
   anything.
4. Discover timestamped migration directories in lexical order.
5. For each migration, verify the SHA-256 checksum of the checked-in SQL. An
   already finished migration is skipped; a changed or incomplete migration
   fails safely.
6. New SQL and its metadata row are committed atomically. A failed migration is
   rolled back and cannot leave a partially applied schema.
7. Preflight reports `hasRows` via `EXISTS (SELECT 1 ... LIMIT 1)` so a stale
   `reltuples = 0` statistic cannot authorize an unsafe rebaseline.

The current target was not reset: it has two finished migrations, one demo
user, one personal workspace, one owner membership, three durable runtime
snapshots, and no financial account yet.

## Public API and UI behavior

No HTTP or OpenAPI contract changed. The backend continues to use the same
`/v1` API and the web/mobile clients continue to read the same seeded demo
identity. The only user-visible CLI change is that `pnpm db:deploy` now prints
`Database is up to date (...)` or the migration names it applied instead of
failing on the Windows Prisma schema engine.

## Migration and security implications

- Existing migration checksums are validated before skipping a migration.
- Identifiers used by the runner are fixed or validated before interpolation;
  migration SQL itself is read only from the repository migration directory.
- DDL and `_prisma_migrations` metadata share one transaction.
- TLS is not disabled and credentials never appear in diagnostics.
- `db:deploy:prisma` is retained for Linux CI/deployment environments that can
  provide the CockroachDB CA to Prisma's native engine.
- The corrected preflight is deliberately conservative: any exact row presence
  sets `estimatedDataPresent: true`, even if statistics are zero.

## Verification

- `node --test scripts/database-preflight.test.mjs scripts/database-deploy.test.mjs` — 5 tests passed.
- `pnpm db:deploy` — passed; database reported up to date with 2 migrations.
- `pnpm db:seed` — passed; demo seed remained idempotent.
- `pnpm db:preflight` — passed; exact row checks report `estimatedDataPresent: true`.
- Direct read-only counts — 1 user, 1 workspace, 1 workspace member, 1 role,
  2 migrations, 3 runtime snapshots, 0 accounts.
- `pnpm --filter backend start:dev` — TypeScript compilation found 0 errors;
  a second concurrent start correctly reports `EADDRINUSE` when port 3001 is
  already owned by the first backend process.

## Known gaps and follow-up

- Run `pnpm db:deploy:prisma` in Linux CI with the provider CA as the release
  migration gate; keep the direct runner for Windows developer ergonomics.
- Add a migration integration test against an ephemeral CockroachDB instance
  before introducing a migration that contains non-transactional SQL.
- The current demo seed intentionally creates no financial account; account
  creation remains an explicit product workflow.

## Commit message

```text
fix(db): make Cockroach migrations safe on Windows

Run checked-in migrations transactionally through pg when Prisma's Windows TLS
engine is unavailable, validate checksums, and make preflight detect real rows.
```
