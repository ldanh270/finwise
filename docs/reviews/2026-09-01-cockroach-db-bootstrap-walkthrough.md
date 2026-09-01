# CockroachDB bootstrap and migration compatibility walkthrough

## Scope and non-goals

This slice makes the checked-in Prisma schema and migration baseline compatible
with the CockroachDB Cloud endpoint currently configured in `backend/.env`,
then bootstraps that empty database and runs the demo seed. It also fixes the
Nest dependency-injection failure discovered during the live smoke test.

It does not change financial business rules or add a financial account seed.
The follow-up [database deploy runner walkthrough](2026-09-01-database-deploy-runner-walkthrough.md)
documents the repeatable checked-in `pg` deploy path for Windows; this file
records the original baseline bootstrap and its preservation boundary.

## Affected files and modules

- `backend/prisma/schema.prisma`: use the `cockroachdb` provider and supported
  native type mappings.
- `backend/prisma/migrations/20260831010000_cockroach_baseline/migration.sql`:
  generated baseline for the current domain/auth schema.
- `backend/prisma/migrations-legacy/`: preserves the obsolete PostgreSQL draft
  migrations after the empty-database preflight.
- `backend/prisma/migrations/migration_lock.toml`: lock the active provider to
  CockroachDB.
- `backend/src/database/prisma.service.ts` and `backend/.env.example`: align
  local fallback/documented ports with CockroachDB.
- `backend/src/auth/finwise-auth.guard.ts`: make the JWT verifier dependency
  explicit for Nest runtime injection.
- `backend/README.md`: document provider choice and the Windows TLS limitation.

## Business rules and data flow

The database preflight found no user tables and no `_prisma_migrations` table,
so replacing the obsolete draft history was safe for this target. The forward
path is:

```text
current schema.prisma
  → CockroachDB baseline SQL
  → finwise tables/enums/indexes/foreign keys
  → idempotent demo seed
```

The baseline creates the current `users`, workspace/RBAC, financial account,
immutable journal, audit, idempotency, and refresh-session tables. The seed
creates one demo user, personal workspace, owner membership, and protected
Owner role. It intentionally does not create a financial account.

## Migration and rollback notes

The target database was verified empty before the rebaseline. The previous
committed migration files were moved to `backend/prisma/migrations-legacy/`
instead of discarded, preserving a recoverable copy. A database that has
already applied the old migrations must not run this rebaseline; it needs a
separate preservation/mapping migration.

The baseline SQL was applied as one reviewed bootstrap operation through Node
`pg`, and its checksum was recorded in `finwise._prisma_migrations`. No
application data was deleted.

## Public/runtime behavior

After seed, the live API accepted:

- `POST /v1/auth/login` with `demo@finwise.local` and the demo password.
- `GET /v1/auth/session` with the refresh cookie.
- `GET /v1/session/bootstrap` with the returned access token.

The API returned HTTP 200 for all three checks. The Nest application reached
startup successfully after the verifier injection fix.

## Verification

- Prisma `validate` and `generate`: passed with `cockroachdb` provider.
- Baseline SQL: applied successfully to the configured CockroachDB database.
- Seed: `pnpm db:seed` passed.
- Database counts after seed: 1 user, 1 workspace, 1 member, 1 role, 0
  financial accounts, 2 recorded migrations.
- Backend typecheck and test command: passed.
- Live backend startup: passed after DI fix.
- Login/session/bootstrap smoke tests: passed.

The underlying Prisma 7 native schema engine still cannot be verified from
this Windows host because of the CockroachDB Cloud TLS handshake. The
checked-in `pnpm db:deploy` wrapper now uses the already working `pg` TLS
runtime locally; `pnpm db:deploy:prisma` remains the Linux/CI command.

## Known gaps and follow-up

- Add a documented Linux CI migration job or provider-specific CA setup for
  Windows developers.
- Add a non-demo financial-account fixture only when the account vertical slice
  needs seeded data.
- Keep CockroachDB and standard PostgreSQL provider decisions explicit; changing
  providers requires a new generated baseline and client regeneration.

## Commit message

```text
fix(db): align Prisma baseline with CockroachDB runtime

Rebaseline the empty development database from the current schema, preserve
legacy migrations, and fix JWT verifier injection for live Nest startup.
```
