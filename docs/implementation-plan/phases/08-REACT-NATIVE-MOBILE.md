# Phase 8 — React Native mobile

Status: Online feature parity slice complete — Expo/CNG app, JWT/SecureStore boundary, shared API client, SQLite cache/outbox, and mobile feature routes delivered; native device sign-off remains
Depends on: [Phase 7](07-WEB-MVP-RELEASE.md), generated OpenAPI client, [auth/session architecture](../AUTH-SESSION-ARCHITECTURE.md)  
Unblocks: first-class iOS/Android daily capture

## Objective

Build one Expo React Native TypeScript app for iOS and Android that shares the
Nest `/v1` contract, supports dependable online daily tracking, then adds
controlled offline drafts without creating a second ledger.

## Business rules

- Use Expo Router, development builds, Prebuild/CNG, and the New Architecture.
  Expo Go is not the primary verification runtime; generated native projects are
  not hand-edited.
- Declare Expo peer dependencies directly and keep the SDK-compatible versions
  pinned (`expo-constants`, `expo-linking`, Expo Router, React Native,
  safe-area-context, TypeScript) so native autolinking cannot select an
  incompatible peer version.
- Keep the reviewed `unrs-resolver` postinstall enabled in the pnpm workspace;
  clean pnpm 11 installs must not fail because the native/toolchain resolver
  build was silently ignored.
- Finwise Auth uses one SecureStore-backed adapter. Tokens never enter
  AsyncStorage, SQLite, query caches, logs, analytics, route params, or crash
  breadcrumbs. Biometric lock is local convenience only.
- Bootstrap must reach `AUTHENTICATED_READY` before protected cached data renders.
  Workspace switching cancels requests, invalidates old data, opens the new
  cache partition, and reloads membership/policy/accounts.
- Offline MVP supports cached reads and manual income/expense drafts only.
  Transfer, correction, approval, import, reconciliation, and confirmed
  balance changes require an online server response.
- Draft outbox state is `LOCAL_DRAFT → QUEUED → SYNCING → SYNCED`, with
  `RETRYABLE_FAILURE`, `NEEDS_USER_ACTION`, and terminal `EXPORTED`. A stable
  `clientCommandId` is reused for every retry; queued drafts never change
  confirmed balances. Export marks a local copy only after a successful file
  write/share and never posts a journal.
- Normal logout is blocked until queued/failed financial drafts are synced,
  exported, or explicitly discarded. A new user must never see old partitions.

## Data flow

```text
Expo route -> feature screen/hook -> repository
 -> generated Nest client and/or SQLite cache/outbox -> UI state
```

SQLite commits a draft and outbox row atomically. Sync revalidates account,
category, membership, visibility, date, and amount on Nest; success links the
server transaction and invalidates affected queries. Removed/archived resources
become `NEEDS_USER_ACTION`; no silent substitution.

## Schema and API surface

Mobile local schema includes user/workspace-partitioned cached accounts,
transactions, budgets, freshness metadata, drafts, outbox commands, retry/error
classification, receipt staging, and eventual server IDs. These rows are cache
and workflow state, never authoritative financial records.

Use generated API operations for bootstrap, workspace/accounts,
income/expense creation, transaction history, balances, budgets, and Group
participant/collection/contribution/claim/reimbursement operations. Every
command passes exact Money DTOs, token callback, request ID, and stable
idempotency key. Receipt staging remains user/workspace-partitioned local
metadata until the server upload contract is delivered. Do not duplicate
backend domain entities.

## Client behavior

Primary navigation is Overview, Transactions, Budgets, Inbox plus prominent
quick-add. Add workspace/account switchers, secure session restore, stale/offline
indicators, pending-draft totals separate from confirmed totals, retry/action
states, receipt capture staging, and deep-link reauthorization. Group
contribution/claim submission and approval inbox consume online workflows.

## Test matrix

| Area | Required cases |
| --- | --- |
| Auth | Credential login, secure restore, refresh single-flight, revoked session, biometric recovery |
| Data | generated-client contract, cache freshness, workspace/user partition isolation |
| Offline | draft → process death → retry → server confirmation, duplicate retry, conflict/action required |
| UX | loading/cached/stale/empty/error/offline/denied/partial/expired-session states |
| Security | token absence from logs/storage, logout cleanup, different-user isolation |
| Device | Android/iOS development builds, weak network, camera/receipt staging, notifications, backgrounding |
| Accessibility | keyboard/screen reader equivalents, touch target, focus and error labels |

## Migration notes and rollout

Perform the Expo migration separately from product feature work. Inspect Git
history before replacing any superseded Flutter/Expo source; preserve user work
and review the replacement diff. Establish dev/staging/production app IDs,
deep-link domains, Auth/Storage resources, and runtime-version policy. Build an
internal development build before device verification; Expo intentionally skips
iOS native project generation on Windows, and iOS signing requires a macOS local
or managed runner.

## Delivered slices

- 2026-08-31: Expo Router scaffold, exact-money manual-draft outbox, cache
  partitioning, and provider-neutral online sync coordinator are checked in.
  The coordinator preserves `clientCommandId` as the idempotency key and
  distinguishes retryable failures from conflicts requiring user action. See
  the [mobile outbox scaffold walkthrough](../../reviews/2026-08-31-mobile-outbox-scaffold-walkthrough.md)
  and [mobile sync walkthrough](../../reviews/2026-08-31-mobile-outbox-sync-walkthrough.md).

## Exit criteria

- One codebase delivers the online path sign-in → bootstrap → workspace →
  account → transaction → history/balance on Android and iOS builds.
- Offline drafts survive process death, retry with the same idempotency key, and
  cannot create duplicates or alter confirmed balances.
- Secure logout/user switching, cache partitioning, deep links, and typed error
  handling pass physical-device tests.

## Delivered slices

- 2026-08-31: Expo Router/CNG metadata, controlled manual-draft outbox state
  machine, stable idempotency key, and user/workspace cache partition helper.
  See the [change walkthrough](../../reviews/2026-08-31-mobile-outbox-scaffold-walkthrough.md).
- 2026-08-31: a provider-neutral adapter now maps the generated transaction
  client into the outbox and validates user/workspace-partitioned snapshots for
  process restart recovery. See the [outbox persistence adapter walkthrough](../../reviews/2026-08-31-mobile-outbox-persistence-adapter-walkthrough.md).

The phase remains open until SecureStore, SQLite, generated API screens,
process-death recovery, and Android/iOS development-build verification pass.

## 2026-09-01 implementation update

The online and controlled-offline client slice is now implemented. Mobile uses
the custom Finwise JWT service (not Supabase), receives rotated refresh tokens
only through the explicit `X-Finwise-Client: mobile` transport, and shares the
Nest API client for overview, accounts, transactions, budgets, full Group
Treasury workflows, CSV inbox matching/raw cleanup, reconciliation adjustment,
and settings. Exact VND
minor-unit strings are used throughout; offline manual income/expense drafts
are queued in a
user/workspace-partitioned SQLite boundary and synchronized with one stable
idempotency key. Import rows can be matched to an existing transaction
without posting, raw CSV data can be deleted while normalized evidence remains,
and open reconciliation checkpoints can post one exact-difference adjustment
through the ledger. Online command forms capture their payload and retain one
idempotency key across retries; editing the payload starts a new command.
Interrupted `SYNCING` drafts are re-queued after process restart, and
workspace switching clears old query/cache reads before loading the new scope;
logout checks pending drafts across every workspace available to the user.
Retryable network failures are re-queued before the next foreground sync while
retaining the original idempotency key.
API error envelopes are classified at the sync boundary so permission and
conflict failures move to `NEEDS_USER_ACTION` instead of retrying indefinitely.
The app shell retries queued drafts when the app becomes active again and
surfaces a generic token-free sync notice when local persistence or transport
is unavailable.
Settings can export unresolved drafts as a CSV and then unlock logout by moving
those records to `EXPORTED`; this is local evidence only and does not alter the
confirmed ledger.
The shared transport now emits a validated `X-Request-Id` on JSON and CSV
requests and preserves a caller-supplied ID across access-token refresh retry,
which keeps mobile diagnostics correlated with backend request logs.
The repository CI quality job runs mobile unit tests plus Android and iOS
JavaScript exports alongside backend/frontend gates.
An additional Ubuntu CI job generates the Android CNG project and assembles a
debug APK from a short-path Linux workspace.
The CI workflow also includes a macOS job that generates the iOS CNG project,
installs CocoaPods, and builds an unsigned iOS Simulator target.

An Android CNG debug build now passes with the local SDK/NDK after the project
level Expo 53 autolinking override and a short `C:\v` pnpm virtual-store path.
All four ABIs and APK packaging complete successfully; generated native output
is removed after validation. The first default-path attempt reproduced
Windows' 260-character CMake limit, so the CI job remains configured to build
from a short-path Linux workspace. iOS native compilation/signing and physical
device verification remain macOS/operations gates.

See the [mobile online feature parity walkthrough](../../reviews/2026-09-01-mobile-online-feature-parity-walkthrough.md)
for affected files, verification results, and remaining device/native gates.

The protected Expo stack now waits for an authenticated workspace bootstrap
before composing scoped feature routes. Loading, empty, and retryable error
states are explicit and covered by a pure status classifier test. See the
[bootstrap readiness walkthrough](../../reviews/2026-09-01-mobile-bootstrap-readiness-walkthrough.md).

The mobile app now has an opt-in local biometric app lock. Preferences are
partitioned by authenticated user in SecureStore, enabling requires a
successful native biometric challenge, and returning from the background
re-locks the protected route tree. The recovery action signs out to the
password login flow; it does not weaken or replace server JWT validation.
Face ID/Touch ID permission text is declared through Expo config so native
projects remain CNG-generated. See the [biometric app lock walkthrough](../../reviews/2026-09-02-mobile-biometric-app-lock-walkthrough.md).

Confirmed logout now removes every user-partitioned SQLite key (cached reads,
outbox snapshots, and staged receipt metadata) after the pending-draft policy
allows logout. A storage failure keeps the session active and asks the user to
retry, avoiding a false security guarantee. See the [logout data cleanup
walkthrough](../../reviews/2026-09-02-mobile-logout-data-cleanup-walkthrough.md).

Workspace selection now resolves only against the latest authorized bootstrap
list. If membership is revoked or a workspace is archived while the app is
open, the mobile scope falls back to the server-suggested authorized workspace
instead of issuing reads for a stale id. See the [workspace authorization
fallback walkthrough](../../reviews/2026-09-02-mobile-workspace-authorization-fallback-walkthrough.md).

The mobile Imports & reconciliation screen now makes primary read failures
explicit. Account/import/reconciliation loading is gated, unavailable reads
show a retryable state, stale cached lists carry a warning, and normalized-row
or checkpoint failures have local retry actions instead of silently rendering
blank cards. See the [inbox data-state walkthrough](../../reviews/2026-09-01-mobile-inbox-state-walkthrough.md).

The mobile Record movement screen now gates on a usable active-account list.
Loading and unavailable account reads have explicit panels and retry, an empty
or fully archived list links to account management, and stale cached accounts
remain usable only with a visible warning. See the [transaction account-state
walkthrough](../../reviews/2026-09-01-mobile-transaction-account-state-walkthrough.md).

Mobile transport orchestration is now isolated under bounded-context services
for overview, ledger, planning, Group Treasury, and ingestion. Expo routes own
presentation state and navigation while services wrap the shared API client;
request paths, payloads, idempotency, and UI behavior remain unchanged. See the
[feature-service boundary walkthrough](../../reviews/2026-09-01-mobile-feature-service-boundary-walkthrough.md).

Overview now surfaces the server's partial-access indicator and renders ledger,
cleared, and reconciled balance views for each visible account, matching the
web permission-aware presentation. See the [partial-access balance walkthrough](../../reviews/2026-09-01-mobile-partial-access-walkthrough.md).

The navigation now exposes the same Reports surface as web (with an explicit
placeholder until a reporting API exists), and manual movement capture accepts
an ISO effective date that is preserved through online posting and offline
income/expense drafts. See the [surface parity walkthrough](../../reviews/2026-09-01-mobile-web-surface-parity-walkthrough.md).

Overview now renders an explicit loading state while balance detail is being
fetched, and Group direct-expense capture accepts the same user-selected
effective date as web. The date is validated at the mobile boundary and sent
to the server unchanged. See the [balance and Group state walkthrough](../../reviews/2026-09-01-mobile-balance-group-state-walkthrough.md).

Inbox and reconciliation now stop at an explicit account-setup state when no
visible active account is available, with a direct Accounts navigation action.
Archived or hidden accounts never become selectable. See the [inbox account
gate walkthrough](../../reviews/2026-09-01-mobile-inbox-account-gate-walkthrough.md).

Group claim and direct-expense commands now expose an explicit active-account
prerequisite and remain disabled until a visible active account is available.
Collection and participant setup are unaffected. See the [Group account gate
walkthrough](../../reviews/2026-09-01-mobile-group-account-gate-walkthrough.md).

The mobile API URL boundary now resolves an unset local URL to the Android
emulator host bridge (`10.0.2.2`) while keeping explicit LAN, staging, and
production values authoritative. iOS simulator and web fall back to
`localhost`. See the [emulator API URL walkthrough](../../reviews/2026-09-01-mobile-emulator-api-url-walkthrough.md).

Workspace switching now changes the active scope immediately, cancels requests
for the previous workspace, and removes only that workspace's query cache while
preserving global bootstrap and new-scope requests. See the [workspace switch
isolation walkthrough](../../reviews/2026-09-01-mobile-workspace-switch-isolation-walkthrough.md).

The shared API client now tracks workspace-scoped transport requests and exposes
an abort boundary used during switching, so cancellation reaches the underlying
fetch rather than only hiding stale query results. See the [workspace switch
isolation walkthrough](../../reviews/2026-09-01-mobile-workspace-switch-isolation-walkthrough.md).

Transactions now have a local search over the already-authorized snapshot,
matching description, type, status, date, ID, and exact VND minor-unit amount.
The filter changes presentation only; server authorization and confirmed
ledger data remain unchanged. See the [transaction search walkthrough](../../reviews/2026-09-01-mobile-transaction-search-walkthrough.md).

Budget periods, categories, tags, and the selected monthly overview now use the
same user/workspace-partitioned SQLite read cache. When the API is unavailable,
the mobile budget screen keeps an authorized snapshot visible with an explicit
stale warning; mutations remain online-only and confirmed balances never come
from the cache. See the [budget cache walkthrough](../../reviews/2026-09-01-mobile-budget-cache-walkthrough.md).

Workspace-scoped cache reads now ignore completions from an unmounted or
superseded workspace effect. This keeps an older SQLite read from replacing the
new workspace's local snapshot during a fast switch, while the server remains
the authorization boundary. See the [cache read race walkthrough](../../reviews/2026-09-01-mobile-cache-read-race-walkthrough.md).

Protected deep links now carry a whitelisted internal route through Login or
Signup and restore that route after authentication. External, malformed, and
unknown redirect values always fall back to the authenticated Overview. See
the [deep-link reauthorization walkthrough](../../reviews/2026-09-01-mobile-deep-link-reauthorization-walkthrough.md).
