# Findings

## 2026-08-30 authentication/session proposal

- Email OTP is the smallest coherent pilot login surface across Next.js and
  React Native, but Supabase's built-in email sender is not a production
  dependency; custom SMTP, domain authentication, rate limits, and abuse
  controls are release requirements if this proposal is confirmed.
- Adding Google alone creates an incomplete iOS launch plan. Google and Apple
  should enter one delivery slice if social login is approved, subject to the
  current App Store login-service rules.
- Provider subject plus issuer is the durable external identity key. Email must
  remain a mutable snapshot and must never be used to auto-merge identities.
- A small Nest bootstrap use case separates provider authentication from
  internal user provisioning and workspace authorization and must be safe under
  concurrent first requests.
- Token refresh may replay a financial command only with the original body and
  idempotency key; `403` is an authorization result and must not cause a refresh
  loop.
- Logout is data lifecycle. Queued financial drafts require an explicit
  sync/export/discard decision before session/cache cleanup.

## 2026-08-29 React Native architecture supersession

- React Native/TypeScript is now the confirmed mobile platform; Flutter entries
  from 2026-08-27 and 2026-08-28 are historical rather than active guidance.
- The repository currently has no `mobile/` directory in the working tree even
  though uncommitted planning/root-script changes record prior Flutter scaffold
  work. A future migration must inspect Git state again and must not assume there
  is Flutter source to delete.
- Expo development builds with Prebuild/CNG provide the recommended balance for
  Finwise native capabilities. Expo Go is insufficient as the primary runtime
  for the planned secure storage, biometric, notification, and optional
  SQLCipher configuration.
- Moving mobile back to TypeScript allows one generated, platform-neutral
  OpenAPI client to serve Next.js and React Native. Runtime authentication,
  fetch, storage, UI, and navigation adapters must remain separate.
- TanStack Query owns remote server state, while an explicit SQLite schema owns
  cached reads and the financial command outbox. Persisted query mutations are
  not the auditable/idempotent outbox.
- Background execution is opportunistic; reliable sync also runs on foreground,
  resume, explicit retry, and relevant connectivity recovery.
- The architecture skill reinforced repository/adapter boundaries without
  copying the backend's full DDD model into the client.

## 2026-08-28 Android build verification

- The offline Gradle diagnostic isolated the cold-cache gap to
  `kotlin-reflect:2.2.21` and the Gradle 8.5 variant of
  `kotlin-gradle-plugin:2.0.0`; this is an environment dependency issue, not a
  Finwise Dart or Android source error.
- Both required artifacts are available from Maven Central. The visible online
  build successfully cached those initial JARs and advanced into the remaining
  Kotlin compiler dependency graph.
- Maven transfer throughput is unusually low in this host environment. A
  direct parallel `curl` transfer was also slow, so keeping one Gradle transfer
  avoids duplicate bandwidth and preserves Gradle's cache metadata.
- The implementation plan now records the exact foundation delivered and keeps
  OpenAPI/auth, flavors, offline persistence, secure storage, push, receipts,
  and production identifiers explicitly deferred rather than half-configured.

## 2026-08-27 Flutter scaffold migration

- The approved mobile plan explicitly authorizes replacing the superseded Expo
  starter through a dedicated, reviewable migration after auditing user work.
- This scaffold phase should establish platform projects and clean application
  boundaries only. Supabase Auth, Drift offline outbox, push, receipts, and
  generated OpenAPI code remain later slices because their contracts or product
  choices are not yet approved/available.
- The acceptance checks are Flutter dependency resolution, format, analysis,
  tests, Android debug build where the local toolchain permits it, generated iOS
  project presence, and absence of active Expo dependencies.
- The `flutter` executable is not currently available through PATH.
- The first tracked-file scan returned no files under `mobile/`; directory and
  Git-tree inspection are required before concluding that the Expo starter has
  already been removed.
- `mobile/` exists but is empty, and `git ls-tree HEAD -- mobile` contains no
  tracked files. There is therefore no Expo implementation or user feature code
  to migrate/preserve in the current Git state.
- A broad search of several common Flutter SDK locations did not produce a
  usable SDK result within the bounded command window. Use targeted checks and
  the official Windows installation path instead of repeating the scan.
- Targeted tool checks found JDK 21 but no Flutter, Dart, FVM, or Android `adb`
  executable in PATH. Both Flutter SDK and an Android SDK/toolchain may need
  installation/configuration before an Android build can pass.
- Git history confirms the previous mobile source was intentionally removed by
  commit `b159b5e` (`chore: uninstall react native source`) after its initial
  scaffold commit. The empty directory is expected, not an accidental loss.
- Root `package.json` currently orchestrates only backend/frontend. Flutter
  format/analyze/test/build scripts should be added without making Dart pub a
  pnpm-managed dependency workspace.
- Root `.gitignore` has Node/Next/Prisma rules but no Flutter/Dart/Android/iOS
  generated-artifact rules yet.
- Current official Flutter documentation reflects the 3.44 stable generation,
  recommends the stable channel for production work, and uses `flutter create`
  with an organization in reverse-domain notation to generate application and
  bundle identifiers.
- Because Finwise has no approved owned-domain identifier yet, the scaffold will
  use the explicit provisional organization `com.finwise`, producing
  `com.finwise.finwise_mobile`; it must be confirmed/renamed before store setup.
- Flutter stable was cloned successfully to
  `C:\Users\ducan\development\flutter`. Its first invocation downloaded and
  expanded Dart and resolved the Flutter tool dependencies, but the final
  version check stalled in idle Git subprocesses and was safely interrupted.
- Root cause of the Flutter CLI stall is Git's safe-directory ownership guard:
  the SDK was installed as the host user while commands execute through the
  Codex sandbox identity. Flutter repeatedly invokes Git to derive its version.
  Trusting only the exact official SDK path is required; broad/global wildcard
  trust would be inappropriate.
- Exact-path Git trust now works and direct SDK Git commands complete. Flutter's
  Windows bootstrap has progressed to its app-JIT snapshot-generation step,
  which suppresses command output; continued diagnosis must distinguish a slow
  first snapshot from another stalled child process.
- Generated SDK metadata identifies the installed stable release as Flutter
  3.47.1 with Dart 3.13.1. This is newer than the search index snapshot and is
  the authoritative local toolchain version.
- The wrapper failed to produce `flutter_tools.snapshot` after three bounded
  attempts. Flutter's batch file hides snapshot stdout, so the next diagnostic
  is the equivalent Dart snapshot command with visible output—not another CLI
  retry.
- Official Flutter issue history confirms Windows bootstrap can appear stuck
  immediately after `Got dependencies`, but the indexed cases have different
  causes and do not justify copying an unrelated workaround blindly.
- Elevated process inspection identified the exact long-running child command:
  Flutter 3.47.1 runs `git fetch --tags` for the shallow stable clone while
  creating its first tool snapshot. `git-remote-https` and `git index-pack` are
  present, so the current attempt is downloading/indexing tag metadata rather
  than deadlocked.
- The shallow clone accumulated several interrupted temporary Git packs
  (roughly 84-186 MB each), while the current fetch stopped growing. Continuing
  this installation method is wasteful; Flutter's official prebuilt Windows SDK
  archive is the safer deterministic fallback and needs no Git history fetch.
- Flutter's official Windows release manifest identifies 3.47.1 as current
  stable and publishes `stable/windows/flutter_windows_3.47.1-stable.zip` with
  SHA-256 `4cbf94fde1f5f8d6b9fc50b2483b57cf2077f61712282c2f4cf92560168f442b`.
  The archive and hash will be verified before it replaces the clone.
- The official archive hash matched exactly and its CLI initialized
  successfully: Flutter 3.47.1 stable, Dart 3.13.1, DevTools 2.60.0. The failed
  Git clone remains a temporary backup until scaffold verification completes.
- `flutter create --empty` generated 74 Android/iOS files successfully with
  Kotlin/Swift platform code, project version `0.1.0+1`, Dart SDK constraint
  `^3.13.1`, and no web/desktop platform folders.
- The empty template contains only `lib/main.dart`, Flutter itself, and
  `flutter_lints`; it deliberately has no test. The application shell,
  feature-first directories, tests, and mobile agent instructions must now be
  added explicitly.
- Flutter 3.47.1 warns that `--ios-language` is deprecated because Swift is now
  always used. The scaffold still succeeded; future scripts should omit that
  flag.
- Generated development identifiers are
  `com.finwise.finwise_mobile` (Android) and `com.finwise.finwiseMobile` (iOS).
  They remain provisional and must be replaced with an owned reverse-domain ID
  before Play/App Store configuration.
- The generated nested `.gitignore` already covers Dart/Flutter build, cache,
  coverage, Android debug/profile/release output, and iOS last-build artifacts;
  duplicating those rules at repository root is unnecessary.
- The first runnable shell needs only `go_router` and `flutter_riverpod` from the
  approved baseline. Dio/OpenAPI, Drift, Supabase, secure storage, push, camera,
  and biometrics should not be installed until their vertical slices exist.
- The generated Android release manifest has the template label and no main
  `INTERNET` permission (debug/profile manifests add it only for tooling). The
  production API client requires the permission in the main manifest.
- iOS currently displays `Finwise Mobile`; both platforms should use the
  product-facing name `Finwise` while package identifiers remain provisional.
- The foundation compiles cleanly under Flutter analysis. Five unit/widget test
  cases pass across API URL validation, exact VND formatting, four-tab
  navigation, and the workspace-required quick-entry guard.
- Flutter doctor found an existing Android SDK at
  `C:\Users\ducan\AppData\Local\Android\sdk` with platform 34 and build tools
  34/35. Flutter 3.47.1 requires Android platform 36; SDK 36 must be installed
  side-by-side before the debug build can succeed.
- Flutter/Dart are intentionally invoked by absolute path in this task and are
  not yet in the user's PATH. The mobile README records the recommended PATH
  setup. Windows desktop tooling is irrelevant because this project generates
  only Android/iOS targets.
- Android platform 36 and build-tools 36.0.0 were installed successfully
  side-by-side. `sdkmanager` did not exit after the files appeared, so its
  lingering process was interrupted only after filesystem verification.
- The first APK build is not hung in compilation: Gradle wrapper is downloading
  its pinned `gradle-9.3.1-all` distribution into the user Gradle cache. No APK
  output is expected until that one-time cold download/extraction completes.
- The Gradle 9.3.1 distribution finished, passed the wrapper marker check, and
  extracted. The Gradle daemon is now actively consuming CPU/memory, indicating
  dependency resolution/compilation is progressing.
- A read-only thread dump shows the Gradle worker blocked in Java NIO socket
  polling while other build-operation workers are idle. The remaining delay is
  remote Maven/Google dependency I/O, not a Dart/source compile loop or file
  lock. Allow the configured network timeout to produce an actionable result.

## 2026-08-27 architecture planning state

- The current documentation set contains SRS, RDS, six bounded-context/domain
  analyses, a decision log, a technical architecture, and a dedicated mobile
  architecture.
- Flutter is now the target mobile stack for both iOS and Android; the existing
  Expo starter is superseded and requires a dedicated source migration.
- Next.js web, Flutter iOS, and Flutter Android use the same NestJS business API.
  Financial tables are not a direct client-facing API.
- OpenAPI is the canonical transport contract and generates separate TypeScript
  and Dart clients.
- Android release builds can run on Windows, Linux, or macOS with the Android
  toolchain. iOS release builds require macOS, Xcode, Apple signing, and an
  Apple Developer account for TestFlight/App Store distribution.
- The root planning-memory files had not yet recorded the 2026-08-27 technical
  architecture decisions and must be synchronized before this planning phase
  is considered complete.
- `mobile/AGENTS.md` still contained Expo-only guidance after the Flutter
  decision. It was replaced with Flutter migration, shared-Nest-API, security,
  offline, money, and verification guardrails so future agents cannot extend
  the superseded starter accidentally.
- The persistence audit found no confirmed Flutter/shared-backend decision that
  exists only in conversation. The only remaining Expo proposal in the docs is
  explicitly marked superseded to preserve decision history.
- Requirements discovery is intentionally not globally complete: unresolved
  product and infrastructure choices remain recorded as Proposed/Open. They are
  not missing documentation and must not be silently treated as confirmed.

> **Historical context only.** The assumptions below predate the product
> discovery recorded on 2026-08-26 and must not be treated as current
> requirements. See `docs/requirements/SRS.md`, `docs/requirements/RDS.md`, and
> `docs/decisions/DECISION-LOG.md`.

## Repository

- The repository currently contains only `README.md` and `LICENSE`.
- No existing frontend, backend, migration, or test structure was found.
- The implementation plan can therefore define the initial project layout.

## Current DBML risks

- IDs are mixed between UUID and unconstrained `varchar`.
- PostgreSQL `timestamp` is used instead of `timestamptz`.
- `workspace_id` is duplicated on domain rows but is not enforced together with
  the referenced fund/category IDs.
- Transfer invariants are documented in notes but not enforced with database
  constraints.
- One `bank_connection` is currently limited to one fund, which does not model
  providers that expose multiple bank accounts from one connection.
- `fund_balances` is a cache and must not become the financial source of truth.
- Workspace membership does not track invitation or active/removed state.
- Transactions do not record who created or changed them.

## MVP assumptions used in the plan

- A workspace is a shared money group such as a family or small team.
- Active workspace members can view all funds in that workspace.
- The MVP has one owner per workspace.
- Each fund has one currency; transfers must use the same currency.
- Amounts are stored as positive values. Transaction type determines whether
  money is added or removed.
- A transfer uses one transaction row with source and destination funds in the
  MVP. A full double-entry ledger can be added later if required.
- Bank data is first stored as provider data, then mapped to internal
  transactions.
- Expense splitting and member settlement are postponed until after the core
  ledger and bank sync are stable.
