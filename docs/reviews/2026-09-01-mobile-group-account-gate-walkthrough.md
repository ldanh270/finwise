# Mobile Group account gate walkthrough — 2026-09-01

## Scope and non-goals

This slice prevents Group Treasury commands that require a ledger account from
being presented as actionable when the workspace has no visible active account.
It covers claim submission and direct treasury expense posting. It does not
change Group business rules, server authorization, or collection-only forms.

## Affected files

- `mobile/app/(app)/group.tsx` — disable account-dependent commands and show
  prerequisite copy.
- Phase 8 plan, `progress.md`, and the implementation-plan index — delivery
  record.

## Business rules and data flow

```text
visible active account list -> account-dependent Group command enabled
no active account -> disabled command + setup explanation
```

The server remains authoritative. Hidden and archived accounts are never
treated as valid funding targets.

## Public API and UI behavior

No API or schema changed. Claim submission and direct-expense buttons are
disabled when the active visible account list is empty, with explicit copy
explaining the prerequisite. Collection and participant setup remain available.

## Migration and security implications

No migration. This is a presentation guard only; backend membership,
visibility, and ledger checks still run for every request.

## Verification

- `pnpm --filter mobile format:check` — pass.
- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm --filter mobile export:android` — pass (976 modules).
- `pnpm --filter mobile export:ios` — pass (979 modules).

## Known gaps and follow-up

Native physical-device verification remains the Phase 8 release gate.

## Commit message

```text
fix(mobile): gate Group commands on active accounts

Disable claim and direct-expense commands without a visible active account and
explain the setup prerequisite before the server request is attempted.
```
