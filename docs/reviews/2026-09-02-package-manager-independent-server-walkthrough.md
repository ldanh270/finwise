# Package-manager-independent server walkthrough

Date: 2026-09-02  
Scope: make the backend production lane runnable with npm without changing
the pnpm workspace used for local/mobile development.

## Scope and non-goals

This slice changes command dispatch, package scripts, and operator guidance.
The NestJS API, database schema, authentication behavior, and frontend
features are unchanged. It does not migrate the root workspace to npm, replace
the Expo workspace dependency model, add a deployment vendor, or claim that a
database is reachable from every host.

## Affected files and modules

- `package.json`: npm-prefixed server/build/database/test/typecheck aliases.
- `backend/package.json`: standalone `format:check` script.
- `frontend/package.json`: standalone format scripts and no package-manager
  pin, so npm/yarn/bun can install the app.
- `scripts/package-manager.mjs`: pure package-manager resolution and command
  construction.
- `scripts/run-apps.mjs`: combined runner dispatches npm or pnpm based on the
  invoking lifecycle or `FINWISE_PACKAGE_MANAGER` override.
- `scripts/package-manager.test.mjs`: npm/pnpm dispatch coverage.
- root, backend, and frontend README files: server install/run instructions.
- `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md`: confirmed
  deployment boundary and delivered slice.

## Business rules and data flow

The workspace remains pnpm for commands that need the mobile `workspace:*`
dependency and one lockfile. Server operations do not need that workspace:

```text
npm run server:* (root)
  -> npm --prefix backend <script>
  -> backend CLI/runtime and PostgreSQL adapter
```

For `npm run dev`, the runner starts `npm --prefix backend run start:dev` and
`npm --prefix frontend run dev`. For `pnpm dev`, it preserves the existing
workspace filters. `FINWISE_PACKAGE_MANAGER=npm|pnpm` is an explicit override
for CI or unusual shells. No financial command, balance projection, or
authorization decision depends on the package manager.

## Public command contract and UI behavior

The public HTTP API and `/v1` contract are unchanged. The supported server
commands are:

```text
npm run server:install
npm run server:build
npm run server:db:deploy
npm run server:start
```

From `backend/`, the equivalent commands are `npm install`, `npm run build`,
`npm run db:deploy`, and `npm run start:prod`. The combined dev runner has no
UI change; it only makes `npm run dev` behave like the existing `pnpm dev`.

## Migration and security implications

This is a command/configuration migration with no schema or data migration.
`npm install` resolves dependencies from `backend/package.json`; operators
should use a controlled registry and preserve the resulting npm lockfile in
their deployment artifact when their environment requires reproducible npm
installs. The repository's pnpm lockfile remains the source of truth for the
root workspace. No credentials, JWT keys, database URLs, or tokens are added
to scripts or logs.

## Verification

Passed on the Windows workspace:

- `npm run test:dev-runner` — 7 tests passed, including npm and pnpm command
  construction.
- `npm run format:check:server` — backend and frontend checks passed.
- `npm run server:typecheck` — backend TypeScript check passed.
- `npm run server:test` — 16 suites and 59 tests passed.
- `npm run build` — Nest build and Next production build passed.
- `npm run dev` — runner selected npm and launched backend/frontend; the run
  was stopped by the existing Next dev lock on port 3000 from another local
  process, not by package-manager dispatch.

## Known gaps

- npm lockfiles are not committed because the local pnpm installation does not
  provide registry integrity metadata and generated links would not be valid
  for a clean `npm ci`. A deployment pipeline should create and retain a
  reviewed `package-lock.json` (or use an approved internal registry/cache).
- Full workspace quality commands still include the Expo mobile package and
  therefore intentionally use pnpm. This does not affect the standalone API
  server lane.
- The stale Next dev lock must be cleared by stopping the owning Finwise
  process before a second combined dev run.

## Follow-up

1. Generate and review backend/frontend npm lockfiles in a networked CI job,
   then switch server install guidance to `npm ci` once those files are
   committed.
2. Add a container image or platform manifest that runs the four `server:*`
   commands with non-root user, health checks, and graceful shutdown.
3. Keep npm and pnpm command smoke tests in CI whenever the runner or package
   manifests change.
