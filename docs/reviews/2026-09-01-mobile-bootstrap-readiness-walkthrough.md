# Mobile bootstrap readiness walkthrough — 2026-09-01

## Scope and non-goals

This slice prevents protected mobile feature routes from rendering before the
authenticated workspace bootstrap has completed. It adds explicit loading,
empty, and retryable-error gates for both iOS and Android. It does not change
JWT claims, workspace authorization, cache contents, or server APIs.

## Affected files

- `mobile/src/app/providers.tsx` — expose bootstrap status, error, and retry
  through the workspace context.
- `mobile/src/app/workspace-bootstrap.ts` — pure status classifier used by the
  provider.
- `mobile/src/app/workspace-bootstrap.spec.ts` — loading/error/empty/ready
  coverage.
- `mobile/app/(app)/_layout.tsx` — block protected stack composition until a
  workspace is ready and render a native-safe retry state.

## Business rules and data flow

After JWT restoration reaches `authenticated`, the app now follows:

```text
authenticated -> bootstrap query -> ready workspace -> protected route stack
                         |-> loading / error / empty gate (no scoped data)
```

No account, transaction, or other workspace cache query can mount before the
bootstrap status is `ready`. A failed request remains token-free and can be
retried without changing session or workspace state. An empty response is
shown explicitly instead of inventing a workspace or reading an unscoped
cache partition.

## Public API and UI behavior

No HTTP contract changed. The provider still calls `GET /v1/session/bootstrap`.
On mobile, users see a loading indicator while access is resolved, a clear
empty-workspace message when no workspace is returned, or a retry button after
a bootstrap error. Once ready, existing Overview, Accounts, Transactions,
Budgets, Group, Inbox, and Settings routes compose unchanged.

## Migration and security implications

No database migration. The gate reduces accidental cross-scope rendering by
requiring a server-selected workspace before any protected screen mounts;
tokens remain inside the existing SecureStore/auth boundary.

## Verification

- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm typecheck:mobile` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile export:android` — pass with native Hermes execution
  permission enabled (976 modules, Hermes bundle).
- `pnpm --filter mobile export:ios` — pass with native Hermes execution
  permission enabled (979 modules, Hermes bundle).

## Known gaps and follow-up

React Native Testing Library and physical-device process-death/network tests
remain release gates. The Windows sandbox needs elevated permission to execute
the bundled `hermesc.exe`; CI native jobs run in their supported environments.

## Commit message

```text
fix(mobile): gate protected routes on workspace bootstrap

Keep scoped mobile data from rendering before authenticated workspace access is
ready, with explicit loading, empty, and retryable error states.
```
