# Expo SDK 54 migration walkthrough

## Scope and non-goals

This slice upgrades the Finwise mobile workspace from Expo SDK 53 to SDK 54
and keeps the existing CNG/development-build workflow usable under pnpm 11.
It includes the SDK-compatible Expo modules, React Native/React toolchain,
typed-route generation, and the file-system compatibility import required by
the existing CSV export screens.

It does not change the Nest API, OpenAPI contract, authentication protocol,
ledger rules, SQLite cache/outbox schema, offline command semantics, UI
product behavior, EAS credentials, signing, or physical-device acceptance.

## Affected files and modules

- `mobile/package.json` — pins Expo 54.0.37, Expo Router 6.0.24, React Native
  0.81.5, React 19.1, compatible Expo modules, TypeScript 5.9, and
  `metro-runtime`.
- `pnpm-lock.yaml` — resolves the SDK 54 dependency graph deterministically.
- `pnpm-workspace.yaml` — public-hoists `metro-runtime`, which Expo CLI
  resolves from its own virtual-store package path under pnpm.
- `mobile/app.json` — configures the Expo Router plugin root as `./app`.
  The repository also has `src/app` application modules, so this explicit root
  prevents SDK 54 Router discovery from selecting the non-route directory.
- `mobile/tsconfig.json` — adopts Expo's SDK 54 base config and generated typed
  route declarations.
- `mobile/app/(app)/settings.tsx` and
  `mobile/app/(app)/transactions.tsx` — use
  `expo-file-system/legacy` for the unchanged CSV file/write API surface.
- `mobile/react-native.config.js` — keeps the pnpm/Gradle Expo bridge override
  documented without an obsolete SDK-specific comment.
- `mobile/.gitignore` — ignores Expo local state and generated environment
  declarations.
- `mobile/README.md`, Phase 8 plan, `progress.md`, and the implementation-plan
  index — record the delivered migration and remaining native gates.

## Business rules and data flow

No financial or authorization rule changed. The runtime remains:

```text
Expo route -> feature service -> generated /v1 client -> Nest authorization
             |                                     |
             +-> user/workspace SQLite cache/outbox +-> PostgreSQL ledger
```

Confirmed balances and transactions remain server-owned. SecureStore remains
the only token storage boundary; the SDK upgrade does not introduce a new
storage mechanism. Offline drafts retain their existing stable
`clientCommandId` and cannot alter confirmed balances.

## Public API and UI behavior

There are no API contract changes and no endpoint changes. The generated client
continues to call the same `/v1` operations with string minor-unit amounts and
the same JWT refresh behavior. Route paths and screen responsibilities are
unchanged. CSV export still writes a local file and invokes the existing share
dialog; only the import path points at Expo FileSystem's legacy compatibility
namespace because SDK 54 moved the old convenience exports out of the root
module.

The Expo Router plugin now explicitly targets `mobile/app`, preserving the
existing route tree (`/`, `/login`, `/signup`, and the protected app group)
while allowing `mobile/src/app` to remain ordinary application code.

## Migration and rollback notes

- Reinstall from the committed root lockfile with `pnpm install`; do not mix
  npm/yarn lockfiles into the workspace.
- SDK 54 changes native runtime versions, so every development/preview client
  must be rebuilt with CNG/EAS before installing the JavaScript bundle. Do not
  reuse an Expo 53 development client against the SDK 54 bundle.
- Existing SecureStore, SQLite cache, and outbox data have no schema migration
  in this slice and must not be deleted as part of the dependency update.
- Rollback is package-level and reversible: restore `mobile/package.json`,
  `mobile/tsconfig.json`, `mobile/app.json`, the two FileSystem imports,
  `mobile/react-native.config.js`, `pnpm-workspace.yaml`, and
  `pnpm-lock.yaml` from the parent revision, then reinstall and rebuild the
  Expo 53 client. Generated `mobile/.expo` and `mobile/dist` artifacts remain
  machine-local and are not release inputs.
- Windows can verify JavaScript exports and Android CNG configuration. iOS
  native compilation/signing and physical-device checks remain the macOS/EAS
  gates already documented in Phase 8.

## Verification

The following commands passed after the migration:

- `node node_modules/expo/bin/cli install --check` — SDK 54 dependencies up to
  date.
- `pnpm dlx expo-doctor` — 18/18 checks passed.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile typecheck` — pass, including regenerated typed routes.
- `pnpm --filter mobile test` — 18 suites and 60 tests passed.
- `pnpm --filter mobile test:native-config` — 3 tests passed.
- `pnpm --filter mobile export:android` — Hermes Android bundle exported.
- `pnpm --filter mobile export:ios` — Hermes iOS bundle exported.
- `pnpm format:check` — backend, frontend, and mobile pass.
- `pnpm lint` — backend and frontend pass.
- `pnpm typecheck` — API client, backend, frontend, and mobile pass.
- `pnpm test` — 16 backend suites and 59 tests passed.
- `pnpm contracts:check` — 96 operations and 11 idempotent commands checked.
- `pnpm build` — backend and Next.js frontend production builds pass.

## Known gaps and follow-up

Physical Android/iOS device testing, process-death/offline testing on real
hardware, macOS iOS simulator compilation, EAS credentials, signing, and
store submission remain release/operations gates. The next mobile release
slice should run those gates with freshly rebuilt SDK 54 development clients;
no product feature work is implied by this dependency migration.

## Commit message

```text
chore(mobile): upgrade Expo SDK to 54

Align Expo native modules and React Native with SDK 54 while preserving the
existing CNG, API, cache, and offline draft boundaries.
```
