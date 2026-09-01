# Mobile partial-access overview walkthrough — 2026-09-01

## Scope and non-goals

This slice aligns Overview mobile with the server's partial-access signal and
the web account balance presentation. It displays a clear permission-scoped
notice and shows ledger, cleared, and reconciled balance views for visible
accounts. It does not change authorization, aggregation, account visibility,
or any API contract.

## Affected files

- `mobile/app/(app)/index.tsx` — render `hasPartialAccess`, balance-view
  breakdowns, and accessible live-region copy.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — record the
  parity delivery.
- `progress.md` and the implementation-plan index — record the audit trail.

## Business rules and data flow

The server remains the authority for visibility and aggregate values:

```text
GET overview + GET balance views -> visible accounts only
overview.hasPartialAccess -> explicit mobile notice
balance.ledger/cleared/reconciled -> per-account read-only breakdown
```

Hidden accounts are not inferred or counted locally. The client only formats
the exact minor-unit strings returned by the API; no floating-point math is
introduced.

## Public API and UI behavior

No endpoint or payload changed. When permissions filter the workspace, mobile
now shows the same warning as web. Each visible account displays its ledger
amount plus cleared and reconciled values, while cached balance errors retain
the existing stale-data warning.

## Migration and security implications

No database migration. The notice and breakdown are read-only and use the
already workspace-scoped response, so they do not expose hidden account IDs or
permit client-side authorization bypass.

## Verification

- `pnpm typecheck:mobile` — pass.
- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm --filter mobile format:check` — pass.
- Android and iOS JavaScript exports remain covered by the Phase 8 export gate.

## Known gaps and follow-up

Native screen-reader and physical-device layout checks remain part of the
macOS/device release gate. No additional server work is required for this
parity slice.

## Commit message

```text
fix(mobile): expose partial access balance views

Show permission-scoped overview notices and ledger, cleared, and reconciled
values for visible accounts to match the web experience.
```
