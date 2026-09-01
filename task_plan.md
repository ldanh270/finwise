# Finwise implementation task plan

> This file tracks planning work and points to the detailed product and
> architecture documents. `docs/implementation-plan/README.md` and its linked
> SRS, RDS, domain specifications, architecture documents, and decision log are
> the implementation source of truth.

## Goal

Maintain a persistent, implementation-oriented product and technical planning
set for Finwise. Confirmed requirements and architecture decisions must survive
context loss and be readable by an agent or developer who did not join the
product discussions.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1. Context and assumptions | complete | Review the current DBML and define MVP business assumptions |
| 2. Documentation structure | complete | Create `docs/implementation-plan/` with separate workstream documents |
| 3. Implementation details | complete | Document DB, BE, FE, bank-sync, security, and QA tasks |
| 4. Verification | complete | Check that files exist, links are consistent, and the plan has a clear execution order |
| 5. Repository engineering rules | complete | Add shared SOLID, Clean Code, architecture, design-pattern, and verification rules |
| 6. Flutter and shared-backend architecture | superseded | Historical Flutter decision; platform-neutral backend, API, security, and offline boundaries remain valid |
| 7. Flutter source scaffold migration | superseded | Historical investigation stopped as active direction when React Native was selected |
| 8. React Native architecture supersession | complete | Confirm React Native/TypeScript; record Expo/CNG, pnpm consolidation, authentication/session, and offline behavior as proposals; retain NestJS as the single business boundary |
| 9. React Native source migration | complete (native sign-off pending) | Expo TypeScript app, shared API transport, online web-parity routes, SecureStore sessions, SQLite cache/outbox, and Android/iOS JS exports; physical development-build verification remains an operations gate |

## Next step

Review the remaining native release gates in
`docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md`: run development
builds on physical Android and iOS devices, verify process death/weak network,
let the Ubuntu Android and macOS iOS native jobs run, and establish signing
profiles in CI. Do not treat JavaScript export success as native-device
sign-off.

## Phase 7 historical implementation notes

> Superseded on 2026-08-29 by the React Native decision. Retained as historical
> evidence only; do not use this section as current implementation guidance.

## Phase 8 architecture notes

### Business and architecture rules preserved

- React Native targets iOS and Android from one TypeScript codebase; React Native
  Web is excluded because Next.js remains the web client.
- NestJS remains the only business, authorization, and confirmed-financial-state
  boundary.
- Mobile consumes a generated OpenAPI client and never imports Prisma or backend
  domain entities.
- Exact financial amounts cross JSON as strings/structured Money DTOs and are
  never calculated with JavaScript floating point.
- Offline writes are explicit drafts/outbox commands with stable idempotency;
  they never mutate confirmed balance before Nest accepts them.

### Data flow

```text
Expo Router route -> feature screen -> hook/controller -> repository
-> generated Nest client and/or SQLite -> query/immutable UI state
```

### Documentation verification cases

- Flutter remains only in explicitly historical or superseded sections;
- the mobile and technical architecture documents agree on React Native, Expo,
  pnpm, the generated TypeScript client, and NestJS boundaries;
- Markdown links resolve and the diff contains no mobile scaffold/source change;
- unrelated user changes remain preserved.

## Phase 7 historical details

### Business and architecture rules affected

- Flutter is the only mobile target and must produce Android and iOS projects
  from one Dart source tree; Flutter Web is excluded.
- Mobile is an API client. NestJS remains the single business, authorization,
  and financial-truth boundary.
- The scaffold must not invent unresolved auth, offline, push, receipt, or
  financial-domain behavior.
- Dart `double` must not be introduced for money; future financial values cross
  the API as exact strings/minor units.

### Initial data flow

```text
Flutter widget -> presentation controller/provider -> repository contract
-> generated/adapted NestJS API client -> NestJS /v1
```

The foundation screen may use local static state only until the first backend
vertical slice and OpenAPI contract exist.

### Verification cases

- no active Expo/React Native dependency or instruction remains under `mobile/`;
- `flutter pub get`, formatting check, static analysis, and unit/widget tests pass;
- Android debug build succeeds when the Android toolchain is available;
- iOS project files are generated even though compilation requires macOS;
- package/application identifiers and flavor placeholders are documented;
- repository diff preserves unrelated user changes.

## Errors encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `apply_patch` rejected delete-and-add operations for the same `mobile/AGENTS.md` path | 1 | Replaced the file content with one update operation instead |
| Completion patch expected a stale Goal paragraph after the plan had already been refreshed | 1 | Re-read `task_plan.md` and applied only the still-missing log updates |
| `rg --files mobile` returned no files | 1 | Treat as an audit signal; inspect the directory and Git tree before deciding whether any Expo source must be preserved |
| `flutter --version` failed because `flutter` is not in PATH | 1 | Search common/local SDK locations and configured workspace dependencies; install or request SDK setup only if no existing toolchain is available |
| Common-location Flutter SDK search did not return a completed result within the bounded command window | 1 | Stop the broad recursive search; use targeted command/package checks and an official SDK installation path |
| Flutter's first `--version` bootstrap downloaded Dart and built the CLI but then stalled in idle Git subprocesses | 1 | Interrupted the non-destructive version check and retry with `--no-version-check` using the initialized SDK |
| `Get-CimInstance Win32_Process` returned access denied while diagnosing the stall | 1 | Used non-privileged `Get-Process` instead and confirmed idle Dart/Git subprocesses |
| Retried Flutter with `--no-version-check` but it stalled at the same point | 2 | Diagnosed SDK Git commands directly instead of repeating the bootstrap |
| SDK Git commands reported `dubious ownership` between the host user and Codex sandbox user | 1 | Add this exact official SDK path to Git `safe.directory`, then retry Flutter once |
| One `write_stdin` diagnostic call had malformed JavaScript input | 1 | Corrected the object syntax on the next poll; no process or file state was affected |
| Flutter still did not emit `flutter_tools.snapshot` after Git trust was fixed | 3 | Stop retrying the wrapper; invoke the documented internal Dart snapshot command directly with visible output to isolate snapshot compilation |
| Shallow-clone tag fetch repeatedly downloaded large temporary packs and did not complete | 1 | Stop the Git-based SDK bootstrap and switch to Flutter's official prebuilt Windows SDK archive, which does not need repository history |
| Source patch tried to delete and add `mobile/lib/main.dart` in one operation | 1 | No source was changed; switched to an in-place update and separate add operations |
| Documentation patch tried to delete and add `mobile/README.md` in one operation | 1 | No changes from that patch were applied; split README replacement into its own patch |
| Android `sdkmanager` stayed silent after installing requested packages | 1 | Verified platform 36/build-tools 36 exist with current timestamps, then interrupted only the lingering manager process |
| First `jcmd` invocation did not quote the JDK path containing spaces | 1 | Re-ran with PowerShell's call operator and a literal quoted executable path |
| First online APK build stayed silent while resolving remote Gradle dependencies | 1 | Interrupted after a bounded wait and used `assembleDebug --offline` to identify the exact missing artifacts |
| Offline Gradle build could not resolve two uncached Kotlin JARs | 1 | Confirmed both Maven Central endpoints, then resumed one visible online Gradle build to populate the cache and build the APK |
| A parallel direct `curl` download of the large Kotlin compiler artifact did not improve throughput | 1 | Stopped only the duplicate transfer and kept the primary Gradle build running with its resumable cache state |
