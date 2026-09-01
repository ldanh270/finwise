# Mobile balance and Group state walkthrough — 2026-09-01

## Scope and non-goals

This slice closes two functional parity gaps found during the mobile audit:
Overview now communicates when balance detail is still loading, and Group
direct-expense capture accepts the same effective date that web sends. It does
not change reporting, ledger rules, authorization, or persistence schemas.

## Affected files

- `mobile/app/(app)/index.tsx` — explicit balance-detail loading state.
- `mobile/app/(app)/group.tsx` — validated effective-date input for direct
  treasury expenses.
- `mobile/README.md`, `progress.md`, and Phase 8 — documentation updates.

## Business rules and data flow

```text
balance request pending -> visible loading copy -> server balance views
Group form -> ISO date validation -> idempotent direct-expense command
```

The backend remains authoritative for visibility and balances. Amounts stay
positive VND minor-unit strings; the selected date is passed unchanged.

## Public API and UI behavior

No endpoint or payload changed. A user sees `Loading balance detail…` instead
of an empty area while the balance request is pending. The Group expense form
shows an editable `YYYY-MM-DD` field and rejects malformed dates before the
existing `/group/expenses` command is sent.

## Migration and security implications

No database migration. The date is validated at the client boundary, then
revalidated by the backend. No token, raw receipt, or hidden account data is
stored or exposed by this change.

## Verification

- `pnpm --filter mobile format:check` — pass.
- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm --filter mobile export:android` — pass (976 modules).
- `pnpm --filter mobile export:ios` — pass (979 modules).

## Known gaps and follow-up

Native physical-device verification and iOS native compilation/signing remain
environment gates documented by Phase 8.

## Commit message

```text
fix(mobile): preserve group expense dates and loading states

Match web effective-date capture for Group expenses and make balance-detail
loading explicit instead of rendering an ambiguous blank area.
```
