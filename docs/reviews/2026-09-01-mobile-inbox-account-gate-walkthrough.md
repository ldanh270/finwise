# Mobile inbox account gate walkthrough — 2026-09-01

## Scope and non-goals

This slice makes the CSV inbox and reconciliation entry point explicit when a
workspace has no visible active account. It prevents empty selectors and gives
the user a direct path to account setup. It does not change import parsing,
reconciliation posting, authorization, or server data.

## Affected files

- `mobile/app/(app)/inbox.tsx` — account prerequisite gate and navigation to
  Accounts.
- Phase 8 plan, `progress.md`, and the implementation-plan index — delivery
  record.

## Business rules and data flow

```text
account query -> active visible accounts?
  no -> explicit setup state -> Accounts route
  yes -> CSV/reconciliation forms
```

The server remains authoritative for account visibility. Archived or hidden
accounts cannot be selected as an import or reconciliation target.

## Public API and UI behavior

No API or schema changed. Loading and query-error gates retain their existing
retry behavior. Once account data is successfully loaded but contains no active
visible account, Inbox renders `Add an account before using the inbox` with a
`Manage accounts` action instead of blank controls.

## Migration and security implications

No migration. The route only navigates to an existing screen and does not infer
or expose hidden account IDs.

## Verification

- `pnpm --filter mobile format` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass (7 suites, 28 tests).

## Known gaps and follow-up

Native device verification remains the Phase 8 release gate; no backend work is
required for this prerequisite state.

## Commit message

```text
fix(mobile): gate inbox on active account visibility

Replace empty CSV and reconciliation selectors with an explicit account setup
state and a direct navigation path to account management.
```
