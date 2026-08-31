# Root test-runner arguments walkthrough

Date: 2026-08-31
Phase: 1 — Platform foundation
Status: Implemented

## Scope and non-goals

The root `test:backend` and `test:e2e` scripts now forward `--runInBand` to
Jest using pnpm 11's supported argument form. Previously pnpm inserted a
literal `--` into the Jest pattern, causing `No tests found` before any test
file ran.

This does not change Jest configuration, test discovery patterns, test
assertions, or production runtime behavior.

## Affected files and modules

- `package.json` — root Jest wrapper argument forwarding.
- `docs/implementation-plan/README.md` and
  `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md` — delivery
  record and review index.

## Business rules

- Root verification commands must preserve meaningful Jest exit codes and must
  not reinterpret a runner flag as a test-name pattern.
- Serial execution is intentional for the current backend suite to avoid open
  handles and shared in-memory state races.

## Data flow

```text
pnpm test
  -> root test:backend wrapper
  -> pnpm --filter backend test --runInBand
  -> backend Jest config/testRegex
  -> test result and exit code
```

## Public API and UI behavior

No HTTP or UI behavior changed. This is a repository verification command fix.

## Migration and security implications

No database migration or dependency change. The wrapper now executes the
existing test suite deterministically and does not loosen assertions.

## Verification

- Before the patch, `pnpm test` failed with `No tests found` and pattern
  `--runInBand` because Jest received a literal `--` argument.
- After the patch, `pnpm test` passes the backend suite with the intended
  serial flag (11 suites, 46 tests).
- `pnpm build`: passed for backend and frontend.
- `pnpm lint`: passed with one pre-existing warning and zero errors.
- `pnpm typecheck`: passed for backend and frontend.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add a small script-level regression test if the root runner grows more
   argument forwarding logic.
2. Run the E2E command against a configured disposable database in CI; the
   wrapper fix itself is covered by the unit-suite invocation.

## Commit message

```text
fix(test): forward Jest flags correctly from pnpm wrappers

Remove the pnpm 11 separator form that became a literal Jest pattern so root
unit and e2e commands execute their intended serial test runs.
```
