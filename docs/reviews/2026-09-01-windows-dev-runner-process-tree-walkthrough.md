# Windows development runner process-tree walkthrough

## Scope and non-goals

This slice fixes stale child processes left behind by the root `pnpm dev`
runner on Windows. It does not change application ports, Nest/Next runtime
configuration, or production process supervision.

## Affected files

- `scripts/process-tree.mjs` — platform-aware process-tree termination helper.
- `scripts/run-apps.mjs` — use the helper when a sibling app exits or the
  runner receives a shutdown signal.
- `scripts/process-tree.test.mjs` — Windows and Unix cleanup behavior tests.
- `package.json` — `test:dev-runner` verification command.

## Behavior and data flow

The root runner starts `pnpm.cmd` through `cmd.exe` on Windows so Node can
spawn the workspace command. Previously, stopping the direct child only
terminated that shell; the nested Next/Nest process could keep ports 3000 or
3001 open. The new flow is:

```text
runner shutdown / sibling failure
  -> taskkill <shell pid> /T /F on Windows
  -> nested pnpm + Next/Nest processes exit
  -> runner returns the original failure code
```

Unix keeps the existing direct `child.kill()` behavior. If Windows cannot
start `taskkill`, the helper falls back to the direct child signal.

## Public API and UI behavior

No HTTP or UI contract changes. `pnpm dev` still serves the frontend on
`FRONTEND_PORT` (default 3000) and the backend on `BACKEND_PORT` (default
3001).

## Migration and security implications

No database or data migration. The command arguments passed to `taskkill` are
the runner-owned child PID and fixed process-tree flags; no user input is
interpolated. Cleanup is limited to processes spawned by this runner.

## Verification

- `pnpm test:dev-runner` — pass (2 tests).
- `pnpm --filter backend build` — pass.
- `pnpm --filter frontend build` — pass.
- `pnpm dev` — pass; Next reported ready on port 3000 and Nest completed
  compilation/startup on port 3001.

## Known gaps and follow-up

The in-app terminal/PTY used for this verification does not reliably forward
Ctrl+C to the JavaScript parent on Windows, so manual interactive shutdown was
not used as the proof of cleanup. CI should exercise the sibling-failure path
and assert that both configured ports are released before starting another
dev run.

## Commit message

```text
fix(dev): terminate Windows app process trees

Prevent pnpm.cmd shells from leaving nested Next/Nest servers listening after
the root development runner exits or a sibling app fails.
```
