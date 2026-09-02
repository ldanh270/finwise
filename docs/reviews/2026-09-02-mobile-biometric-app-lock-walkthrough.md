# Mobile biometric app lock walkthrough

## Scope and non-goals

This slice adds an opt-in local biometric gate for the authenticated Expo
application. It supports Face ID, Touch ID, or enrolled device biometrics and
provides a password-login recovery path. It does not change the Nest JWT
contract, server sessions, workspace authorization, or the offline ledger
outbox. Push notifications, remote receipt unlock, and device enrollment
management remain outside this slice.

## Affected files and modules

- `mobile/src/auth/biometric-lock.ts` — native capability/authentication
  adapter and user-partitioned SecureStore preference boundary.
- `mobile/src/auth/app-lock-context.tsx` — app-lock state machine, lifecycle
  re-lock, single-flight authentication, and enable/disable actions.
- `mobile/src/ui/app-lock-gate.tsx` — loading/locked/recovery UI.
- `mobile/src/app/providers.tsx` — provider composition and bootstrap gating
  while the lock is checking or active.
- `mobile/app/(app)/_layout.tsx` — protected route gate and password recovery.
- `mobile/app/(app)/settings.tsx` — device-security control and capability
  feedback.
- `mobile/app.json`, `mobile/package.json`, and `pnpm-lock.yaml` — Expo native
  plugin, Face ID permission text, and SDK-compatible dependency.
- `mobile/src/auth/biometric-lock.spec.ts` — adapter and partition tests.

## Business rules and data flow

1. The preference key is `finwise.mobile.biometric.v1:<encoded user id>`;
   another authenticated user cannot read or enable this user's setting.
2. Enabling is refused unless hardware is available and a biometric is
   enrolled. The setting is persisted only after a successful challenge.
3. A successful challenge unlocks the protected route tree. A cancellation or
   failure keeps the tree locked and exposes a generic retry message.
4. When the authenticated app leaves the foreground, an enabled lock moves to
   `locked`; returning to the foreground starts one shared authentication
   promise so duplicate lifecycle events cannot show competing prompts.
5. “Use password instead” signs out and navigates to `/login`. It does not
   bypass the server or reveal cached workspace data.
6. Workspace bootstrap is disabled while the lock is `checking` or `locked`;
   confirmed balances and transactions remain server-owned.

The runtime flow is:

```text
Auth session -> AppLockProvider -> SecureStore preference + native capability
  -> biometric challenge -> protected route tree -> workspace bootstrap/data
```

## Public API and UI behavior

There is no server API or database migration. The local context exposes
`enabled`, `isLocked`, `capability`, `unlock`, `enable`, `disable`, and `lock`
to route composition and settings. The gate renders a checking state while
the preference is loaded, a locked state with biometric retry, and a password
recovery action. Settings reports unavailable hardware/enrollment without
pretending the feature is enabled.

## Migration and security implications

- No PostgreSQL/Prisma schema changes or migration are required.
- Only a boolean preference and its user id are stored in SecureStore; JWTs,
  refresh tokens, balances, and transaction data never enter this boundary.
- `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` keeps the
  preference device-bound and unavailable to restored backups before the first
  unlock.
- Native Face ID permission text is generated through Expo Prebuild/CNG;
  native projects are not hand-edited.
- A biometric failure never changes server session validity. Password recovery
  intentionally starts a normal login flow and therefore re-runs JWT/session
  validation.

## Verification

Passed on 2026-09-02:

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm --filter mobile typecheck`
- `pnpm --filter mobile test -- --runInBand` — 13 suites, 45 tests
- `pnpm --filter backend typecheck`
- `pnpm --filter backend build`
- `pnpm build` — backend Nest build and frontend Next build
- `pnpm dev` — backend reported `Found 0 errors. Watching for file changes`
  and frontend reached the Next ready state during a local smoke run.
- `pnpm --filter mobile prebuild -- --platform android --no-install` — Expo
  generated the Android project and registered `USE_BIOMETRIC`; Expo config
  introspection also produced the iOS `NSFaceIDUsageDescription` entry.

Native physical-device and iOS signing checks remain release gates because they
require an Expo development build, enrolled biometric hardware, and macOS/iOS
tooling.

## Known gaps and follow-up

- Add component-level tests around the native prompt and app-state transitions
  once a React Native test renderer/device harness is available.
- Verify Android emulator biometric enrollment and Face ID/Touch ID behavior on
  physical iOS and Android development builds.
- Decide whether an enterprise policy should force-enable, disable, or remote
  revoke local app lock; MVP keeps the choice local and user-controlled.

## Commit message

```text
feat(mobile): add biometric app lock

Protect authenticated app screens with an opt-in Face ID, Touch ID, or device
biometric gate backed by per-user SecureStore preferences; password recovery
and server JWT/session behavior remain available.
```
