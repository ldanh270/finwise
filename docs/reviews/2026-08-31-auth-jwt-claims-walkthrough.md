# Auth JWT claims walkthrough — 2026-08-31

## Scope

This Phase 2 security slice hardens the local Supabase-compatible JWT verifier.
HS256 tokens now require a non-empty `sub`, an unexpired `exp`, the configured
issuer, and the configured audience (default `authenticated`). A focused test
signs valid tokens and rejects wrong issuer/audience claims.

## Non-goals

- This does not implement Supabase JWKS rotation, email OTP delivery/SMTP,
  cookie session middleware, rate limits, or production identity persistence.
- The development `dev:<user>` shortcut remains available only outside
  production and is still a local/test convenience.

## Affected files and modules

- `backend/src/auth/finwise-auth.guard.ts` — issuer/audience validation.
- `backend/src/auth/finwise-auth.guard.spec.ts` — signed-token regression test.

## Business rules

- Issuer must match `SUPABASE_JWT_ISSUER` when configured and must be present.
- Audience must match `SUPABASE_JWT_AUDIENCE` or default to `authenticated`;
  missing audience is rejected.
- Claim failures return the same safe authentication error family and never
  expose token parsing/signature details.

## Data flow

```text
Authorization: Bearer JWT
 -> parse header/payload/signature
 -> verify HS256 + exp + sub + issuer + audience
 -> AuthenticatedActor -> workspace policy
```

## Public API and UI behavior

No endpoint shape changes. Invalid claims produce the existing `401` auth
response; clients should reauthenticate rather than retry a non-idempotent
command.

## Migration and security implications

No migration. Production still must use provider JWKS verification and key
rotation rather than a long-lived shared secret where required by deployment.
Secrets remain environment-only and are not logged or returned.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- JWT guard Jest suite: passed.
- Nest build: passed.

## Known gaps and follow-up

1. Add JWKS issuer/audience configuration and key-cache/rotation tests.
2. Integrate Supabase SSR cookie sessions and six-digit OTP UI with generic
   responses/cooldown/rate limiting.
3. Add auth abuse metrics and cross-workspace `401`/`403` e2e coverage.

## Commit message

`fix(auth): enforce JWT issuer and audience claims`

The body should note the default audience and that JWKS/OTP integration remains
pending.
