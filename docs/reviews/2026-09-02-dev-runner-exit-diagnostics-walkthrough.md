# Development runner exit diagnostics walkthrough

## Scope and non-goals

The root `pnpm dev`/`pnpm start` runner now identifies the application child
that stopped unexpectedly and reports its exit code or terminating signal before
coordinated shutdown. This makes wrapper-level `ELIFECYCLE` output actionable
when a backend/frontend process fails (for example, a port is already in use).
It does not change application commands, ports, shell dispatch, production
process ownership, or shutdown semantics.

## Affected files and modules

- `scripts/run-apps.mjs` — exit listener diagnostics.
- `docs/implementation-plan/README.md` — review index.
- `docs/implementation-plan/phases/10-QA-SECURITY-OPERATIONS.md` — delivered
  operational slice.

## Business rules and data flow

The runner still starts only the fixed backend and frontend workspace scripts.
On an unexpected non-zero child exit it now follows:

```text
child exit -> identify application -> format code/signal -> log diagnostic
           -> stop sibling process tree -> preserve non-zero runner exit
```

Expected zero exits and exits after the runner has begun coordinated shutdown
remain silent, avoiding duplicate noise.

## Public API and UI behavior

No HTTP, OpenAPI, database, or product UI contract changes. Developers receive a
message such as `[frontend] process stopped unexpectedly (exit code 1)` before
the existing pnpm `ELIFECYCLE` wrapper line.

## Migration and security implications

No migration. The diagnostic contains only a fixed application name and
process termination metadata; it does not print environment variables,
command arguments, tokens, or request payloads.

## Verification

- `node --check scripts/run-apps.mjs` — passed.
- `pnpm test:dev-runner` — 2 process-tree tests passed.
- `pnpm dev` with clean ports — backend reported `Found 0 errors. Watching
  for file changes`, Nest started, and Next reported `Ready`.
- A controlled occupied-port failure now reports the responsible frontend
  child and `exit code 1` before `ELIFECYCLE`; the stale process was stopped
  and ports 3000/3001 were released.
- `git diff --check` — passed.

## Known gaps and follow-up

- Add a fully isolated spawn-stub test for `run-apps.mjs` when the runner is
  refactored to expose a testable factory; current tests cover process-tree
  shutdown and the runtime smoke covers the diagnostic path.
- Keep application-level compile errors in the child output; this runner only
  adds context and does not replace the underlying error.

## Commit message

```text
fix(dev): report unexpected app process exits

Identify the backend or frontend child and its exit code or signal before the
workspace runner shuts down sibling processes, making ELIFECYCLE failures
actionable.
```
