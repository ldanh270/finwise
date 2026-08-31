# Nest runtime validation dependencies walkthrough

Date: 2026-08-31
Phase: 1 — Platform foundation
Status: Implemented

## Scope and non-goals

The backend now declares `class-validator` and `class-transformer` as runtime
dependencies required by Nest's global `ValidationPipe`. This closes the gap
where TypeScript compilation succeeded but `pnpm dev` failed during application
bootstrap with a missing-package error.

It does not change validation DTOs, business rules, production error wording,
or the database schema.

## Affected files and modules

- `backend/package.json` — runtime dependency declarations.
- `pnpm-lock.yaml` — resolved dependency graph and integrity metadata.
- `docs/implementation-plan/README.md` and
  `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md` — delivery
  record and review index.

## Business rules

- Boundary validation is part of the Nest runtime and must be present in every
  deployable backend installation, not only in a developer's transitive cache.
- Exact lockfile resolution is required so CI and local startup use the same
  validator packages.

## Data flow

```text
backend/package.json
        -> pnpm lockfile resolution/install
        -> Nest ValidationPipe module loading
        -> /v1 request validation and typed error filter
```

## Public API and UI behavior

The existing `/v1` routes and frontend behavior are unchanged. Startup now
reaches route registration and readiness instead of terminating while creating
the global validation pipe.

## Migration and security implications

No database migration or financial data change. Keeping validation packages in
the backend runtime dependency set prevents production from silently running
without boundary validation.

## Verification

- `pnpm --filter backend install --frozen-lockfile --ignore-scripts`: passed.
- `pnpm --filter backend build`: passed.
- `pnpm dev`: both apps reached ready state; `GET /v1/health` returned 200 and
  the frontend root returned 200.
- `pnpm test`: 11 suites and 46 tests passed.
- `pnpm typecheck`: backend and frontend passed.

## Known gaps and follow-up

1. Add DTO-specific validation tests as controllers move from snapshot
   contracts to generated OpenAPI decorators.
2. Keep production configuration fail-closed and do not expose validator
   internals in the typed error envelope.

## Commit message

```text
fix(platform): declare Nest runtime validation dependencies

Install class-validator and class-transformer explicitly so the global
ValidationPipe works in clean production and development installs.
```
