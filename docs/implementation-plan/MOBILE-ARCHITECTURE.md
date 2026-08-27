# Finwise Flutter mobile architecture

Status: Flutter/iOS/Android/shared-backend decision Confirmed; implementation details approved as the baseline unless superseded  
Last updated: 2026-08-27

## 1. Confirmed platform decision

Finwise mobile is one Flutter/Dart application targeting iOS and Android. The
existing Expo/React Native starter is superseded and must be replaced in a
separate, reviewable scaffold migration.

Flutter Web is not a Finwise product target. Next.js remains the web client.

All three clients use one NestJS backend:

```text
Next.js web -------- TypeScript OpenAPI client -----+
                                                   |
Flutter iOS -------- Dart/Dio OpenAPI client -------+--> NestJS /v1
                                                   |       |
Flutter Android ---- Dart/Dio OpenAPI client -------+       +--> PostgreSQL
                                                           +--> workers/providers
```

No web or mobile client directly queries Finwise financial tables. Supabase may
provide identity and signed storage access, but NestJS is the only business API
and authorization boundary.

## 2. What Flutter shares across iOS and Android

One Dart codebase shares:

- features, screens, state management, API client, validation, offline sync;
- Material/Cupertino-aware design system and most widgets;
- domain-facing presentation models and formatting;
- unit, widget, and most integration tests.

Platform folders remain because mobile is not “build once without native work”:

```text
mobile/
  android/       Gradle, manifest, signing, notification/deep-link config
  ios/           Xcode project, plist, entitlements, signing, pods/SPM
  lib/           shared Dart application
  test/
  integration_test/
  pubspec.yaml
```

Camera, biometrics, notifications, deep links, background execution, store
signing, privacy declarations, and OS-specific bugs still require Android/iOS
configuration and real-device testing.

## 3. Required development and build tooling

### Shared Flutter development

- Flutter stable SDK pinned by a version manager or documented repository
  version;
- Dart SDK bundled with Flutter;
- IDE of choice with Flutter/Dart tooling;
- `flutter doctor` as the environment verification command;
- `flutter pub get`, `flutter analyze`, and `flutter test` in CI.

### Android

Can be developed and built on Windows, Linux, or macOS.

Required:

- Android Studio or Android SDK command-line tools;
- supported JDK/Gradle versions selected by the Flutter stable toolchain;
- Android emulator or physical device;
- upload keystore and Play App Signing for release.

Outputs:

```text
flutter run
flutter build apk              # direct/internal distribution
flutter build appbundle        # preferred Play Store artifact (.aab)
```

### iOS

iOS compilation and store release require macOS and Xcode. A Windows machine
can implement most shared Dart code, but cannot produce the final iOS binary
locally.

Required:

- macOS with a supported Xcode and iOS SDK/simulator;
- CocoaPods or Swift Package Manager support as required by plugins;
- Apple ID for signed device testing;
- paid Apple Developer Program membership for TestFlight/App Store release;
- certificates/provisioning/App Store Connect configuration.

Output:

```text
flutter build ipa
```

If the team has no Mac, use a macOS CI/build service. The architecture does not
depend on one vendor; GitHub Actions macOS runners, Codemagic, or another secure
macOS runner can perform signing/build/upload after credentials are configured.

## 4. Mobile product responsibility

Mobile leads:

- quick daily income/expense entry;
- recent transactions and search;
- monthly overview and budget remaining;
- workspace/account switching;
- group contribution/claim submission and approval inbox;
- receipt capture;
- reminders and push notifications;
- biometric local app lock.

Web leads:

- workspace, role, permission, and account-visibility administration;
- nested budget configuration;
- large CSV mapping/import review;
- reconciliation, detailed reporting, and audit exploration;
- bulk operations.

First-class mobile means reliable daily workflows, not immediate one-for-one
parity with every web administration screen.

## 5. Flutter application architecture

Use feature-first layering influenced by Flutter's recommended UI/data
separation. Do not copy the backend's full DDD model into the mobile app; NestJS
owns financial business rules.

```text
mobile/lib/
  app/
    app.dart
    bootstrap.dart
    router.dart
    theme/
  core/
    api/
      generated/          # dart-dio client; never hand-edit
      api_client.dart     # auth/request/error adapter
    auth/
    database/
    sync/
    secure_storage/
    notifications/
    observability/
  features/
    workspace/
      data/               # remote/local data sources, DTO mappers, repository impl
      domain/             # UI-facing models and repository contract
      presentation/       # screens/widgets/controllers/providers
    accounts/
    transactions/
    budgets/
    group_treasury/
    imports/
  shared/
    widgets/
    formatting/
    accessibility/
```

Dependency direction inside a feature:

```text
presentation -> domain contracts <- data implementations
                                  <- API/SQLite/platform adapters
```

Rules:

1. Widgets do not call HTTP, SQLite, Supabase, or platform plugins directly.
2. API DTOs and local database rows are mapped into feature models.
3. Repositories coordinate remote and local sources and are the mobile source
   of truth for cached/offline state.
4. Mobile performs boundary/form validation for UX; Nest repeats all important
   validation and owns final authorization/invariants.
5. Financial calculations shown by mobile come from backend projections or
   exact integer/decimal representations, never Dart `double` arithmetic.

## 6. Baseline Flutter packages

Exact compatible versions are pinned during scaffold creation. Baseline roles:

| Concern | Baseline choice | Reason |
| --- | --- | --- |
| Routing/deep links | `go_router` | Declarative navigation, redirects, nested routes, deep links |
| State and dependency wiring | Riverpod | Testable async state/DI without global mutable singleton business state |
| HTTP | Dio through generated `dart-dio` OpenAPI client | Interceptors, cancellation, upload/progress, typed generated transport |
| JSON/models | `json_serializable`; immutable model generator only where it reduces real boilerplate | Explicit mapping and compile-time generated serialization |
| Local relational data | Drift over SQLite | Typed queries, migrations, transactions, observable cache/outbox |
| Auth | `supabase_flutter` if Supabase Auth is approved | Shared identity provider and mobile deep-link/session support |
| Small secrets | `flutter_secure_storage` or audited Supabase secure storage adapter | Android Keystore/iOS Keychain-backed credentials |
| Connectivity signal | `connectivity_plus` | UX hint only; a network type does not prove API reachability |
| Biometrics | `local_auth` | Local app unlock, never server authentication |
| Push | `firebase_messaging` with APNs/FCM configuration | Standard remote push path for iOS/Android |
| Crash reporting | Selected PII-scrubbed provider | Mobile crash and release diagnostics |

Avoid adding a second state-management framework, a second HTTP client, or a
generic service locator. Package health, license, platform support, and stable
Flutter compatibility must be reviewed before pinning.

## 7. Navigation

Primary navigation:

1. Overview
2. Transactions
3. Budgets
4. Inbox

Use a prominent quick-add action rather than treating “Add” as an information
tab. Accounts, reports, profile, and settings are secondary routes. Workspace
switching is globally reachable.

Route groups/guards represent:

```text
bootstrap/splash
auth
authenticated app
workspace-required routes
permission-aware feature routes
modal flows: quick transaction, filters, receipt capture
```

Navigation guards improve UX only. NestJS rechecks authentication, workspace
membership, permission, resource scope, and business state on every request.

Deep links cover authentication callbacks and safe application routes. Opening
a deep link or notification reloads the object through Nest and handles deleted,
hidden, unauthorized, and offline states.

## 8. API and authentication

The Nest OpenAPI document is canonical. CI generates:

- `typescript-fetch` client for Next.js;
- `dart-dio` client for Flutter.

Generated code is never manually edited. A thin Flutter adapter supplies:

- API base URL/flavor;
- access token;
- request/correlation ID;
- idempotency key on retriable commands;
- typed error mapping;
- refresh/logout behavior;
- safe logging with secret/PII redaction.

With Supabase Auth:

1. Flutter authenticates through `supabase_flutter`.
2. Auth returns/refreshes the identity session.
3. Flutter attaches the access token to Nest requests.
4. Nest validates token signature, issuer, audience, expiry, and subject.
5. Nest maps `sub` to internal User and evaluates Finwise workspace permissions.
6. Flutter never uses Supabase Data API to read/write financial tables.

Environment-specific publishable identifiers are compiled using approved flavor
configuration or `--dart-define-from-file`. A publishable key is not a server
secret, but service-role keys, bank credentials, signing keys, and private
encryption keys must never be included in the app binary.

## 9. Offline scope

MVP uses controlled offline support:

- cached read access with a visible freshness/stale state;
- create new manual income/expense drafts offline;
- synchronize queued drafts after connectivity returns;
- server alone confirms transaction, balance, budget, audit, and permissions;
- posted edit/reversal, transfer, approval, import, and reconciliation initially
  require an online server response.

This is not a second ledger on the phone.

### Draft/outbox state machine

```text
LOCAL_DRAFT
  -> QUEUED
  -> SYNCING
  -> SYNCED

SYNCING -> RETRYABLE_FAILURE -> QUEUED
SYNCING -> NEEDS_USER_ACTION
```

Each draft has:

- local ID and immutable `clientCommandId`;
- workspace/account/category snapshots and exact minor-unit amount;
- created/edited time and local timezone context;
- retry count/last error classification;
- optional receipt local path/upload state;
- eventual server transaction ID.

Synchronization:

1. local repository commits the draft/outbox row atomically;
2. sync worker sends the same `Idempotency-Key` on every retry;
3. Nest revalidates all IDs, permission, account visibility, period, and amount;
4. success links local draft to the server ID and refreshes affected queries;
5. archived resource/permission rejection becomes `NEEDS_USER_ACTION`; never
   silently switch account/category;
6. server conflict/error messages remain typed and safe.

Never optimistically include queued drafts in confirmed balance. UI may show a
separate “pending sync” total.

## 10. Local persistence and security

| Data | Storage |
| --- | --- |
| Access/refresh session material | Keychain/Keystore through secure storage adapter |
| Cached accounts/transactions/budgets | Drift/SQLite |
| Offline command outbox | Drift/SQLite transactionally |
| Receipt waiting for upload | App-private filesystem plus SQLite metadata |
| Non-sensitive preferences | Shared preferences or settings table |

Security rules:

- clear/partition caches by authenticated user and workspace;
- encrypted backup/restore behavior must be tested per platform;
- logout revokes/clears session and sensitive cache;
- if unsynced drafts exist, present an explicit sync/export/discard decision;
- biometric changes can invalidate local secure keys, so server recovery login
  remains available;
- rooted/jailbroken device detection may inform risk UX but is not a perfect
  security boundary;
- local database encryption is a separate threat-model decision; do not claim
  SQLite is encrypted merely because the app sandbox is private.

## 11. State and unidirectional data flow

Use Riverpod providers/controllers as presentation state and dependency wiring,
while repositories own data access/synchronization.

```text
Widget event
  -> feature controller/view model
  -> repository
  -> remote service and/or local Drift database
  -> immutable state/result
  -> widget renders loading/data/empty/error/offline/denied
```

Do not store an authoritative workspace balance or permission matrix in a
global mutable provider. Cache server results with scope/version/freshness and
invalidate on workspace switch or mutations.

Every data screen handles:

- initial loading;
- cached/stale loading;
- empty;
- retryable error;
- validation/business error;
- offline;
- permission denied;
- partial account visibility;
- session expired.

## 12. Notifications and background behavior

Remote push uses FCM for Android and APNs integration for iOS, commonly through
Firebase Messaging. Local notifications support device reminders.

- ask notification permission in context, not blindly at first launch;
- device installations/tokens are registered with Nest per user/environment;
- rotate/disable tokens on refresh/logout;
- lock-screen payload omits sensitive amounts/descriptions by default;
- payload contains a safe route/resource ID; app reloads and authorizes it;
- push delivery is best-effort and never changes business state;
- background execution is OS-controlled and cannot be assumed to run exactly on
  schedule;
- offline financial commands sync when the app can run and reach Nest, with an
  explicit user-visible queue.

## 13. Flavors and configuration

Create three flavors:

| Flavor | API/Auth/Storage | Application identity | Distribution |
| --- | --- | --- | --- |
| dev | Local/dev services | dev bundle/application ID | Developer devices/emulators |
| staging | Isolated staging resources | staging ID | Internal Android/TestFlight |
| production | Production resources | production ID | Play Store/App Store |

Each flavor has distinct deep-link scheme, app name/icon marker, Firebase/APNs
configuration, and crash-report environment. Never let a staging build silently
connect to production.

## 14. Build, signing, and release pipeline

### Pull request

```text
dart format --set-exit-if-changed
flutter analyze
flutter test
OpenAPI generated-client freshness check
```

### Android release candidate

- build signed AAB on Linux/Windows/macOS CI;
- store upload key in protected CI secrets;
- upload to Play internal testing;
- run smoke/integration tests on representative devices.

### iOS release candidate

- build on macOS runner with selected Xcode/Flutter version;
- install dependencies and signing profiles in an ephemeral keychain;
- run `flutter build ipa`;
- upload to TestFlight;
- test on physical iPhone before App Store submission.

Use one version in `pubspec.yaml` and CI-controlled monotonically increasing
build numbers. Maintain release notes, symbol files, rollback policy, privacy
manifest, store declarations, and crash mapping artifacts.

## 15. Testing strategy

| Test type | Scope |
| --- | --- |
| Unit | Money parsing/formatting, DTO mapping, draft state machine, retry classification |
| Repository | Remote/local source priority, cache partition, outbox idempotency, migrations |
| Widget | Loading/empty/error/offline/denied forms and platform layouts |
| Golden/accessibility | Critical screens, text scaling, contrast, semantics |
| Integration | Auth/deep link, workspace switch, create transaction, offline->online sync, logout |
| Contract | Generated Dart client against Nest OpenAPI and typed errors |
| Real device | Biometrics, keychain/keystore, camera, keyboard, backgrounding, process death, weak network |

Use Flutter's `integration_test` baseline. Add third-party device automation only
when it solves a demonstrated CI/device-lab requirement.

## 16. Source migration from Expo

The architecture decision does not silently delete source. Perform a dedicated
task:

1. verify the current Expo starter contains no user work to preserve;
2. archive/recover through Git history, then replace `mobile/` with
   `flutter create` output using approved organization/bundle IDs;
3. remove Expo/Node lockfiles and dependencies under `mobile`;
4. add Flutter-specific `AGENTS.md`, analysis options, flavors, and root scripts;
5. generate the Dart API client from a minimal Nest OpenAPI spec;
6. run Android debug build and iOS CI smoke build;
7. review diff before committing the migration separately.

## 17. Confirmed and remaining decisions

Confirmed:

1. Flutter is the mobile framework.
2. One Flutter codebase targets iOS and Android.
3. Next.js remains the web client.
4. Web, iOS, and Android use the same NestJS backend and business rules.
5. Clients do not directly own financial truth.

Remaining product/operations choices:

1. Is Android released first, or are Android/iOS released together?
2. Which login methods ship first?
3. Must offline drafts survive logout/user switching, or must users sync/export
   before logout?
4. Is encrypted local SQLite required for the pilot threat model?
5. Are receipt camera/upload and remote push in MVP?
6. Does the team have a Mac, or should iOS builds use a managed macOS CI service?

