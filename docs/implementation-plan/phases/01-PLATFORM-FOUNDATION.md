# Phase 1 — Platform foundation

Status: In progress — runtime primitives and contract snapshot landed; generator/CI gate pending  
Depends on: [Phase 0](00-ROADMAP-AND-DECISIONS.md)  
Unblocks: identity, ledger, and all feature modules

## Objective

Make the monorepo, runtime boundaries, contracts, and shared primitives safe
for vertical feature delivery without implementing financial features yet.

## Business rules

- Keep one root pnpm workspace/lockfile for `backend`, `frontend`, `mobile`
  (when scaffolded), `packages`, and `contracts`; do not add Nx/Turborepo.
- NestJS is the only business API. Next.js and mobile never query PostgreSQL or
  the Supabase Data API for financial data.
- Domain/application modules may depend only on ports and shared primitives;
  Prisma, NestJS, Supabase SDKs, HTTP DTOs, and UI types stay at the edges.
- All API responses use typed errors `{ code, message, details?, requestId }`.
- Money is exact: `Money { currency: VND, minorUnits: bigint }` internally and
  string/structured DTOs over JSON. No financial calculation uses JS `number`.

## Data flow

```text
HTTP client -> Nest validation/auth middleware -> use case port
            -> domain invariant -> Prisma adapter/unit of work
            -> audit/outbox + response mapper -> OpenAPI client
```

Create a request/correlation ID at the API boundary. Health checks expose
process liveness separately from readiness of PostgreSQL and required config.

## Schema and API surface

Create shared types/ports for typed IDs, `Money`, `Clock`, `UnitOfWork`,
`IdempotencyStore`, `AuditWriter`, `OutboxWriter`, `IdentityVerifier`, and typed
public errors. Add initial infrastructure tables only when needed by a feature;
foundation owns migration metadata, request audit conventions, and idempotency
shape, not business aggregates.

Canonical transport rules:

- base path `/v1`;
- ISO timestamps with timezone and date-only accounting fields;
- cursor pagination for transaction/import/audit lists;
- `Idempotency-Key` on retriable financial commands and stable command IDs for
  mobile drafts;
- `expectedVersion` on mutable approval/inbox workflows;
- generated `contracts/openapi.json` and `packages/api-client` are CI artifacts,
  never hand-edited.

## Client behavior

Web gets an API adapter, query-key convention, error mapper, and server/client
request configuration. Presentational components do not call HTTP directly.
Mobile is not feature-scaffolded here, but package and contract layout must
allow the same generated client and runtime token callback later. Both clients
must show request IDs only in support details, not raw internal errors.

## Implementation tasks

1. Consolidate package manifests/scripts and add root commands for format check,
   lint, typecheck, unit/integration tests, OpenAPI generation/check, and builds.
2. Configure Nest global prefix `/v1`, validation with whitelist/forbid-unknown
   behavior, typed exception filter, request ID, health/readiness, and safe
   logging redaction.
3. Configure OpenAPI generation and deterministic TypeScript Fetch client
   generation. The first-slice `contracts/openapi.json` and
   `packages/api-client` are transport snapshots; replace the hand-maintained
   snapshot with Nest Swagger + official `typescript-fetch` generation before
   declaring this phase complete. Add CI freshness and breaking-change checks.
4. Add shared domain primitives and port contracts with unit tests; keep all
   adapters in infrastructure.
5. Fix the root test runner so Jest/Test processes close cleanly and preserve
   meaningful exit codes.

## Test matrix

| Area | Required cases |
| --- | --- |
| Money | VND parsing, bigint overflow/underflow, zero, serialization, no float path |
| API | validation, unknown fields, error envelope, request ID, pagination |
| Contract | deterministic OpenAPI/client output; breaking change rejected |
| Runtime | health vs readiness, config failure, graceful shutdown |
| Architecture | domain imports do not reference Nest/Prisma/HTTP/frontend |
| Tooling | clean install, lint/typecheck/test/build from root |

## Migration notes

Do not extend the existing Prisma draft while the domain baseline is being
replaced. Preserve old migrations and schema snapshots until Phase 0 preflight
proves they contain no real data; then create a clearly named new baseline.
Root script removal is allowed only for obsolete Flutter/duplicate install
paths identified by the approved React Native migration, and must be a separate
reviewable diff from feature work.

## Exit criteria

- A clean checkout installs and runs all root checks with one documented command.
- `/v1` API emits a deterministic OpenAPI contract and generated client.
- Shared exact-money/error/idempotency/audit ports are tested.
- No business feature or ORM model is placed in the foundation layer.
