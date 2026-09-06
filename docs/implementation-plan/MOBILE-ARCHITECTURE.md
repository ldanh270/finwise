# Finwise React Native mobile architecture

Status: React Native/iOS/Android/shared-backend decision Confirmed; Expo workflow
recommended as the implementation baseline unless superseded
Last updated: 2026-08-29

## 1. Confirmed platform decision

Finwise mobile is one React Native and TypeScript application targeting iOS and
Android. This decision supersedes the Flutter decision recorded on 2026-08-27.
The previous Flutter investigation and scaffold work remain historical evidence;
source and root-script cleanup must happen in a separate reviewable migration.

Next.js remains the web client. React Native Web is not a Finwise product target.
All clients use the same NestJS business API:

```text
Next.js web ---------------- TypeScript OpenAPI client ----+
                                                         |
React Native iOS ---------- TypeScript OpenAPI client ----+--> NestJS /v1
                                                         |       |
React Native Android ------ TypeScript OpenAPI client ----+       +--> PostgreSQL
                                                                 +--> workers/providers
```

No web or mobile client directly queries Finwise financial tables. Finwise Auth
and storage adapters stay behind application ports, and NestJS is the only API,
authorization boundary, and source of confirmed financial state.

## 2. Recommended Expo workflow

The recommended baseline uses Expo as the React Native framework with:

- Expo Router;
- development builds through `expo-dev-client`;
- Expo Prebuild/Continuous Native Generation (CNG);
- the React Native New Architecture;
- local native builds or EAS Build according to environment and release needs.

Expo Go may be used for an early UI experiment only. It is not the primary
Finwise development or verification runtime because secure storage options,
biometrics, notifications, SQLCipher, and other native configuration require a
Finwise-specific development build.

Prefer generated native projects. Native configuration belongs in app config,
config plugins, or an explicitly reviewed local Expo module. Do not hand-edit a
generated `ios/` or `android/` directory and then expect `prebuild --clean` to
preserve the change.

Move to manually maintained bare native projects only after a demonstrated
requirement cannot be represented safely through Expo modules, config plugins,
or CNG. Expo services such as EAS Build and EAS Update are operational choices,
not architectural dependencies; local builds and another CI provider remain
valid.

## 3. What is shared across iOS and Android

One TypeScript codebase shares:

- features, screens, navigation, API integration, validation, and sync logic;
- design tokens and most React Native components;
- UI-facing models, exact money formatting, and typed errors;
- unit, component, repository, and most end-to-end tests.

Platform-specific code remains justified for:

- application and signing configuration;
- permissions, notification entitlements, and deep/universal links;
- native behavior that differs materially between Android and iOS;
- a config plugin or local Expo module when no maintained package satisfies a
  proven requirement.

Platform-specific files use `.ios.ts(x)` and `.android.ts(x)` only where actual
behavior differs. Do not fork whole features by platform.

## 4. Repository strategy and shared code

React Native returns Finwise to a TypeScript monorepo. The target structure is:

```text
finwise/
  backend/                    # NestJS
  frontend/                   # Next.js
  mobile/                     # Expo + React Native
  packages/
    api-client/               # generated platform-neutral OpenAPI client
    eslint-config/            # optional when duplication becomes material
    tsconfig/                 # optional shared compiler baselines
  contracts/
    openapi.json              # generated canonical transport contract
```

Use one root pnpm workspace and lockfile once the dedicated migration is
approved. Do not introduce Nx or Turborepo until task-graph scale or CI timing
demonstrates a need.

Share only code with identical semantics on both clients:

- generated OpenAPI DTOs and operations;
- stable public error codes;
- pure transport-neutral primitives where duplication is material.

Do not share:

- React Native and web UI components;
- navigation or storage implementations;
- session adapters;
- Prisma types or backend domain entities;
- financial business rules merely to avoid an API call.

The generated API client accepts injected base URL, fetch implementation,
headers, and token acquisition. Web and mobile wrap it with different session
and runtime adapters. Generated code is disposable and never manually edited.

## 5. Mobile product responsibility

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

First-class mobile means dependable daily workflows, not immediate one-for-one
parity with every web administration screen.

## 6. Application architecture

Use feature-first organization with thin Expo Router files:

```text
mobile/
  app/                        # routes/layouts only
    _layout.tsx
    (auth)/
    (app)/
      _layout.tsx
      overview/
      transactions/
      budgets/
      inbox/
    transaction/
      new.tsx
  src/
    app/
      bootstrap/
      config/
      providers/
      theme/
    core/
      api/
      auth/
      database/
        migrations/
      notifications/
      observability/
      security/
      sync/
    features/
      workspace/
        api/
        model/
        repository/
        hooks/
        ui/
      accounts/
      transactions/
      budgets/
      group-treasury/
      bank-inbox/
    shared/
      formatting/
      testing/
      ui/
      validation/
```

Data flows in one direction:

```text
Route -> feature screen -> feature hook/controller -> repository
                                                   -> Nest API and/or SQLite
                                                   -> query/immutable UI state
                                                   -> rendered screen
```

Rules:

1. Route files read route params and compose screens; they do not call HTTP or
   contain financial logic.
2. Presentational components do not call HTTP, SQLite, auth adapters, or native APIs.
3. Feature repositories coordinate generated API operations and local storage.
4. API DTOs and SQLite rows are mapped explicitly to UI-facing models.
5. Mobile validation improves UX; Nest repeats important validation and owns
   authorization and financial invariants.
6. Do not reproduce the backend's full DDD model in the app. Mobile models exist
   to render and edit user workflows.
7. Money crosses JSON as a minor-unit string or structured Money DTO and is
   never calculated using JavaScript floating-point `number`.

## 7. Baseline libraries

Pin exact compatible versions during scaffold creation using the selected Expo
SDK's supported versions.

| Concern | Baseline choice | Boundary |
| --- | --- | --- |
| Routing/deep links | Expo Router with typed routes | Route files remain thin |
| Server state | TanStack Query | Remote cache, invalidation, request lifecycle |
| Forms | React Hook Form plus Zod | Form UX only; backend validates again |
| HTTP | Generated TypeScript OpenAPI client | Thin runtime/auth adapter |
| Local relational data | `expo-sqlite` | Cache, migrations, drafts, outbox |
| Auth | Generated Finwise auth contract + SecureStore adapter | Identity only |
| Secrets/session | `expo-secure-store` adapter | Tokens/small secrets, not app data |
| Biometrics | `expo-local-authentication` | Local app lock only |
| Camera/receipts | Expo camera/image-picker packages | App-private staging before upload |
| Push/local notification | `expo-notifications` | Delivery is best-effort |
| Connectivity | NetInfo or an equivalent maintained signal | UX hint, not proof API is reachable |
| Crash reporting | Selected PII-scrubbed provider | No financial notes/tokens in events |

Do not add Redux, Zustand, or a second server-state framework at foundation
time. Add a global client store only when a demonstrated cross-screen state
problem cannot be expressed with TanStack Query, a small context, or local
React state.

## 8. State ownership

| State | Owner |
| --- | --- |
| Accounts, transactions, budgets, permissions | TanStack Query backed by Nest |
| Auth bootstrap/session lifecycle | One auth provider and secure adapter |
| Current workspace selection | Small app context plus persisted preference |
| Form input and modal state | Local React state / React Hook Form |
| Cached reads | SQLite repository with freshness metadata |
| Offline financial commands | Explicit SQLite outbox |
| Confirmed balance and ledger truth | NestJS/PostgreSQL only |

Do not use a persisted TanStack Query mutation cache as the financial outbox.
The outbox needs explicit schema, migrations, idempotency keys, retry classes,
and user-action states.

When switching workspace:

1. cancel in-flight workspace-scoped requests;
2. change the active scope;
3. clear or invalidate the previous workspace's query data;
4. open the correctly partitioned local cache;
5. reload membership, permissions, and visible accounts;
6. never render the previous workspace's data during the transition.

Every data-driven screen handles loading, cached/stale loading, empty, retryable
error, business error, offline, permission denied, partial visibility, and
expired-session states.

## 9. Navigation

Primary navigation:

1. Overview
2. Transactions
3. Budgets
4. Inbox

Use a prominent quick-add action rather than an `Add` information tab. Accounts,
reports, profile, and settings are secondary routes. Workspace switching is
globally reachable.

Route groups represent:

```text
bootstrap/splash
auth
authenticated app
workspace-required routes
permission-aware feature routes
modal flows: quick transaction, filters, receipt capture
```

Navigation guards improve UX only. NestJS rechecks authentication, membership,
permission, account visibility, resource scope, and business state on every
request. A deep link or notification reloads the referenced object through Nest
and handles missing, hidden, unauthorized, expired, and offline states.

## 10. API and authentication

The Nest OpenAPI document is canonical. CI generates one platform-neutral
TypeScript client usable by Next.js and React Native. Each runtime adapter
supplies:

- API base URL and environment;
- access token;
- request/correlation ID;
- idempotency key for retriable commands;
- typed error mapping;
- cancellation and timeout behavior;
- refresh/logout behavior;
- safe logging with secret and PII redaction.

With Finwise Auth:

1. React Native authenticates through the generated Finwise auth contract.
2. A mobile storage adapter persists session material using the approved secure
   storage design.
3. Mobile attaches the access token only to Nest business requests.
4. Nest validates signature, issuer, audience, expiry, and subject.
5. Nest maps `sub` to internal `UserId` and evaluates Finwise permissions.
6. Mobile never queries PostgreSQL directly for financial reads or writes.

The proposed first login method, session state machine, Nest bootstrap contract,
logout behavior, and account-deletion flow are specified in
[`AUTH-SESSION-ARCHITECTURE.md`](AUTH-SESSION-ARCHITECTURE.md).

Public URL and publishable identifiers may be compiled into the app. Service
role keys, bank credentials, signing keys, and private encryption keys must
never be present in the mobile bundle.

## 11. Controlled offline support

MVP offline scope is:

- cached reads with visible freshness/stale state;
- create manual income/expense drafts offline;
- synchronize queued drafts when the app can reach Nest;
- server alone confirms transaction, balance, budget, audit, and permissions;
- posted correction, transfer, approval, import, and reconciliation initially
  require an online server response.

This is not a second ledger on the phone.

### Draft/outbox state machine

```text
LOCAL_DRAFT -> QUEUED -> SYNCING -> SYNCED
                           |
                           +-> RETRYABLE_FAILURE -> QUEUED
                           +-> NEEDS_USER_ACTION
```

Each draft contains:

- local ID and immutable `clientCommandId`;
- user and workspace partition keys;
- account/budget identifiers and safe display snapshots;
- exact minor-unit amount as a string;
- accounting date, created/edited time, and timezone context;
- retry count and typed last-error classification;
- optional receipt local path/upload state;
- eventual server transaction ID.

Synchronization:

1. SQLite commits the draft and outbox row atomically.
2. Every retry sends the same idempotency key.
3. Nest revalidates IDs, membership, permissions, visibility, date, and amount.
4. Success links the draft to the server ID and refreshes affected queries.
5. Removed access or archived resources become `NEEDS_USER_ACTION`; the client
   never silently substitutes another account/budget.
6. Queued drafts do not change confirmed balance. UI may show a separate pending
   total.

Sync runs on foreground/resume, explicit retry, relevant network recovery, and
after successful online mutations. Background execution is an optimization
only because iOS and Android control when work runs and may stop it after the
user terminates the app.

## 12. Local persistence and security

| Data | Storage |
| --- | --- |
| Session material and small secrets | SecureStore-backed adapter |
| Cached accounts/transactions/budgets | SQLite |
| Offline command outbox | SQLite transactionally |
| Receipt awaiting upload | App-private filesystem plus SQLite metadata |
| Non-sensitive preferences | Settings store or SQLite |

Security rules:

- partition caches by authenticated user and workspace;
- clear sensitive cached data on confirmed logout;
- if unsynced drafts exist, require an explicit sync/export/discard decision;
- biometric changes can invalidate protected keys, so recovery login remains
  available;
- biometric unlock protects local app access and never authenticates a Nest
  request by itself;
- rooted/jailbroken detection may inform risk UX but is not a security boundary;
- plain SQLite is not described as encrypted merely because it is in an app
  sandbox;
- SQLCipher is a separate threat-model decision and requires a development build
  and Prebuild configuration;
- use prepared/bound SQLite statements for all user-controlled values.

## 13. Notifications, receipts, and background behavior

Remote push is registered per installation, user, app version, platform, and
environment. Nest owns device-token lifecycle and authorization.

- ask notification permission in context;
- rotate or disable tokens on refresh/logout;
- omit sensitive amounts and descriptions from lock-screen payloads by default;
- include only a safe route/resource identifier;
- reload and authorize the referenced resource after opening;
- push delivery never changes business state;
- receipt uploads use short-lived backend-authorized URLs and retain local state
  until the server confirms completion.

## 14. Environments and releases

Use dev, staging, and production profiles with distinct API/Auth/Storage
resources, bundle/application identifiers, deep-link domains, push
configuration, and crash-report environment. A staging build must never silently
connect to production.

### Pull request checks

```text
format check
ESLint
TypeScript typecheck
unit/component tests
OpenAPI generated-client freshness check
Expo configuration/prebuild validation
```

### Release candidates

- Android builds may run locally or in Linux/macOS/Windows-compatible CI.
- iOS compilation/signing requires macOS/Xcode locally or a macOS cloud runner.
- Use development/internal distribution builds before store builds.
- Test secure storage, biometrics, camera, notifications, backgrounding, deep
  links, process death, and weak networks on physical devices.
- OTA updates, if enabled, must follow a runtime-version and rollback policy;
  they must not bypass required native review or incompatible database/API
  migrations.

## 15. Testing strategy

| Test type | Scope |
| --- | --- |
| Unit | Money parsing/formatting, mappers, retry classification, state machine |
| Repository | Cache partition, migrations, remote/local priority, outbox idempotency |
| Component | Loading, empty, error, offline, denied, forms, accessibility |
| Contract | Generated TypeScript client against Nest OpenAPI and typed errors |
| Integration | Auth/deep link, workspace switch, create transaction, logout |
| Offline integration | Offline draft -> process death -> retry -> server confirmation |
| Real device | Secure storage, biometrics, camera, notifications, backgrounding |

Use Jest and React Native Testing Library at foundation. Add Maestro, Detox, or
another device automation tool only when a concrete end-to-end CI requirement
justifies its maintenance cost.

## 16. Migration from the superseded Flutter direction

The architecture decision does not authorize silent deletion. Perform a
dedicated migration task:

1. inspect Git status/history and verify whether any Flutter source or user work
   still exists;
2. preserve recoverability through Git and do not overwrite unrelated changes;
3. replace only the approved mobile target with a clean Expo TypeScript scaffold;
4. replace Flutter/Dart root scripts with pnpm/Expo scripts;
5. establish the root pnpm workspace and shared generated API client;
6. add a React Native-specific `mobile/AGENTS.md`;
7. validate Android development build and an iOS/macOS CI smoke build;
8. review the migration diff separately from the first product feature.

Historical Flutter findings remain in `progress.md`, `findings.md`, and Git
history. They are evidence of prior work, not active implementation guidance.

## 17. First delivery slice

Build one usable online vertical path before offline infrastructure:

```text
sign in -> bootstrap session -> load/create workspace -> list accounts
-> create manual income/expense -> refresh recent transactions and balances
```

Then add, in order:

1. SQLite cached reads;
2. offline transaction draft;
3. idempotent outbox synchronization;
4. biometric local app lock;
5. receipt and push capabilities when approved for MVP.

## 18. Confirmed, recommended, and remaining decisions

Confirmed:

1. React Native and TypeScript are the mobile framework/language.
2. One mobile codebase targets iOS and Android.
3. Next.js remains the web client.
4. All clients use the same NestJS API and financial rules.
5. Clients do not directly own financial truth.

Recommended pending explicit confirmation:

1. Expo with development builds and Prebuild/CNG is the implementation baseline.
2. Mobile uses feature-first organization and a generated OpenAPI client.
3. All TypeScript projects use one pnpm workspace and lockfile.

Remaining product/operations choices:

1. Confirm Expo/CNG as binding rather than recommended, or select bare React
   Native with an explicit native-maintenance reason.
2. Confirm production password recovery/MFA, rate-limit, and key-rotation
   boundaries for the custom auth service.
3. Decide whether offline drafts survive logout/user switching or require
   sync/export/discard.
4. Decide whether SQLCipher is required for the pilot threat model.
5. Confirm whether receipt capture and remote push ship in MVP.
6. Choose Android-first or simultaneous Android/iOS release.
7. Choose local macOS, managed macOS CI, or EAS for iOS builds/signing.
