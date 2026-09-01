# Mobile online feature parity walkthrough — 2026-09-01

## Scope

This slice turns the existing Expo/outbox scaffold into a usable Finwise
mobile client for both iOS and Android JavaScript bundles. It adds custom JWT
session handling, workspace bootstrap/switching, overview, accounts and
opening balances, income/expense/transfer capture, immutable transaction void,
budgets, Group Treasury collection/submission/claim/reimbursement workflows,
local receipt staging, CSV inbox matching/raw cleanup, reconciliation
checkpoints/adjustments, settings, SQLite-backed cache/outbox snapshots, and
retryable offline manual drafts.

The mobile app deliberately reuses the Nest `/v1` API and the shared
`@finwise/api-client` transport. It does not introduce a second ledger or
duplicate backend authorization rules.

## Non-goals and remaining gates

- Server receipt upload/camera sync, push notifications, biometric app lock,
  and wealth screens are not part of this slice.
- Native signing and physical-device verification remain an operations gate;
  Windows can validate Expo Android/iOS JavaScript exports and Android CNG
  generation, but iOS compilation/signing requires macOS/Xcode or CI.
- Large role administration and CSV-column mapping remain web-led. The core
  Group Treasury actions are available online on mobile; staged receipts are
  intentionally local metadata until a server upload contract is introduced.

## Affected files and modules

- `mobile/app/`: Expo Router auth, protected app routes, feature screens, and
  quick transaction flow. Accounts are available in primary navigation. Group
  covers participants, collections, obligations,
  contributions, verification/overpayment resolution, sponsored expenses,
  claims, payables, reimbursements, and direct expenses. The inbox also
  accepts a native CSV document pick and reads the selected file into the
  review flow; Transactions can export the server-generated CSV through the
  native share sheet. Inbox starts empty instead of presenting demo rows, and
  overview/budget rows resolve account/category names from server responses.
  Group collection progress and supporting lists now expose retryable error
  states instead of falling back to an indefinite loading label.
- `mobile/src/auth/`: SecureStore session adapter, restore, rotation, and
  single-flight refresh.
- `mobile/src/app/providers.tsx`: TanStack Query and workspace bootstrap scope.
- `mobile/src/ui/`: shared Finwise mobile components, navigation shell, and
  loading/empty/error/denied-friendly states.
- `mobile/src/sync/`: existing immutable draft state machine plus SQLite
  storage, partitioned outbox repository, stable idempotency, retry/action
  classification, foreground sync, reusable payload-fingerprint command keys
  for online financial mutations, and CSV export with terminal `EXPORTED`
  state after a successful file write/share.
- `mobile/src/sync/stable-command-key.ts` and its spec: centralize command-key
  reuse for unchanged payloads and rotate keys when a form payload changes.
- `mobile/src/cache/workspace-cache.ts`: user/workspace-partitioned cached
  overview, account, transaction, and balance reads with stale fallback.
- `mobile/src/cache/receipt-staging.ts`: user/workspace-partitioned local
  receipt metadata and file URI staging; it never posts a ledger entry by
  itself.
- `packages/api-client/src/index.ts`: shared auth, account, ledger, planning,
  group, import, and reconciliation operations. Every request now carries a
  validated `X-Request-Id`; callers may supply a stable correlation value and
  access-token retries preserve the same ID.
- `backend/src/auth/auth.controller.ts`: mobile-only refresh-token response and
  header transport while retaining the web HttpOnly cookie contract.
- `contracts/openapi.json`: optional mobile refresh-token field documented.
- `mobile/package.json`, `mobile/app.json`, `pnpm-lock.yaml`: Expo SDK 53,
  development-client, SQLite, native document/file/share access, CNG, and
  SDK-compatible navigation dependencies.
- `.github/workflows/ci.yml`: mobile unit tests and Android/iOS JavaScript
  exports are now part of the quality job, so web/backend green checks cannot
  silently skip the mobile bundle. A separate Ubuntu job generates the Android
  CNG project and assembles a debug APK from a short-path Linux workspace.
  A macOS job generates the iOS CNG project, installs Pods, and builds the
  unsigned simulator target with `xcodebuild`.
- `.gitignore`: generated `mobile/android/` and `mobile/ios/` projects are
  ignored because `mobile/app.json` is the CNG source of truth.
- `mobile/.env.example`: device/emulator API URL setup without embedding
  credentials or tokens.

## Business rules and data flow

1. Credentials are sent to Nest. Mobile responses include a refresh token only
   when `X-Finwise-Client: mobile` is present; the web continues receiving an
   HttpOnly cookie.
2. Access and refresh tokens are held by the SecureStore adapter. The API
   client attaches access tokens and sends the refresh token only to the auth
   refresh/logout endpoints.
3. Authenticated bootstrap selects a workspace. Switching invalidates old
   workspace query data before loading the new scope.
4. Confirmed accounts, transactions, balances, budgets, groups, imports and
   reconciliation are always read or written through Nest authorization.
5. Offline manual income/expense creates a `LOCAL_DRAFT`, queues it, and never
   changes confirmed totals. A stable `clientCommandId` is retained as the
   server idempotency key across retries.
   The quick-add screen can use a previously cached visible account list while
   offline; transfer/correction commands remain online-only.
6. SQLite stores only partitioned cache/workflow snapshots. Server success
   links the draft to its transaction and invalidates affected queries.
   A draft persisted during an interrupted `SYNCING` request is re-queued on
   the next process start instead of becoming permanently stuck.
   Retryable network failures are re-queued before the next foreground sync;
   they do not require recreating the draft or changing its idempotency key.
   API error envelopes are narrowed at the sync boundary so permission and
   conflict failures become `NEEDS_USER_ACTION`, not endless retries.
   The shell retries queued drafts when the app returns to the foreground and
   presents a generic, token-free notice if local sync is still unavailable.
7. Import matching links a normalized row to an existing transaction without
   posting another journal. Raw CSV deletion keeps normalized evidence and is
   explicit. Reconciliation adjustments post the exact signed difference once
   through the immutable ledger.
8. Group submissions and claims remain workflow records until an authorized
   verification/approval action invokes the backend Ledger port. Reimbursement
   settles a payable without counting the expense a second time.
9. Logout is offered from Settings and is blocked while a queued/retryable or
   action-required draft exists; the user can sync, export, or discard
   explicitly. Exported drafts do not create a server transaction.
10. The shared transport emits a safe request correlation ID on JSON and CSV
    calls. A supplied ID is validated at the client boundary and reused for a
    401 retry so server logs can correlate the complete logical operation.

```text
Expo route -> feature screen -> TanStack Query/use-case call
                         -> @finwise/api-client -> Nest /v1 -> PostgreSQL
                         -> SQLite cache/outbox only for reads and drafts
```

## Public API and UI behavior

The shared client now exposes `login`, `register`, `refresh`, `logout`,
`getBootstrap`, overview/accounts/transactions/balances, categories/tags,
budgets, Group Treasury participant/collection/obligation/submission,
verification/overpayment, sponsored-expense, claim/payable/reimbursement, and
direct-expense operations, import matching/raw cleanup, reconciliation
adjustment, and CSV export. Financial
commands accept the same VND minor-unit strings and idempotency keys as web.

Mobile routes are `/login`, `/signup`, and the protected `(app)` group:
overview, accounts, transactions, quick-add transaction, budgets, group,
inbox, and settings. Budgets expose nested categories, all three allocation
modes, rollover, period close, and actuals. The inbox can import either pasted
CSV text or a selected CSV/text document. Transactions export the same
permission-filtered CSV as web. Every screen includes loading, empty,
retryable error, and feedback states appropriate to its data. Cached reads are
identified when the network is unavailable. Online opening-balance, direct
group-expense, reimbursement, and transaction commands retain one
idempotency key for the full action/retry lifecycle; changing the form input
creates a new command key. Settings reports how many drafts synced, remain
retryable, or need user action after an explicit sync attempt, while the shell
keeps its notice generic and token-free.

## Migration and security implications

- Expo SDK-compatible `react-native-screens`, `react-native-safe-area-context`,
  `expo-dev-client`, `expo-system-ui`, `expo-sqlite`,
  `expo-document-picker`, `expo-file-system`, and `expo-sharing` are now
  direct dependencies. CNG remains
  the source of native configuration; generated `android/` output was created
  for validation and removed from the worktree.
- Android CNG explicitly opts into `edgeToEdgeEnabled` so the app is ready for
  Android 16 behavior; native code remains generated and is not hand-edited.
- The API change is backward-compatible: web callers retain cookie sessions;
  mobile callers opt into the refresh-token JSON field with an explicit client
  header.
- Token values never enter SQLite, AsyncStorage, query keys, route params, or
  logs. Query cache is cleared when auth becomes signed out.
- SQLite values are prepared/bound and keys are partitioned by user/workspace.

## Verification

- `pnpm --store-dir .pnpm-store install --frozen-lockfile` — pass.
- `pnpm build` — pass (backend Nest build and frontend Next build).
- `pnpm typecheck` — pass (backend, frontend, mobile).
- `pnpm lint` — pass (backend and frontend).
- `pnpm format:check` — pass (backend, frontend, mobile).
- `pnpm contracts:check` — pass (86 operations, 7 idempotent command checks).
- `pnpm --filter backend test --runInBand` — pass (14 suites, 53 tests).
- `pnpm --filter mobile test -- --runInBand` — pass (24 API/auth/outbox/
  persistence/receipt tests, including request-ID retry correlation,
  retryable-outbox recovery, API-error classification, exported-draft terminal
  state, and CSV escaping).
- `pnpm dlx expo-doctor` — pass (18/18 checks).
- `pnpm --filter mobile export:android` — pass (994 modules, Hermes bundle).
- `pnpm --filter mobile export:ios` — pass (997 modules, Hermes bundle).
- `expo prebuild --no-install` — pass for Android CNG on Windows; iOS native
  signing/build remains macOS-only.
- `android/gradlew.bat app:assembleDebug` — CNG configuration and Java/Kotlin
  compilation advanced successfully after setting `ANDROID_HOME`, then the
  Windows build stopped at CMake's 260-character path limit inside the pnpm
  symlink tree (`react-native-edge-to-edge` codegen path). This is an
  environment/toolchain limitation; the generated `android/` directory was
  removed after the check.
- The new `mobile-android-native` CI job is configured to repeat this build on
  Ubuntu, where the pnpm path does not hit the Windows MAX_PATH limit. CI
  execution remains pending until the workflow runs on GitHub.
- The new `mobile-ios-native` job is configured for macOS simulator compilation
  without signing. Device provisioning, App Store signing, and physical-device
  behavior still require release credentials and operations approval.
- `pnpm dev` smoke — pass: backend compiled with zero TypeScript errors, Nest
  started successfully, `/v1/health/live` returned 200, and frontend `/login`
  returned 200. Running `pnpm --filter backend start:dev` directly also reached
  `Found 0 errors. Watching for file changes.`; an `ELIFECYCLE` line without a
  compiler error is the workspace runner reporting a child-process shutdown,
  not a TypeScript failure.
- Native CSV export uses the platform share sheet when available and falls back
  to a device-local file when sharing is unavailable. Receipt staging is local
  only and is deliberately not represented as a confirmed claim attachment.

## Known gaps and follow-up

1. Add React Native Testing Library component coverage and a real-device
   matrix for process death, weak network, SecureStore invalidation, and
   workspace switching.
2. Add biometric local lock, server receipt upload/camera sync, and
   notification routes after their native permissions and operational policy
   are approved.
3. Add dedicated role administration and CSV-column mapping flows if mobile
   users need them; core import matching and reconciliation adjustment are now
   online, while bulk confirmation remains a follow-up.
4. Let the Ubuntu Android and macOS iOS simulator jobs run, then add device
   development builds and signing profiles in CI before declaring Phase 8
   release-ready.

## Suggested commit message

```text
feat(mobile): deliver Expo client with JWT, ledger features, and offline drafts

Share the Nest API contract across mobile features, keep tokens in SecureStore,
and persist user/workspace-scoped cache and idempotent manual drafts in SQLite.
Add mobile auth transport headers while preserving web cookie sessions.
Carry validated request correlation IDs through JSON/CSV calls and auth retry.
```
