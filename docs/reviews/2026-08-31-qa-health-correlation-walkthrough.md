# QA health and correlation walkthrough — 2026-08-31

## Scope

This continuous Phase 10 slice adds operational health semantics and safe
request correlation. The API keeps the existing compatibility health route,
adds unauthenticated liveness and dependency readiness routes with build
metadata, and sanitizes caller-provided `x-request-id` values before echoing
them. Tests cover no-database readiness and correlation-id fallback behavior.

## Non-goals

- This does not claim the full QA/security/operations exit: metrics, structured
  log sinks, redaction middleware, rate limits, secret scanning, backup/restore,
  migration drills, and incident runbooks remain open.
- Readiness does not replace deployment health checks or prove PostgreSQL
  migrations/projections are current.

## Affected files and modules

- `backend/src/health/health.controller.ts` — `/health/live` and
  `/health/ready`, safe dependency status and version metadata.
- `backend/src/shared/presentation/request-id.ts` — allowlisted request-id
  normalization helper.
- `backend/src/shared/presentation/request-id.spec.ts` — correlation tests.
- `backend/src/main.ts` — request middleware now uses the helper.
- `backend/test/app.e2e-spec.ts` — liveness/readiness contract coverage.
- `contracts/openapi.json` — health route and response schemas.

## Business rules

- Liveness is process-only and must remain unauthenticated.
- Readiness returns `503` when `DATABASE_URL` is missing or the database probe
  fails; it never reports a dependency as ready on a failed probe.
- Only `[A-Za-z0-9._:-]{1,100}` request IDs are echoed. Missing/unsafe values
  receive a generated UUID, preventing control characters or oversized values
  from reaching response headers/log correlation.
- Health responses expose version/status metadata only; no credentials or
  connection strings are returned.

## Data flow

```text
request -> requestIdFor(header) -> response x-request-id + error envelope
health/live -> process metadata
health/ready -> DATABASE_URL gate -> Prisma SELECT 1 -> 200/503
```

## Public API and UI behavior

- `GET /v1/health` remains the compatibility liveness response.
- `GET /v1/health/live` returns `{status, service, version}` with no auth.
- `GET /v1/health/ready` returns `{status, service, checks.database}` and
  `503` for `not_configured` or `failed` dependencies.
- Web/mobile clients can use readiness for deploy gates; no end-user screen was
  changed in this operational slice.

## Migration and security implications

No schema migration is needed. The Prisma readiness probe is read-only. The
request-id allowlist reduces header-injection risk and keeps error correlation
stable. Production logging still needs explicit token/PII redaction and audit
separation before pilot.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Request-id unit suite: passed (2 tests).
- Backend e2e suite: passed (3 tests).
- Nest build: passed.
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add structured logging/metrics/error reporting with a redaction test suite.
2. Add authenticated operational metrics and projection/reconciliation
   freshness checks.
3. Add backup/restore, migration rollback, secret scan, rate-limit, and
   incident runbook evidence before pilot approval.

## Commit message

`feat(ops): add health readiness and safe request correlation`

The body should note that readiness returns 503 for unavailable dependencies
and request IDs are allowlisted before being echoed.
