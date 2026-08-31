# Shared API transport operations walkthrough — 2026-08-31

## Scope

This foundation slice expands `@finwise/api-client` with transport-only
operations shared by future web/mobile adapters: typed balance-view and manual
transaction payloads, CSV text responses, PATCH/DELETE verbs, and stable
`/v1` path construction. Business rules remain on the Nest API.

## Non-goals

- This is not a hand-claimed replacement for official `typescript-fetch`
  generation; generator wiring and deterministic generated DTO output remain
  a Phase 1 gate.
- No UI, auth provider, cache, or offline behavior is implemented here.

## Affected files and modules

- `packages/api-client/src/index.ts` — typed transport operations and response
  error mapping.
- Phase 1/index docs and this walkthrough.

## Business rules

- The client sends exact VND minor-unit strings and never calculates money.
- Financial commands can carry `Idempotency-Key` through the shared transport.
- URLs are encoded at the path-segment boundary and all requests use `/v1`.
- Non-JSON responses are only exposed through the explicit text method.

## Data flow

```text
web/mobile adapter -> @finwise/api-client -> injected fetch + token callback
                   -> Nest /v1 typed response/error envelope
```

## Public API and UI behavior

`FinwiseApiClient.getBalanceViews`, `postManualTransaction`, `getText`,
`patch`, and `delete` are available to platform adapters. No presentational UI
changed in this transport slice.

## Migration and security implications

No migration is added. The client does not persist tokens, logs request bodies,
or bypass server authorization. Production generation must preserve the same
error and idempotency headers.

## Verification

- API client Prettier check: passed.
- API client TypeScript check: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Generate DTOs/operations from `contracts/openapi.json` with official
   `typescript-fetch` and add freshness/breaking checks.
2. Replace platform-local transport adapters in web/mobile with this package.
3. Add fetch-mock contract tests for typed errors, request IDs, and CSV.

## Commit message

`feat(api-client): add shared typed transport operations`

The body should mention exact-money payloads, idempotency forwarding, and the
deferred official generator gate.
