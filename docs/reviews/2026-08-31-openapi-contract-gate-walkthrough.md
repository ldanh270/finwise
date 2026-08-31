# OpenAPI contract gate walkthrough

Date: 2026-08-31
Phase: 1 — Platform foundation
Status: Implemented as a stronger contract smoke/breaking gate; official generator freshness remains open.

## Scope and non-goals

The repository OpenAPI check now validates the 3.1 document shape, required identity/ledger/planning/ingestion/reconciliation operations, unique operation IDs, and `Idempotency-Key` coverage for retriable financial commands. The snapshot also documents the opening-balance and transaction-void operations consumed by the web client.

It does not generate `contracts/openapi.json` from Nest decorators, run the official `typescript-fetch` generator, or perform a semantic diff against a prior released contract.

## Affected files and modules

- `scripts/check-openapi.mjs` — canonical route, operation ID, and idempotency assertions.
- `contracts/openapi.json` — opening-balance and void command entries.
- `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md`, the index, and this walkthrough.

## Business rules

- Every canonical route must expose an explicit operation ID so generated clients cannot silently collide.
- Opening balance, manual transaction, void/replace, import confirmation, and direct group expense commands must declare the shared idempotency parameter.
- The contract check is read-only and fails before build/test when a required command disappears or loses retry semantics.
- OpenAPI remains transport-only; domain rules stay in Nest application ports.

## Data flow

```text
contracts/openapi.json -> JSON parse -> route/method assertions
                       -> operation-id uniqueness -> idempotency coverage -> CI result
```

## Public API and UI behavior

No runtime UI behavior changed. `pnpm contracts:check` now reports the number of unique operations and idempotent financial commands checked, and fails with the missing route/operation that needs repair.

## Migration and security implications

No database migration. The check reduces accidental API compatibility drift and makes retry guarantees visible in review. It does not replace generated-client freshness, authorization tests, or secret scanning.

## Verification

- `node scripts/check-openapi.mjs`: passed (81 unique operations, 7 idempotent financial commands).
- OpenAPI JSON parse: passed.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Add Nest Swagger export and deterministic official `typescript-fetch` generation.
2. Add a baseline diff/breaking-change check against the previous release artifact.
3. Run the contract gate in CI only after clean dependency installation is reliable in the target environment.

## Phase commit message

```text
feat(platform): strengthen OpenAPI contract gate

Validate canonical operations, unique operation IDs, and idempotency-key
coverage for financial commands so transport drift fails before release checks.
```
