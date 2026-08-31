# Phase 8 — React Native mobile

Status: Outbox boundary complete — Expo/outbox scaffold, generated-client adapter, and restart snapshots delivered; native adapters remain
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
- Supabase Auth uses one SecureStore-backed adapter. Tokens never enter
  AsyncStorage, SQLite, query caches, logs, analytics, route params, or crash
  breadcrumbs. Biometric lock is local convenience only.
- Bootstrap must reach `AUTHENTICATED_READY` before protected cached data renders.
  Workspace switching cancels requests, invalidates old data, opens the new
  cache partition, and reloads membership/policy/accounts.
- Offline MVP supports cached reads and manual income/expense drafts only.
  Transfer, correction, approval, import, reconciliation, and confirmed
  balance changes require an online server response.
- Draft outbox state is `LOCAL_DRAFT → QUEUED → SYNCING → SYNCED`, with
  `RETRYABLE_FAILURE` and `NEEDS_USER_ACTION`. A stable `clientCommandId` is
  reused for every retry; queued drafts never change confirmed balances.
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
submission. Every command passes exact Money DTOs, token callback, request ID,
and stable idempotency key. Do not duplicate backend domain entities.

## Client behavior

Primary navigation is Overview, Transactions, Budgets, Inbox plus prominent
quick-add. Add workspace/account switchers, secure session restore, stale/offline
indicators, pending-draft totals separate from confirmed totals, retry/action
states, receipt capture staging, and deep-link reauthorization. Group
contribution/claim submission and approval inbox consume online workflows.

## Test matrix

| Area | Required cases |
| --- | --- |
| Auth | OTP/deep link, secure restore, refresh single-flight, revoked session, biometric recovery |
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
internal development build before device verification; iOS signing requires a
macOS local or managed runner.

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
