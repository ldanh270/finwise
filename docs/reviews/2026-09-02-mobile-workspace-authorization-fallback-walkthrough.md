# Mobile workspace authorization fallback walkthrough

## Scope and non-goals

This slice prevents a stale selected workspace id from being used after the
server bootstrap response changes. It does not grant access, cache a new
workspace, or replace server-side membership/policy checks.

## Affected files and modules

- `mobile/src/app/workspace-bootstrap.ts` — pure authorized workspace resolver.
- `mobile/src/app/workspace-bootstrap.spec.ts` — authorized and revoked-scope
  cases.
- `mobile/src/app/providers.tsx` — query scope now uses the resolver.
- `docs/implementation-plan/README.md` and Phase 8 — delivery record.

## Business rules and data flow

```text
latest GET /v1/session/bootstrap
  -> compare selected id with returned workspaces
  -> keep it only when authorized
  -> otherwise use suggested workspace, then first authorized workspace
  -> issue scoped queries only for the resolved id
```

An absent bootstrap response resolves to no workspace, so feature queries remain
disabled while loading or after an empty/error state. The resolver is pure and
does not infer access from route params or cached UI state.

## Public API and UI behavior

No server/OpenAPI change. Mobile workspace switching still uses the existing
`selectWorkspace` action. If membership is revoked or an archived workspace is
removed from bootstrap, the UI automatically falls back to an authorized
workspace and no longer sends reads for the stale id.

## Migration and security implications

No database migration. This is a client-side guardrail; Nest remains the
authorization boundary and rejects any unauthorized request that may already
be in flight. No financial data is copied between workspace partitions.

## Verification

- `pnpm --filter mobile test -- --runInBand` — 14 suites, 48 tests passed.
- `pnpm --filter mobile typecheck` — passed.
- `pnpm --filter mobile format:check` — passed.
- `git diff --check` — passed.

## Known gaps and follow-up

- Add an integration test with a real bootstrap refresh and an in-flight query
  cancellation when a membership revocation is delivered by the API.
- Physical-device verification remains part of the Phase 8 native release gate.

## Commit message

```text
fix(mobile): reject stale workspace selections

Resolve the active scope only from the latest authorized bootstrap response so
membership changes cannot keep mobile queries pointed at a revoked workspace.
```
