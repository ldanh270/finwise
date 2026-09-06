# CI Prisma client generation walkthrough — 2026-09-06

## Scope and non-goals

This slice fixes the clean-runner lint failure where ESLint reported unsafe
Prisma calls throughout the backend. It does not weaken lint rules, change
Prisma models, or alter application behavior.

## Affected files

- `.github/workflows/ci.yml` — generates the ignored Prisma client immediately
  after frozen dependency installation and before quality checks.

## Root cause and data flow

```text
clean checkout -> pnpm install
  -> pnpm db:generate -> backend/generated/prisma
  -> lint/typecheck/build/test
```

The generated client under `backend/generated/` is intentionally gitignored.
The CI quality job previously ran lint before `prisma generate`, so imports of
`PrismaClient`, model delegates, and enums resolved as error/unsafe types. The
local workspace masked the issue because a previously generated client existed.
The generation step receives a loopback `DIRECT_URL` placeholder because
Prisma's config validates that variable even though client generation does not
connect to the database.

## Public API and UI behavior

No API, database schema, or UI behavior changed. Only CI preparation changed.

## Migration and security implications

No migration is introduced. The workflow still uses the frozen lockfile; the
generation step reads the checked-in schema and does not connect to the
database. No secrets are logged or persisted.

## Verification

- `npm run db:generate` — pass; Prisma Client 7.10.0 generated, including with
  a clean-env simulation and the CI loopback `DIRECT_URL` placeholder.
- `npm run lint:backend` — pass after generation.
- `pnpm typecheck` — pass before this workflow-only change.
- `npm run test` and `npm run test:e2e` — pass before this workflow-only
  change.
- `npm --prefix frontend exec -- prettier --check .github/workflows/ci.yml` —
  pass.
- `git diff --check` — pass.

The clean GitHub runner verification will happen in the next CI run because
this Windows workspace already contains the generated client.

## Known gaps and follow-up

The workflow should remain ordered with `pnpm db:generate` before any backend
lint, typecheck, build, or test command that imports the generated client.

## Commit message

```text
fix(ci): generate Prisma client before quality checks

Create the ignored Prisma client on clean runners before ESLint and TypeScript
inspect backend Prisma repositories.
```
