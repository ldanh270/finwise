# Web authentication gate walkthrough — 2026-08-31

## Scope

This slice completes the web-facing Phase 2 session boundary for the email OTP
pilot flow. Unauthenticated visitors are redirected to `/auth`; authenticated
visitors can reach the dashboard, and the browser API transport obtains the
current Supabase access token before calling NestJS.

## Non-goals

- This does not claim production auth readiness: Supabase project settings,
  custom SMTP, rate limits, abuse monitoring, JWKS rotation, and durable
  identity persistence remain deployment work.
- Google/Apple login, password login, account deletion, and mobile auth remain
  outside this slice.
- The current backend domain stores are still in-memory; auth UI does not make
  financial data durable.

## Affected files and modules

- `frontend/app/page.tsx` — server-side protected dashboard route.
- `frontend/app/auth/page.tsx` and `frontend/src/lib/auth/auth-page.tsx` —
  shared email OTP request/verification UI for login and first-time signup.
- `frontend/proxy.ts` — Supabase cookie refresh and auth-route redirects.
- `frontend/src/lib/auth/config.ts` — safe public environment parsing.
- `frontend/src/lib/auth/supabase-browser.ts` and
  `frontend/src/lib/auth/supabase-server.ts` — browser/server Supabase seams.
- `frontend/src/lib/auth/sign-out-button.tsx` — provider sign-out and return to
  the signed-out route.
- `frontend/src/lib/api/client.ts` — runtime access-token injection while
  keeping the transport client provider-neutral at its public seam.
- `frontend/src/features/dashboard/dashboard-page.tsx` and
  `frontend/app/globals.css` — signed-in sign-out affordance and auth styling.
- `frontend/.env.example`, `frontend/package.json`, `pnpm-lock.yaml` — public
  auth configuration and Supabase dependencies.

## Business rules

- Email OTP is one flow for both login and registration. Supabase creates the
  provider identity when `shouldCreateUser` is enabled; Nest bootstrap remains
  responsible for the internal user and personal workspace.
- A visitor cannot render protected dashboard content without a verified
  provider session. Missing public Supabase configuration lands on the auth
  screen with a setup message instead of rendering an unauthenticated shell.
- The browser never calls Supabase Data API for financial records. It only uses
  Supabase Auth for session material and sends the access token to NestJS.
- Auth errors are generic and do not reveal whether an email is registered.
- OTP resend is throttled by a client cooldown; production rate limiting must
  also be enforced by Supabase/project infrastructure.

## Data flow

```text
`/` request
  -> Next server client reads Supabase cookies
  -> unauthenticated request redirects to `/auth`
  -> email form calls Supabase `signInWithOtp`
  -> code form calls Supabase `verifyOtp`
  -> browser session cookie is established
  -> `/` server route accepts the session
  -> browser API client reads the access token
  -> Nest `/v1/session/bootstrap` provisions/scopes Finwise workspace
```

## Public API and UI behavior

No Nest endpoint shape changed. The existing `GET /v1/session/bootstrap` is now
called with the Supabase bearer token by the browser transport. The web routes
are:

- `GET /auth` — email and six-digit OTP screens; signed-in users are sent home.
- `GET /` — protected dashboard; signed-out users receive a redirect to
  `/auth`.

The dashboard user card now exposes a sign-out action. The auth page includes
accessible labels, one-time-code autocomplete, loading/disabled states, generic
errors, resend cooldown, and a different-email action.

## Migration and security implications

No database migration is required. Public Supabase URL/anon-key values are read
only from `NEXT_PUBLIC_*` variables; service-role keys must never be placed in
the frontend. Cookie refresh runs through the Next proxy, while financial
authorization remains in NestJS. Access tokens are not logged or placed in
route parameters. Production still requires the backend's verified Supabase
JWT/JWKS configuration and persistent `ExternalIdentity` mapping.

## Verification

- `pnpm --filter frontend typecheck` — passed.
- Frontend Prettier check — passed.
- `pnpm --filter frontend build` — passed.
- `pnpm test` — 11 suites / 46 tests passed.
- `pnpm test:e2e` — 1 suite / 3 tests passed.
- `pnpm contracts:check` — 81 operations checked.
- Runtime smoke: `/` returned `307 Location: /auth` without a session and
  `/auth` returned `200` with the OTP page.

## Known gaps and follow-up

1. Configure a real Supabase project, email template, custom SMTP, rate
   limits, and backend JWT/JWKS verification in dev/staging.
2. Add browser E2E coverage with a test Supabase project for OTP success,
   refresh, expiry, logout, and cross-user cache isolation.
3. Replace in-memory identity/workspace stores with the planned PostgreSQL
   repositories before pilot release.
4. Add the same provider session contract to the Phase 8 mobile adapter.

## Commit message

`feat(phase-2): add web OTP authentication gate`

Body: `Protect the dashboard with Supabase cookie sessions, add email OTP login/registration, and inject bearer tokens into the Nest API transport.`
