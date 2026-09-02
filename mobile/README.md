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
export, settings, a web-matching Reports placeholder, and an offline manual income/expense outbox. Transaction capture preserves a user-selected effective date while confirmed balances remain server-owned. Transactions can be searched locally within the authorized snapshot. Budget periods, categories, tags, and the selected monthly overview are also cached per user/workspace for stale read continuity; budget mutations remain online-only. Group direct expenses preserve their selected effective date too. Access
and refresh tokens are stored only in `expo-secure-store`; cache and outbox
snapshots use a user/workspace-partitioned SQLite key/value boundary. If the
process stops while a draft is syncing, the next restore re-queues that draft
with the same idempotency key. The last server-authorized workspace list is
also cached per user so previously loaded reads can reopen offline; the app
labels this state and keeps all mutations online-only. The last selected
workspace is persisted per user as a UX preference and is revalidated against
the current bootstrap response before it is used.

The Transactions screen opens workspace-scoped journal detail with entries,
classification, audit history, and source evidence. Posted income/expense
journals can be classified exactly once with VND split lines and tags. Posted
income/expense/transfer journals can be corrected online through an idempotent
reversal-and-replacement command; offline correction and classification remain
intentionally unsupported.

Protected deep links are restored after authentication only for whitelisted
internal routes; external redirect values fall back to Overview.

The app also supports an opt-in local biometric lock. The preference is stored
per user in SecureStore, biometric verification gates protected screens after
backgrounding, and the recovery action returns to password login. This is a
device convenience layer; server JWT/session authorization remains unchanged.

## Local workflow

```text
pnpm --filter mobile install
pnpm --filter mobile prebuild
pnpm --filter mobile android   # or ios on macOS
```

EAS build profiles are checked in for the three release lanes:

```text
eas build --profile development --platform all
eas build --profile preview --platform all
eas build --profile production --platform all
```

Development builds are internal distribution builds and include the Expo
development client. Preview builds are suitable for QA distribution. The
production profile enables EAS version auto-increment; credentials and the
EAS project identifier remain deployment-owned configuration and are not
committed here.

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

The network-security CNG plugin permits local HTTP only when
`FINWISE_ALLOW_HTTP=true` outside release profiles or the EAS build profile is
`development`, which supports local HTTP API URLs on Android and iOS. Preview
and production profiles always remove the Android cleartext flag and iOS ATS
arbitrary-load exception, even if a local switch was accidentally inherited;
those builds must use HTTPS API endpoints.

Useful checks from the repository root:

```text
pnpm typecheck:mobile
pnpm test:mobile
pnpm --filter mobile test:native-config
pnpm --filter mobile export:android
pnpm --filter mobile export:ios
```
