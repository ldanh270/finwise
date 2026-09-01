# Mobile/web surface parity walkthrough — 2026-09-01

## Scope and non-goals

This slice aligns the Expo navigation and transaction capture surface with the
currently shipped web surface. It adds the web-matching Reports placeholder and
lets users choose an effective date for online or offline manual movements.
It does not invent a reporting endpoint, alter ledger rules, or add a second
source of financial truth.

## Affected files

- `mobile/src/ui/app-shell.tsx` — scrollable bottom navigation and Reports item.
- `mobile/app/(app)/reports.tsx` — parity placeholder matching web Reports.
- `mobile/app/(app)/transaction/new.tsx` — effective-date field wired to the
  existing validated command and outbox payload.
- Phase 8 plan and `progress.md` — delivery record.

## Business rules and data flow

```text
transaction form -> ISO date validation -> shared API command
                                  -> offline draft effectiveDate (income/expense only)
Reports route -> explicit placeholder (no API call or fabricated metrics)
```

Amounts remain positive VND minor-unit strings. The server remains authoritative
for posting, balances, and report data.

## Public API and UI behavior

No API or schema changed. Mobile now exposes Reports in the same tool area as
web and displays an explicit not-yet-available state. Transaction capture keeps
the selected `effectiveDate` for transfers and online commands; transient
income/expense drafts preserve it through SQLite outbox retries.

## Migration and security implications

No migration. Navigation is presentation-only, and the date is validated by
the existing Zod boundary before transport. No tokens or account data are
introduced into local storage.

## Verification

- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass.
- `pnpm --filter mobile format:check` — pass.
- Android and iOS JavaScript exports — required platform bundle gate.

## Known gaps and follow-up

Reports remain intentionally unavailable until a permission-filtered reporting
API is delivered on the web/backend. Native physical-device and macOS signing
verification remain Phase 8 release gates.

## Commit message

```text
feat(mobile): align navigation and transaction date surface

Expose the web-matching Reports placeholder and preserve user-selected
effective dates for online and offline manual transaction capture.
```
