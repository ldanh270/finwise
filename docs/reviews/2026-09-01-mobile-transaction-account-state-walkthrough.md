# Mobile transaction account-state walkthrough — 2026-09-01

## Scope and non-goals

This slice makes the mobile Record movement screen safe and understandable
when its account dependency is loading, unavailable, stale, or empty. It does
not change transaction posting, offline draft eligibility, JWT/session
behavior, ledger rules, or the generated API contract.

## Affected files

- `mobile/app/(app)/transaction/new.tsx` — render dependency-aware loading,
  retryable error, no-active-account, and stale-cache states before exposing
  the movement form.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — record the
  delivered state behavior.
- `progress.md` — record verification for this slice.

## Business rules and data flow

Recording movement requires a visible active account. The screen now follows:

```text
workspace ready -> account query
                       |-> loading gate
                       |-> unavailable gate + retry
                       |-> no active account -> manage accounts
                       |-> form -> server posting or eligible offline draft
```

Cached active accounts can still power the form during a transient refresh
failure, but the user sees an explicit stale-data warning. An empty or fully
archived account list cannot produce a malformed transaction request.

## Public API and UI behavior

No HTTP or generated-client changes. The existing `GET /v1/workspaces/:id/accounts`
query remains the source for account options. Users see a loading panel, a
retry action for unavailable account data, or a Manage accounts action when no
active account exists. Once usable options are available, income, expense,
transfer, validation, and offline-draft behavior remains unchanged.

## Migration and security implications

No database migration. The form continues to use the trusted workspace ID
from bootstrap and never treats route/cache state as authorization. Generic
error rendering does not expose tokens or internal stack traces.

## Verification

- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm --filter mobile format:check` — pass before this docs-only handoff
  slice; formatter reported no source changes.

## Known gaps and follow-up

React Native Testing Library and physical-device offline/process-death tests
remain release gates. Native iOS compilation/signing still requires macOS or
the configured CI runner.

## Commit message

```text
fix(mobile): gate transaction entry on account state

Prevent an unusable movement form when accounts are loading, unavailable, or
empty while preserving cached-account and offline-draft behavior.
```
