# Mobile/web parity audit walkthrough — 2026-09-01

## Scope and non-goals

This audit compares every user-visible web capability currently implemented in
the dashboard with the Expo iOS/Android route tree and shared Finwise client.
It verifies online behavior and the deliberately scoped offline behavior; it
does not claim physical-device certification, bank beta, wealth modules, or
web placeholder sections as shipped features.

## Route and capability matrix

| Web capability | Mobile route | Result |
| --- | --- | --- |
| Login/register and session restore | `/login`, `/signup` | Parity; custom JWT + SecureStore |
| Workspace bootstrap/switching | `(app)/_layout.tsx`, `src/app/providers.tsx`, `src/ui/app-shell.tsx` | Parity; bootstrap gate and scoped cache |
| Overview, balances, recent activity | `(app)/index.tsx` | Parity; cached/stale/error states |
| Account creation and opening balance | `(app)/accounts.tsx` | Parity; active-account validation |
| Income, expense, transfer, void | `(app)/transaction/new.tsx`, `(app)/transactions.tsx` | Parity; offline drafts only for income/expense |
| CSV export | `(app)/transactions.tsx` | Parity; native share/save flow |
| Categories, tags, monthly budgets, rollover, close | `(app)/budgets.tsx` | Parity with web budget editor |
| Group summary and direct expense | `(app)/group.tsx` | Parity |
| Group participants, collections, submissions, claims, reimbursement | `(app)/group.tsx` | Mobile covers the API workflow beyond the current web dashboard |
| CSV inbox, normalized-row decisions, raw cleanup | `(app)/inbox.tsx` | Mobile covers the web flow plus match/attention/raw-delete actions |
| Reconciliation checkpoint and adjustment | `(app)/inbox.tsx` | Parity; explicit adjustment only |
| Reports navigation | none | Intentionally omitted: web section is marked “Soon” and has no data behavior |
| Settings/profile navigation | `(app)/settings.tsx` | Mobile has session, draft sync/export/discard/logout behavior; web button is currently a placeholder |

## Business rules and data flow

All mobile workspace reads and writes use the same Nest `/v1` contract and
trusted bootstrap-selected workspace ID as web. Exact VND minor units remain
strings. Confirmed balances are server-owned; SQLite stores only partitioned
cache/workflow state. Financial commands retain stable idempotency keys, and
offline mode is limited to manual income/expense drafts.

```text
JWT/SecureStore -> bootstrap gate -> workspace-scoped query/cache
                                   -> shared API client -> Nest ledger/group/inbox
                                   -> invalidate cache after confirmed mutation
manual income/expense network failure -> SQLite outbox -> retry with same key
```

## Public API and UI behavior

No API contract changes are required for parity. `@finwise/api-client` exposes
the web-used overview/account/ledger/budget/group/import/reconciliation methods
to mobile, including CSV/text and idempotent commands. Every mobile data screen
now has relevant loading, empty, stale/offline, retryable error, and denied
handling; transaction entry and inbox baseline reads explicitly gate on their
required dependencies.

## Migration and security implications

No database migration. Tokens are stored only in Expo SecureStore and are not
placed in SQLite, query data, route params, or logs. Cache/outbox/receipt keys
are partitioned by user and workspace. Raw receipt staging is local metadata
only and cannot change the ledger.

## Verification evidence

- `pnpm lint` — pass.
- `pnpm format:check` — pass.
- `pnpm typecheck` — pass for all four TypeScript projects.
- `pnpm test` — pass (53 backend tests).
- `pnpm test:mobile` — pass (28 tests).
- `pnpm test:e2e` — pass (4 API journeys).
- `pnpm contracts:check` — pass (86 operations, 7 idempotent commands).
- `pnpm build` — pass for NestJS and Next.js.
- `pnpm --filter mobile export:android` — pass (976 modules, Hermes bundle).
- `pnpm --filter mobile export:ios` — pass (979 modules, Hermes bundle).
- Android CNG debug APK build — previously passed with the documented
  short-path/SDK setup; generated native output is not committed.
- macOS CI workflow contains an iOS CNG + CocoaPods + unsigned Simulator build.

## Known gaps and follow-up

Physical Android/iOS device tests, process-death/weak-network checks on real
hardware, and iOS native compilation/signing on macOS remain release gates.
React Native Testing Library coverage is also a follow-up. Web Reports,
workspace administration, wealth, and bank beta are intentionally outside the
currently shipped web surface and therefore do not block mobile parity.

## Commit message

```text
docs(mobile): record web parity audit

Document route/API coverage for the Expo client and distinguish shipped online
parity from native device and future web capability gates.
```
