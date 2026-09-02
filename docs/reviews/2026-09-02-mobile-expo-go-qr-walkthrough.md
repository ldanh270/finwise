# Mobile Expo Go QR smoke-test walkthrough

Date: 2026-09-02  
Scope: make the phone smoke-test entry point explicit when a terminal QR is
reported as “No usable data found”.

## Scope and non-goals

This slice adds explicit Expo Go LAN/offline commands and documents the QR and
network prerequisites. It does not replace the development-build runtime,
change native configuration, modify API contracts, or make Expo Go a release
verification environment.

## Affected files and modules

- `mobile/package.json`: `start:go` and `start:go:offline` scripts.
- root `package.json`: `dev:mobile:go` and `dev:mobile:go:offline` aliases.
- `mobile/README.md` and root `README.md`: QR, Wi-Fi, API URL, and runtime
  guidance.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md`: confirmed
  smoke-test boundary.

## Business rules and data flow

The QR contains only the Metro development URL. It does not contain an API
token, account data, or database connection. The expected flow is:

```text
Expo CLI --go --lan [or --offline]
  -> terminal QR: exp://<computer-LAN-IP>:<metro-port>
  -> Expo Go on same Wi-Fi
  -> JavaScript bundle from Metro
  -> API requests to EXPO_PUBLIC_FINWISE_API_URL
```

The full QR must be visible to the scanner. A cropped terminal screenshot,
small/blurred QR, or a phone on another network can produce a generic scanner
message even when the Expo project is healthy.

## Public command and UI behavior

```text
pnpm dev:mobile:go           # Expo Go + LAN
pnpm dev:mobile:go:offline   # Expo Go + LAN without CLI metadata requests
pnpm dev:mobile              # installed development build (default)
```

Expo Go remains a smoke-test path. Native features such as custom network
security and development-client behavior still require a development build.

## Migration and security implications

No server, schema, or migration changes. Expo CLI's offline flag only disables
remote metadata checks; it does not disable the phone's LAN connection. The QR
does not expose Finwise credentials. `mobile/.env` must use a reachable LAN API
URL and must never contain tokens or private keys.

## Verification

- `expo start --help` confirms `--go`, `--lan`, and `--offline` are supported by
  the installed Expo CLI 54.
- `expo start --go --offline --port 8091` rendered a complete QR and
  `exp://192.168.1.9:8091` Metro URL.
- Mobile package JSON and root scripts parse successfully.
- No API, native plugin, or financial-domain tests were changed.

## Known gaps and follow-up

- Physical-device scanning and API reachability still require a phone on the
  developer LAN and Windows firewall access to the Metro/API ports.
- Expo Go cannot verify every custom native dependency; keep Android/iOS
  development-build and signed-release gates in Phase 8.
- Add a short screen-recorded onboarding example if first-time testers still
  confuse the terminal QR with a screenshot or browser URL.
