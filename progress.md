# Progress log

## 2026-09-02

- Added an HTTP durability barrier for the transitional PostgreSQL runtime
  snapshot adapter: every response waits for queued snapshot writes, and
  persistence failures reach the typed exception pipeline instead of being
  silently acknowledged. Normalized bounded-context Prisma repositories remain
  the production-scale follow-up.
- Replaced the web and mobile Reports placeholders with a permission-filtered
  monthly ledger projection. Posted income/expense totals, net movement, and
  immutable expense classification lines are exposed through the shared
  OpenAPI/client contract with exact VND minor-unit strings. Added explicit
  partial-access, loading, empty, validation, and retryable error states.

## 2026-09-01

- Delivered the Expo React Native online feature-parity slice across Android
  and iOS routes: custom JWT auth, workspace switching, accounts, ledger
  capture/history, budgets, Group Treasury, CSV inbox/reconciliation, export,
  settings, receipt staging, and controlled offline manual drafts.
- Added request correlation IDs, retryable-outbox recovery, structured API
  error classification, server-derived overview labels, and a blank import
  inbox default so the client never presents demo financial data as real data.
- Verified format, lint, typecheck, contracts, backend/mobile tests (24 mobile
  tests), backend/frontend build, Expo Doctor, and Android/iOS JavaScript
  exports. Physical-device/native signing remains the documented gate.
- Generated the Android CNG project and ran a native debug build with the local
  SDK/NDK; configuration and Java/Kotlin compilation advanced, but CMake hit
  Windows' 260-character path limit in the pnpm symlink tree. Removed generated
  native output; short-path or long-path-enabled Android CI is the next gate.
- Added mobile tests and both Expo platform exports to the shared GitHub CI
  quality job, plus a separate Ubuntu Android CNG/debug-APK job so native
  Android compilation is checked outside Windows path limits. Added a macOS
  iOS simulator job that runs CNG, CocoaPods, and unsigned xcodebuild.
- Normalized Expo SDK 53 peer dependencies and versions (`expo-constants`,
  `expo-linking`, Expo Router, React Native, safe-area-context, TypeScript) and
  verified Expo Doctor 18/18. Mobile formatting now declares its own Prettier
  dependency instead of relying on a hoisted root binary.
- Verified Android CNG generation again after dependency normalization. Expo
  skips iOS native generation on Windows by design; the configured macOS CI job
  remains the authoritative iOS simulator/native gate.
- Fixed Expo 53 Android autolinking for pnpm by adding a project-level
  `mobile/react-native.config.js` override and explicitly allowing the reviewed
  `unrs-resolver` postinstall in `pnpm-workspace.yaml`. With a short `C:\v`
  virtual store, `android/gradlew.bat app:assembleDebug` now passes all ABIs and
  packages a 160,705,700-byte debug APK. Generated Android output and the
  temporary virtual store are removed after validation; iOS native compilation
  still requires macOS/Xcode.

## 2026-08-30

- Continued React Native architecture discovery with the authentication/session
  boundary rather than starting the mobile scaffold.
- Added a dedicated proposal for Supabase identity, email OTP pilot login,
  concurrency-safe Nest session bootstrap, secure mobile token handling,
  single-flight refresh, deep links, logout with offline drafts, account
  deletion, typed errors, verification cases, and delivery order.
- Recorded email OTP, external identity mapping, and logout/draft handling as
  proposals rather than confirmed product decisions.

## 2026-08-29

- Product owner selected React Native and TypeScript for the shared iOS/Android
  client, superseding the Flutter direction.
- Rewrote the mobile architecture around Expo development builds, Prebuild/CNG,
  Expo Router, a feature-first application boundary, TanStack Query, SQLite
  cache/outbox, secure session storage, and controlled offline synchronization.
- Added append-only superseding decisions while preserving the earlier Flutter
  decisions and investigation as historical evidence.
- Updated the technical architecture and planning index with the proposed pnpm
  TypeScript monorepo and shared generated OpenAPI client with runtime-specific
  adapters.
- Kept source/scaffold replacement and root Flutter-script cleanup outside this
  documentation-only change; they require a dedicated migration task.

## 2026-08-28

- Used an offline Gradle build to identify the two missing Kotlin artifacts
  after the first remote build produced no useful progress output.
- Verified both artifact endpoints and resumed an online verbose Gradle build;
  it cached the initial dependencies and advanced to the Kotlin compiler graph.
- Stopped a duplicate direct download after confirming it did not improve the
  constrained Maven throughput; the primary Gradle build remains active.
- Updated the mobile architecture with the implemented foundation scope and
  the vertical-slice capabilities intentionally deferred.

## 2026-08-27

- Started phase 7 to replace the superseded Expo starter with a buildable
  Flutter iOS/Android scaffold.
- Recorded the affected architecture rules, initial API data flow, scope
  exclusions, and verification cases before implementation.
- Initial toolchain audit found no `flutter` command in PATH and no files from
  the first `mobile/` tracked-file scan; investigation continues without source
  replacement yet.
- Confirmed that `mobile/` is empty both on disk and in the current Git tree, so
  scaffold creation will not overwrite tracked Expo or user feature source.
- Confirmed through Git history that React Native was intentionally uninstalled;
  inspected root scripts and ignore rules for Flutter integration needs.
- Found JDK 21 but no Flutter/Dart/FVM/ADB tooling in PATH.
- Verified the current official Flutter creation/install direction and selected
  an explicit provisional reverse-domain organization for the scaffold.
- Installed the official Flutter stable SDK outside the repository and completed
  its Dart/CLI dependency bootstrap; retrying a stalled version check without
  remote version checking.
- Diagnosed the repeated CLI stall as Git `safe.directory` protection for the
  host-owned SDK path and stopped the stalled process safely.
- Added Git trust for only the installed Flutter SDK path and confirmed direct
  SDK Git operations now work; the CLI is currently in snapshot generation.
- Stopped the third bounded wrapper attempt because no snapshot was produced;
  moving to direct Dart snapshot diagnostics with visible output.
- Direct process-tree inspection proved the initial snapshot is waiting for an
  automatic `git fetch --tags` caused by the shallow SDK clone; allowing that
  one-time fetch/index operation to complete.
- The tag fetch failed to make reliable progress and left large temporary pack
  files; changing installation strategy to the official prebuilt SDK archive.
- Resolved the exact current stable Windows archive and official SHA-256 from
  Flutter's release manifest; stopped the clone-based bootstrap.
- Downloaded the official 3.47.1 Windows SDK archive, verified its SHA-256,
  preserved the failed clone as a temporary backup, extracted the archive, and
  confirmed the Flutter/Dart CLI versions.
- Generated the `finwise_mobile` Flutter project for Android and iOS only using
  Kotlin and Swift; dependency resolution completed successfully.
- Began inspecting generated configuration before applying the Finwise
  feature-first foundation and tests.
- Verified generated Android/iOS identifiers, nested ignore rules, and that the
  repository diff contains only planning updates plus the new `mobile/` tree.
- Added the app bootstrap, Riverpod/GoRouter shell, Material 3 theme, validated
  environment configuration, feature-first primary screens, exact VND
  formatter, and empty-state components.
- Audited native display names and Android network permission before API-ready
  platform configuration.
- Added mobile tests, Android production network permission, consistent Finwise
  display names, root Flutter scripts, pinned toolchain documentation, and
  mobile-scoped agent rules.
- Ran Dart formatter, `flutter analyze` with no issues, and `flutter test` with
  all five cases passing.
- Ran `flutter doctor -v`; located the Android SDK and determined platform 36
  plus accepted relevant licenses are the remaining Android build prerequisites.
- Installed Android platform 36 and build-tools 36.0.0 into the existing SDK and
  verified both directories before stopping a lingering silent manager process.
- Started the debug APK build; diagnosed its initial silent period as the
  one-time Gradle 9.3.1 distribution download rather than source compilation.
- Verified the Gradle distribution download/extraction completed and the active
  daemon moved into dependency resolution/compilation.
- Captured a read-only Gradle thread dump; confirmed the build is waiting on
  remote dependency network I/O rather than stuck in Finwise source compilation.

- Selected Flutter/Dart as the mobile implementation for a shared iOS and
  Android codebase; removed Expo from the target architecture.
- Confirmed that Next.js web and both Flutter mobile builds call one shared
  NestJS business API.
- Added detailed technical and Flutter mobile architecture documents, including
  OpenAPI-generated clients, authentication boundaries, offline scope, local
  storage, environments, build/release requirements, testing, and Expo source
  migration.
- Updated the decision log and implementation-plan index with the confirmed
  platform decisions.
- Started a planning-with-files audit to verify that no confirmed requirement
  remains only in the conversation.
- Replaced stale Expo-only instructions in `mobile/AGENTS.md` with the confirmed
  Flutter migration and architecture boundaries.
- Audited requirements, domain, decision, and architecture document headings
  and searched for stale active Expo guidance.
- Verified `git diff --check` passes and every relative Markdown link under
  `docs/` resolves.
- Completed the Flutter/shared-backend planning phase. Confirmed decisions are
  persisted; remaining Proposed/Open items remain visible for future sessions.

## 2026-08-26

- Reopened product discovery with the product owner.
- Confirmed personal and shared workspace isolation, soft budgets, custom
  permission-based roles, VND-only MVP, and private bank-import review by the
  connection custodian.
- Marked the existing Prisma schema as an unapproved draft pending domain and
  ledger redesign.
- Created living SRS, RDS, decision log, and implementation planning index under
  `docs/`.
- Recorded savings, lending, investment valuation, cross-workspace movement,
  and group reimbursement as proposals/open questions rather than silently
  committing them to the database design.

## 2026-08-25

- Reviewed the existing repository structure.
- Reviewed the current Finwise DBML from the conversation context.
- Created the planning files required for a multi-step implementation plan.
- Created the documentation structure under `docs/implementation-plan/`.
- No application source code or existing files were modified.
- Added separate Markdown plans for database, backend, frontend, bank sync,
  security, and QA.
- During verification, an untracked `frontend/` application directory was
  found. It was not created, edited, or deleted by this task.
- Confirmed `frontend/AGENTS.md` contains Next.js-generated guidance and kept
  that block unchanged.
- Added root `AGENTS.md` with shared SOLID, Clean Code, Clean/Hexagonal
  Architecture, design-pattern, financial-domain, testing, and delivery rules.

## 2026-09-01 — Windows dev runner cleanup

- Fixed root `pnpm dev` shutdown on Windows: `taskkill /T /F` now terminates
  nested pnpm/Next/Nest processes instead of leaving ports 3000/3001 occupied.
- Added platform-specific process-tree tests and `pnpm test:dev-runner`.
- Verified backend/frontend builds and a clean `pnpm dev` startup.

## 2026-09-01 — Mobile bootstrap readiness

- Protected Expo routes now wait for authenticated `GET /v1/session/bootstrap`
  before mounting workspace-scoped queries and caches.
- Added explicit loading, empty-workspace, retryable-error gates and four
  readiness classifier cases.
- Verified 28 mobile tests, mobile typecheck/format, Android export (976
  modules) and iOS export (979 modules).

## 2026-09-01 — Mobile inbox data states

- Inbox and reconciliation reads now show explicit loading, unavailable,
  stale-data, and retryable error states instead of misleading blank cards.
- Normalized imported rows and reconciliation checkpoints have local retry
  actions while cached account/session data remains visible with a warning.
- Verified full typecheck, format, backend/mobile/API tests, e2e, OpenAPI
  freshness, web/backend build, and Android/iOS JavaScript exports.

## 2026-09-01 — Mobile transaction account states

- Record movement now gates on account availability: loading, retryable error,
  stale cached accounts, and no-active-account states are explicit.
- Users cannot submit a movement form without a visible active account and can
  navigate directly to account management when the list is empty.
- Verified mobile typecheck and all 28 mobile tests.

## 2026-09-01 — Mobile/web parity audit

- Audited all implemented web capabilities against the Expo route tree and
  shared API client: auth, workspace switching, overview, accounts, ledger,
  budgets, Group Treasury, CSV/reconciliation, export, and settings behavior
  are covered on mobile.
- Reports and workspace administration remain intentionally absent from the
  mobile navigation because the current web sections are placeholders; wealth
  and bank beta remain future roadmap work.
- Recorded native-device and macOS iOS compilation gates explicitly in the
  parity walkthrough and implementation-plan index.

## 2026-09-01 — Mobile feature-service boundary

- Moved overview, ledger, planning, Group Treasury, and ingestion API calls
  from Expo routes into bounded-context services under `mobile/src/features`.
- Routes now compose UI/query state and navigation while preserving shared
  `/v1` paths, exact money values, stable idempotency keys, and cache behavior.
- Verified lint, typecheck, mobile tests, e2e, web/backend build, and platform
  JavaScript exports.

## 2026-09-01 — Mobile partial-access balance views

- Overview now shows an accessible permission-scoped notice when the server
  reports partial account access.
- Visible account rows now include ledger, cleared, and reconciled balances
  without deriving or exposing hidden accounts.
- Verified mobile typecheck, tests, and formatting.

## 2026-09-01 — Mobile/web surface parity

- Added the web-matching Reports placeholder to the mobile tool navigation;
  it makes the missing backend reporting contract explicit instead of showing
  fabricated metrics.
- Transaction capture now accepts and preserves a user-selected effective date
  for online commands and offline manual income/expense drafts.
- Recorded the parity boundary and remaining native/device gates in the
  walkthrough and Phase 8 plan.

## 2026-09-01 — Mobile balance/group state parity

- Overview no longer leaves the balance detail area blank while the server
  balance view is loading.
- Group direct expenses now preserve a validated user-selected effective date,
  matching the web form instead of silently using today's date.

## 2026-09-01 — Mobile inbox account prerequisite

- CSV import and reconciliation now show an explicit setup state when the
  workspace has no visible active account.
- The setup state links directly to account management instead of presenting
  unusable empty selectors.

## 2026-09-01 — Mobile Group account prerequisite

- Group claim submission and direct treasury expense posting are disabled when
  no visible active account exists.
- The UI explains the prerequisite while keeping collection and participant
  setup available.

## 2026-09-02 — Mobile ledger detail and correction

- Transactions now open server-authorized journal detail with entries,
  classification, audit history, and source evidence.
- Exact VND split validation prevents partial or floating-point classifications;
  posted income/expense/transfer corrections use an idempotent online
  reversal-and-replacement command.
- Verified root format, lint, typecheck, backend tests, OpenAPI contract,
  backend/frontend build, mobile tests, and Android/iOS JavaScript exports.

## 2026-09-02 — Mobile local-network security

- Expo CNG now scopes Android cleartext and iOS ATS exceptions to explicit
  development/local HTTP builds; preview and production projects remove them.
- Android prebuild was verified with both local-development and production
  profiles; native-config policy tests pass.

## 2026-09-02 — Dev runner port preflight

- Root `dev/start` now checks configured backend/frontend ports before spawning
  children and reports an actionable conflict with the relevant env variable.
- This prevents a stale `3000`/`3001` listener from partially starting the
  workspace and ending in an opaque backend `ELIFECYCLE` line.
- Verified the occupied-port and clean startup smokes plus five runner tests.
