# Runtime configuration walkthrough — 2026-08-31

## Scope

This foundation slice adds one typed runtime configuration parser for the Nest
process. Startup now validates environment name, port, CORS origins, build
version, and production-only database/Supabase JWT requirements before binding
the HTTP server.

## Non-goals

- This does not add a secrets manager, deployment vendor configuration, or
  database connectivity check; readiness remains the health endpoint's job.
- Existing auth adapters still read their provider-specific values at their
  boundary and are not refactored in this slice.

## Affected files and modules

- `backend/src/config/runtime-config.ts` — typed parser and fail-closed rules.
- `backend/src/config/runtime-config.spec.ts` — default, parsing, malformed,
  and production requirement tests.
- `backend/src/main.ts` — startup wiring for port and allowed origins.
- Phase 1/index docs and this walkthrough.

## Business rules

- Development defaults to port `3001` and localhost frontend origin.
- Ports must be integers from 1 through 65535.
- CORS must use explicit origins; wildcard origins are rejected.
- Production requires `DATABASE_URL`, `SUPABASE_JWT_SECRET`, and
  `SUPABASE_JWT_ISSUER` before the server starts.

## Data flow

```text
process.env -> readRuntimeConfig -> Nest CORS + listen(port)
                         `-> throw before bind when invalid
```

## Public API and UI behavior

No endpoint or UI payload changed. Invalid deployment configuration fails at
startup instead of exposing a partially configured API.

## Migration and security implications

No migration is added. Explicit CORS origins reduce accidental cross-origin
exposure, and production secret checks prevent running with dev-like auth
configuration. Secret values are never included in errors.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Runtime configuration Jest suite: passed (4 tests).
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add schema-driven environment documentation and deployment smoke checks.
2. Validate JWKS URL/audience and SMTP settings in a production config layer.
3. Add startup logging with redacted config metadata only.

## Commit message

`feat(platform): validate runtime configuration at startup`

The body should mention bounded port/CORS parsing and production secret
fail-closed behavior.
