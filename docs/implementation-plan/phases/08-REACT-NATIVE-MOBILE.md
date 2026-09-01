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
