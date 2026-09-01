# Finwise mobile

This is the Expo Router TypeScript app for Finwise iOS and Android. It uses
development builds and Expo Prebuild/CNG; Expo Go is not the verification
runtime for native dependencies.

The app shares the Nest `/v1` API client with web. It includes custom JWT
login/register/refresh, workspace switching, overview, accounts/opening
balances, income/expense/transfer capture, budgets, Group Treasury
participants/collections/contributions/claims/reimbursements, CSV inbox with
session selection, row matching, needs-attention decisions and raw-data
cleanup, reconciliation checkpoints with explicit adjustments, transaction CSV
export, settings, a web-matching Reports placeholder, and an offline manual income/expense outbox. Transaction capture preserves a user-selected effective date while confirmed balances remain server-owned. Transactions can be searched locally within the authorized snapshot. Group direct expenses preserve their selected effective date too. Access
and refresh tokens are stored only in `expo-secure-store`; cache and outbox
snapshots use a user/workspace-partitioned SQLite key/value boundary. If the
process stops while a draft is syncing, the next restore re-queues that draft
with the same idempotency key.

## Local workflow

```text
pnpm --filter mobile install
pnpm --filter mobile prebuild
pnpm --filter mobile android   # or ios on macOS
```

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_FINWISE_API_URL` to a
reachable Nest base URL before starting a physical device. An Android emulator
without this override uses the host bridge at `http://10.0.2.2:3001`; an iOS
simulator or web runtime falls back to `http://localhost:3001`. Never place
access/refresh tokens in AsyncStorage, SQLite, query caches, route params, logs,
or crash breadcrumbs. Receipt staging is local
metadata only until a server upload contract exists. Offline drafts must be
explicitly synced, exported, or discarded before logout. Settings exports
unresolved drafts as CSV and marks them `EXPORTED` only after the file is
written/shared; export never creates a confirmed server transaction.

Useful checks from the repository root:

```text
pnpm typecheck:mobile
pnpm test:mobile
pnpm --filter mobile export:android
pnpm --filter mobile export:ios
```
