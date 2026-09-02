# Development runner port preflight walkthrough

## Scope and non-goals

The root `pnpm dev` and `pnpm start` commands now probe the configured backend
and frontend ports before spawning either application. When a port is already
occupied, the command fails fast with the owning app label, port, and matching
environment variable instead of starting a sibling process and leaving a
misleading wrapper-level `ELIFECYCLE` message. This does not discover or kill
the owning process, change port defaults, or replace application-level bind
errors.

## Affected files and modules

- `scripts/port-preflight.mjs` — platform-neutral TCP probe and conflict
  aggregation.
- `scripts/port-preflight.test.mjs` — occupied/free/deduplicated probe tests.
- `scripts/run-apps.mjs` — preflight before child process creation.
- `package.json` — includes port tests in `test:dev-runner`.
- `README.md` — documents the exact port inspection/cleanup workflow.
- `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md` — records the
  delivered runtime safety slice.
- `docs/implementation-plan/README.md` — links this walkthrough.
- `progress.md` — records verification and the user-facing diagnosis.

## Business rules and data flow

The runner resolves the configured `BACKEND_PORT` and `FRONTEND_PORT`, probes
each unique TCP port, and only then starts the fixed workspace commands:

```text
environment -> unique port probes -> conflict diagnostics or child spawn
```

An `EADDRINUSE` result is actionable and blocks startup. Other probe failures
are ignored so the Nest/Next process remains the authority for unusual OS
binding errors. No process outside the runner is terminated.

## Public API and UI behavior

There is no HTTP, OpenAPI, database, or product UI change. Developers now see
for example:

```text
[frontend] port 3000 is already in use. Stop the owning process or set FRONTEND_PORT to another port.
```

The command exits before backend compilation begins, so a port conflict cannot
produce a misleading backend-only `ELIFECYCLE` tail.

## Migration and security implications

No migration. The probe opens and immediately closes a local listener; it does
not inspect process command lines, environment values, credentials, or network
payloads. It never kills a process selected by a user or by port ownership.

## Verification

- `pnpm test:dev-runner` — passed, 5 tests.
- `node --check scripts/run-apps.mjs` — passed.
- `node --check scripts/port-preflight.mjs` — passed.
- Occupied-port smoke — passed: with a local listener on `3000`, `pnpm dev`
  reported the frontend conflict before spawning Nest.
- Clean `pnpm dev` smoke — backend compiled with zero errors, Nest started, and
  Next reported ready on ports `3001` and `3000`.

## Known gaps and follow-up

- The diagnostic does not identify or terminate the owning process; use the
  documented PowerShell `netstat`/`taskkill` workflow when a stale process is
  intentional to remove.
- A future isolated runner test can assert child-spawn suppression directly;
  current tests cover the preflight helper and the runtime smoke covers the
  integration boundary.

## Commit message

```text
fix(dev): fail fast on occupied app ports

Probe configured backend and frontend ports before spawning workspace apps so
EADDRINUSE failures are actionable and do not leave a misleading ELIFECYCLE
tail after partial startup.
```
