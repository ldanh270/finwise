# Mobile emulator API URL walkthrough — 2026-09-01

## Scope and non-goals

This slice fixes local Android emulator connectivity when the API URL is not
provided explicitly. The resolver uses the Android host bridge address while
retaining an explicit URL for physical devices, LAN testing, staging, and
production. It does not change authentication, API routes, token storage, or
server-side networking.

## Affected files and modules

- `mobile/src/config/runtime-url.ts` — framework-independent runtime URL
  resolution boundary.
- `mobile/src/config/runtime-url.spec.ts` — resolver unit coverage.
- `mobile/src/auth/auth-context.tsx` — uses the resolver when constructing the
  shared API client.
- `mobile/README.md` — documents emulator versus physical-device setup.
- Phase 8 plan and implementation-plan index — records the delivery slice.

## Business rules and data flow

```text
EXPO_PUBLIC_FINWISE_API_URL / provider URL
  -> normalize configured host
  -> if absent: Android emulator 10.0.2.2, otherwise localhost
  -> FinwiseApiClient base URL
  -> auth, bootstrap, and protected mobile feature requests
```

An explicit URL always wins. This is required for a physical device, where the
developer machine must be addressed through its LAN IP or a deployed API host.
The fallback is only a local-runtime convenience and never changes the server
authority or workspace scoping rules.

## Public API and UI behavior

No HTTP endpoint, request payload, OpenAPI contract, or UI route changed. The
mobile auth provider now constructs its client with a platform-aware default,
so Android emulator sign-in/bootstrap requests reach a backend on the host
machine without requiring a local `.env` override. Login and all subsequent
feature screens retain their existing behavior.

## Schema, migration, and security implications

No database or migration changes. The resolver handles only a non-secret host
configuration value; access and refresh tokens still use the existing
SecureStore adapter and never enter the resolver, logs, or route state. Teams
must continue to set an explicit LAN/staging URL for physical-device and
production builds.

## Verification

- `pnpm --filter mobile test -- --runInBand` — pass (8 suites, 31 tests).
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm --filter mobile export:android` — pass (Expo JavaScript bundle).
- `pnpm --filter mobile export:ios` — pass (Expo JavaScript bundle).

Native Android/iOS compilation and physical-device network verification remain
Phase 8 release gates; this slice only removes the incorrect Android emulator
default.

## Known gaps and follow-up

- Physical devices still require `EXPO_PUBLIC_FINWISE_API_URL` to be set to a
  reachable LAN or deployed API URL.
- Native development-build and process-death checks require the documented
  Android SDK and macOS/iOS signing environments.

## Commit message

```text
fix(mobile): route Android emulator traffic to host API

Keep explicit API URLs for devices while using the Android emulator host
bridge by default, and cover runtime URL resolution with unit tests.
```
