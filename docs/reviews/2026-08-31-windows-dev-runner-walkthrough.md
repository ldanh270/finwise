# Windows development runner walkthrough

Date: 2026-08-31
Phase: 1 — Platform foundation
Status: Implemented

## Scope and non-goals

The root development runner now starts the backend and frontend pnpm scripts
on Windows by dispatching the `pnpm.cmd` shim through the platform shell. This
fixes the `spawn EINVAL` failure that occurred before either application could
start.

It does not change application ports, process ownership, shutdown policy,
authentication, or production process management.

## Affected files and modules

- `scripts/run-apps.mjs` — platform-aware child-process spawn options.
- `docs/implementation-plan/README.md` and
  `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md` — delivery
  record and review index.

## Business rules

- The runner owns only the two approved application commands (`backend`
  `start:dev`/`start:prod` and `frontend` `dev`/`start`).
- Shell dispatch is enabled only on Windows, where `pnpm.cmd` requires it;
  Unix execution continues to call `pnpm` directly.
- Application arguments are fixed constants in source, not user-provided
  command text.

## Data flow

```text
root pnpm dev/start
        -> scripts/run-apps.mjs
        -> Windows shell dispatch (pnpm.cmd) or direct Unix spawn (pnpm)
        -> backend + frontend child processes
        -> prefixed output and coordinated shutdown
```

## Public API and UI behavior

No HTTP contract or UI behavior changed. The existing local endpoints remain
`http://localhost:3001/v1` for Nest and `http://localhost:3000` for Next.

## Migration and security implications

No database migration. The shell flag is constrained to the Windows branch and
the runner's constant command list; it is not a general-purpose shell API.

## Verification

- `pnpm --filter backend exec nest --version`: passed (`11.0.24`).
- `pnpm --filter frontend exec next --version`: passed (`Next.js v16.3.2`).
- Before the patch, `node scripts/run-apps.mjs dev` reproduced `spawn EINVAL`.
- After the patch, the runner starts both child commands; Next reported Ready,
  Nest registered the `/v1` routes, `GET /v1/health` returned 200, and the
  frontend root returned 200. The smoke servers were then stopped.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add a platform-specific runner test that stubs `child_process.spawn` and
   asserts the Windows shell option without launching real servers.
2. Keep native Expo/device verification in Phase 8; this runner intentionally
   starts only web/backend applications.

## Commit message

```text
fix(dev): make workspace runner spawn pnpm on Windows

Dispatch the pnpm.cmd shim through the Windows shell so root dev/start can
launch backend and frontend without spawn EINVAL.
```
