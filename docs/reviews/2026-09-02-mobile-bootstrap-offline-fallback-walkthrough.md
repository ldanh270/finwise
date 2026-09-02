# Mobile bootstrap offline fallback walkthrough

## Scope and non-goals

This slice lets an authenticated mobile session reopen previously cached
workspace reads when the bootstrap request is temporarily unavailable. It does
not grant offline authorization, allow offline mutations, or replace the Nest
bootstrap endpoint as the source of truth.

## Affected files/modules

- `mobile/src/cache/bootstrap-cache.ts` — platform-neutral, validated cache
  boundary with injected storage.
- `mobile/src/cache/bootstrap-cache.spec.ts` — round-trip, partition, malformed
  payload, and user-identity tests.
- `mobile/src/app/providers.tsx` — loads and writes the user bootstrap snapshot,
  and exposes stale state while preserving the server response when available.
- `mobile/src/ui/app-shell.tsx` — renders a token-free offline/stale notice.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — Phase 8 status
  update.

## Business rules and data flow

`AuthProvider` restores the user session, then `WorkspaceProvider` requests
`GET /v1/session/bootstrap`. A successful response is persisted under
`finwise-cache:<encoded-user>:bootstrap`. If transport fails, the provider can
use a validated snapshot for workspace selection and cached feature reads.
Every mutation still calls the API and is rechecked by backend authorization;
the stale snapshot is never treated as proof of current membership. A user ID
inside the JSON must match the partition owner before it is accepted.

## Public API and UI behavior

No HTTP contract changed. `useWorkspace()` now exposes `bootstrapIsStale`.
When true, the app shell says that the last authorized workspace list is being
shown, offers a retry action, and asks the user to reconnect before making
changes. Existing per-workspace cached account, transaction, budget, and
overview screens retain their own stale/error indicators.

The selected workspace preference is hydrated before the provider persists a
fallback workspace, so an API response arriving before SQLite cannot overwrite
the user's last choice. A revoked or missing choice still resolves through the
latest authorized bootstrap list.

## Migration and security implications

No database migration is required. The cache is local SQLite workflow data and
is removed by the existing user-prefix logout cleanup. It contains workspace
metadata only; access/refresh tokens are not written to it. Malformed or
cross-user snapshots are ignored rather than used for routing.

## Verification

- `pnpm --filter mobile typecheck` — passed.
- `pnpm test:mobile` — 15 suites, 52 tests passed.
- `pnpm --filter mobile format:check` — passed.
- `pnpm format:check` — passed for backend, frontend, and mobile.
- `pnpm typecheck` — passed for the API client, backend, frontend, and mobile.
- `pnpm --filter mobile export:android` — passed with Hermes bytecode output.
- `pnpm --filter mobile export:ios` — passed with Hermes bytecode output.
- `pnpm contracts:check` — passed.

## Known gaps and follow-up

Cached workspace metadata can become stale while the device is offline. The
UI therefore labels the state and the backend remains authoritative for every
write. Physical-device tests must cover app restart offline, reconnect retry,
membership revocation, and logout cleanup before Phase 8 device sign-off.
