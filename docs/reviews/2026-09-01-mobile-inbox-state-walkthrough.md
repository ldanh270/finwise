# Mobile inbox data-state walkthrough — 2026-09-01

## Scope and non-goals

This slice makes the mobile Imports & reconciliation screen explicit about
loading, unavailable, stale, and retryable read states. Previously a failed
read could look like an empty inbox, which made import and reconciliation
controls appear broken. This does not change import state transitions, ledger
posting, permissions, persistence, or the HTTP contract.

## Affected files

- `mobile/app/(app)/inbox.tsx` — gate primary reads, surface stale/error
  notices, and add local retry actions for sessions, normalized rows, and
  checkpoints.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — record the
  delivered data-state behavior and remaining device gates.
- `progress.md` — record verification for this slice.

## Business rules and data flow

The screen now follows:

```text
workspace ready -> account/import/reconciliation reads
                       |-> loading gate
                       |-> unavailable gate + retry
                       |-> stale data + visible warning
                       |-> usable data
```

No command is submitted while the required account, import-session, or
reconciliation baseline is unavailable. If a refresh fails after cached data
exists, the cached list remains visible with a warning. Normalized rows and
checkpoint reads have independent retry actions, so one failed detail query
does not hide unrelated work.

## Public API and UI behavior

No API or generated client changes. The existing account, import-session,
transaction, imported-record, and reconciliation queries are unchanged.
Mobile users now see a loading state, a retryable unavailable state, or an
inline stale/error message instead of a misleading blank card. Retry reuses
the existing TanStack Query refetch path and does not mutate ledger state.

## Migration and security implications

No database migration and no new storage. Existing workspace bootstrap still
selects the trusted workspace boundary; all refetches use that scoped ID. Error
copy remains generic and does not expose tokens, raw bank payloads, or backend
stack traces.

## Verification

- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm typecheck` — pass for API client, backend, frontend, and mobile.
- `pnpm format:check` — pass for all workspaces.
- `pnpm test` — pass (14 backend suites, 53 tests).
- `pnpm test:e2e` — pass (4 API journeys).
- `pnpm test:dev-runner` — pass (2 process-tree tests).
- `pnpm contracts:check` — pass (86 operations, 7 idempotent commands).
- `pnpm build` — pass for NestJS and Next.js.
- `pnpm --filter mobile export:android` — pass (976 modules, Hermes bundle).
- `pnpm --filter mobile export:ios` — pass (979 modules, Hermes bundle).

## Known gaps and follow-up

React Native Testing Library, physical-device process-death/network tests,
and iOS native compilation/signing remain release gates. On Windows, Expo
Hermes export requires elevated execution permission; the macOS CI job remains
the native iOS verification path.

## Commit message

```text
fix(mobile): surface inbox data states

Make import and reconciliation loading, stale, unavailable, and retryable
states explicit so read failures cannot look like empty data.
```
