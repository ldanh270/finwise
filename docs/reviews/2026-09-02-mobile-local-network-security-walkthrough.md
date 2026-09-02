# Mobile local-network security walkthrough

## Scope and non-goals

The Expo CNG configuration now permits a local HTTP API only for an explicitly
development-scoped build. This keeps the Android emulator bridge and iOS
simulator/LAN development path usable while removing cleartext/ATS exceptions
from preview and production native projects. It does not provision TLS, change
the API client, weaken JWT validation, or allow HTTP in release builds.

## Affected files and modules

- `mobile/plugins/with-finwise-network-security.cjs` — Android manifest and
  iOS Info.plist config plugin.
- `mobile/plugins/with-finwise-network-security.test.cjs` — environment policy
  tests.
- `mobile/app.json` — registers the CNG plugin.
- `mobile/.env.example` — documents the local-only switch.
- `mobile/package.json` — adds the native-config test command.
- `package.json` — includes the native-config test in `test:mobile`.
- `mobile/README.md` — documents local HTTP and release HTTPS requirements.
- `.github/workflows/ci.yml` — runs the native-config policy test.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — records the
  delivered native networking boundary.
- `docs/implementation-plan/README.md` — links this walkthrough.
- `progress.md` — records CNG verification.

## Business rules and data flow

The build environment is the only input to the policy:

```text
FINWISE_ALLOW_HTTP=true (outside release profiles) or EAS development
  -> Android usesCleartextTraffic=true
  -> iOS NSAllowsArbitraryLoads=true

preview/production (even if the local switch is accidentally present)/unspecified
  -> no cleartext/ATS exception
```

The plugin is applied during Expo Prebuild/CNG, never at runtime. Production
API endpoints therefore remain HTTPS-only and the mobile client still uses the
same JWT/SecureStore authorization boundary.

## Public API and UI behavior

No HTTP API or product UI contract changes. Local development builds can reach
the documented `http://10.0.2.2:3001`, LAN, or simulator localhost endpoint;
preview/production builds fail closed at the native transport layer if given a
cleartext URL.

## Migration and security implications

No database migration. The development exception is opt-in and build-scoped;
the plugin removes its own Android/iOS exception on non-development prebuilds.
Secrets and tokens are unaffected and remain in SecureStore only.

## Verification

- `pnpm --filter mobile test:native-config` — passed.
- Android CNG prebuild with `FINWISE_ALLOW_HTTP=true` — passed; generated
  manifest contained `android:usesCleartextTraffic="true"`.
- Android CNG prebuild with `EAS_BUILD_PROFILE=production` — passed; generated
  manifest reported `usesCleartextTraffic absent`.
- `pnpm typecheck:mobile` and mobile Jest suite — previously passed; this slice
  contains no TypeScript/runtime feature changes.
- Windows iOS CNG generation — intentionally skipped by Expo; macOS CI remains
  the authoritative iOS project/ATS verification environment.

## Known gaps and follow-up

- Physical Android/iOS network tests still require development builds on real
  devices, including a reachable LAN API and TLS validation for release lanes.
- A future release pipeline should assert that EAS preview/production envs do
  not set `FINWISE_ALLOW_HTTP` and that their API URL uses HTTPS.

## Commit message

```text
fix(mobile): scope local HTTP to development builds

Configure Android cleartext and iOS ATS exceptions only for explicit local or
development builds so emulator/simulator login works without weakening release
transport security.
```
