# Mobile EAS build profiles walkthrough

## Scope and non-goals

This slice adds checked-in EAS build lanes for the Expo iOS/Android app:
development, preview, and production. It does not create an EAS project,
store credentials, sign certificates, publish binaries, or change runtime
feature behavior.

## Affected files/modules

- `mobile/eas.json` — EAS CLI version floor and three platform-independent
  build profiles.
- `mobile/README.md` — local/CI commands and ownership boundary for credentials.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — Phase 8
  release-readiness update.

## Business rules and data flow

The app still consumes the Nest `/v1` API and keeps JWTs in SecureStore. EAS
only packages the existing Expo/CNG app; it does not become a data or auth
boundary. The development profile produces an internal development client,
preview produces an internal QA artifact, and production enables build-version
incrementing. No profile changes cache, outbox, ledger, or workspace policy.

## Public API and UI behavior

No API endpoints, DTOs, navigation routes, or UI screens changed. Existing
runtime configuration (`EXPO_PUBLIC_FINWISE_API_URL`) remains the source of the
reachable backend URL for each build environment.

## Migration and security implications

No database migration is required. Signing credentials, EAS project IDs,
Apple/Google credentials, and environment values must be supplied by the
deployment owner through EAS secrets or CI; none are stored in the repository.
The production profile's auto-increment prevents accidental version reuse but
does not replace store release approval.

## Verification

- `pnpm --filter mobile typecheck` — passed.
- `pnpm test:mobile` — 14 suites, 48 tests passed.
- `pnpm --filter mobile export:android` — passed.
- `pnpm --filter mobile export:ios` — passed.
- `pnpm format:check` — passed for backend, frontend, and mobile.

The `eas` executable itself was not invoked locally because this Windows
workspace has no configured EAS project or signing credentials.

## Known gaps and follow-up

Native Android assembly, iOS simulator compilation, and physical-device
verification remain CI/macOS/operations gates. The deployment owner must run
`eas init`, configure environment-specific API URLs and credentials, then
execute the development profile on both platforms before marking Phase 8
device sign-off complete.
