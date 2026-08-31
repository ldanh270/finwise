# Custom PostgreSQL JWT authentication walkthrough — 2026-08-31

## Scope and non-goals

This slice replaces the web Supabase/OTP adapter with a Finwise-owned
email/password auth service backed by PostgreSQL. It ships RS256 access JWTs,
opaque refresh-token rotation with family reuse detection, lockout handling,
HTTP-only browser cookies, Nest verification, and protected Next.js routes.

It does not ship password reset, MFA, social login, request-rate-limit
middleware, durable workspace provisioning, or React Native SecureStore. The
existing dev header shortcut remains test-only and is disabled in production.

## Affected files and modules

- `backend/src/auth/application/auth.service.ts` and `auth.types.ts`: credential
  validation, session lifecycle, lockout, token hashing and ports.
- `backend/src/auth/jwt-token.service.ts` and `password-hasher.ts`: framework-
  independent RS256 and scrypt primitives.
- `backend/src/auth/auth.controller.ts`, `finwise-auth.guard.ts`, and module:
  HTTP contracts, cookie transport, bearer verification and DI wiring.
- `backend/src/auth/infrastructure/prisma-auth.repository.ts`: PostgreSQL
  adapter with compare-and-swap refresh rotation and family revocation.
- `backend/prisma/schema.prisma`, migration `20260831000000_custom_auth`, and
  `prisma/seed.ts`: credential/session persistence and current demo seed.
- `frontend/src/lib/auth/session.ts`, `server-session.ts`, auth page/sign-out,
  route pages/proxy and API client: browser memory token, refresh single-flight,
  cookie-backed server checks, login/register UI and bearer injection.
- `contracts/openapi.json`, environment examples, README files and auth plan:
  public contract, setup guidance and confirmed architecture decisions.

## Business rules

1. Normalize email with trim + lowercase and use it only for credential lookup;
   the UUID `User.id` remains the actor key.
2. Passwords are 12–128 characters and stored as salted scrypt hashes. Login
   errors are generic; five failures lock the account for 15 minutes.
3. Access JWTs are RS256, short-lived (15 minutes by default), and require the
   configured `kid`, issuer, audience, `sub`, `sid`, `jti`, `iat`, `exp`, and
   `typ=access` claims.
4. Refresh values are random 256-bit opaque strings; only SHA-256 hashes are
   persisted. Each refresh rotates the presented session exactly once. A
   rotated/revoked token replay revokes its family.
5. Browser cookies are HTTP-only, `SameSite=Lax`, secure in production, and
   scoped to `/`. Access tokens never enter browser storage or server cookies.
6. A valid actor still needs workspace membership and resource permission; the
   auth layer never grants financial access by itself.

## Data flow

```text
register/login -> validate -> User row -> AuthRefreshSession(active)
               -> access JWT response + finwise_refresh cookie

protected API -> Bearer -> RS256 verifier -> actor{sub=userId}
               -> workspace policy -> existing domain use case

refresh cookie -> hash -> active session CAS update + child insert
               -> new JWT/cookie; replay -> family revoke + 401
```

The frontend module keeps one in-memory access token and shares a single
refresh promise among concurrent queries. The server-rendered page validates the
refresh cookie with `GET /v1/auth/session`; middleware only performs a cheap
presence redirect and never treats a stale cookie as authorization.

## Public API and UI behavior

- `POST /v1/auth/register` creates a user and returns a public session response.
- `POST /v1/auth/login` authenticates and starts a refresh family.
- `POST /v1/auth/refresh` rotates the cookie session and returns a new access
  token; failure clears the cookie.
- `POST /v1/auth/logout` revokes the presented session and returns `204`.
- `GET /v1/auth/session` returns `{ user: null | publicUser }` without a token.
- Existing `/v1/session/bootstrap` and all workspace routes consume the RS256
  Bearer token unchanged.

The `/auth` page has Sign in/Create account tabs, optional display name during
registration, accessible labels, native password manager autocomplete, loading
and generic error states. `/` redirects unauthenticated users to `/auth`.

## Migration and security implications

Migration `20260831000000_custom_auth` adds credential columns/enums and the
refresh-session table without deleting or rewriting existing users or external
identity rows. It also preserves the old draft's `email` and
`external_auth_user_id` columns by making them nullable and backfilling the
current `email_snapshot` read model. Run database preflight first; do not apply
it to an unknown old schema. Rollback is an application rollback and session
revocation, not a destructive `DROP COLUMN`; retain rows for audit and safe
redeploy.

Production requires PostgreSQL and base64 DER RSA keys via the documented
environment variables. `scripts/generate-jwt-keys.mjs` creates a local 3072-bit
pair. Logs and error responses never contain passwords, raw refresh values,
JWTs, private keys, or raw request payloads. Key rotation uses a new `kid` and
an explicit overlap window; automated rotation tooling is follow-up work.

## Verification

Commands run for this slice:

```text
prisma format / validate / generate                         PASS
tsc -p backend/tsconfig.json --noEmit                      PASS
tsc -p frontend/tsconfig.json --noEmit                     PASS
backend Jest (12 suites, 49 tests)                         PASS
Nest production build                                      PASS
Next.js production build                                   PASS
Prettier check (backend/frontend/scripts)                  PASS
ESLint backend/frontend                                    PASS (existing warning only)
OpenAPI JSON parse + scripts/check-openapi.mjs             PASS
```

Auth unit coverage proves signed claim validation, dev-only compatibility,
registration, password lockout, refresh rotation, replay family revocation,
and access-token actor mapping. Persistence integration still requires a real
PostgreSQL environment with the new migration applied.

## Known gaps and follow-up

- Add an integration suite against PostgreSQL for unique-email races, row-lock
  behavior, refresh CAS races, and migration deploy/rollback rehearsal.
- Add password reset, MFA, rate limiting, abuse telemetry, key-overlap tooling,
  and account deletion/retention policy before public launch.
- Move personal workspace bootstrap from the in-memory adapter to durable
  transaction-backed repositories; keep the same `User.id` actor contract.
- Reuse this exact API contract from the Phase 8 React Native SecureStore
  adapter and add process-death/offline cache tests.

## Commit message

```text
feat(auth): replace Supabase with PostgreSQL-backed JWT sessions

Add scrypt credentials, RS256 access tokens, rotated hashed refresh sessions,
replay-family revocation, auth API routes, and protected web login flows.
```
