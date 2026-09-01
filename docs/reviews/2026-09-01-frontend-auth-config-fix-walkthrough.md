# Frontend auth configuration fix walkthrough

Date: 2026-09-01  
Scope: local web sign-in configuration for the custom PostgreSQL/JWT session
flow

## Scope and non-goals

This slice fixes the development-only failure where the web auth form stopped
before making a request because `NEXT_PUBLIC_FINWISE_API_URL` was unset. It
does not change password hashing, JWT claims, refresh-token rotation, CORS,
workspace authorization, or production secret/configuration requirements.

## Affected files and modules

- `frontend/src/lib/api/runtime-url.ts` — shared client/server API URL resolver.
- `frontend/src/lib/auth/session.ts` — browser login, register, refresh, and
  logout transport now use the resolver.
- `frontend/src/lib/auth/server-session.ts` — protected App Router pages use the
  same development fallback when checking the refresh cookie.
- `frontend/src/lib/api/client.ts` — feature API adapter uses the same base URL.
- `frontend/README.md` — documents the default and production behavior.
- `docs/implementation-plan/AUTH-SESSION-ARCHITECTURE.md` — records the
  client-boundary decision.

## Business rules

- Development may use the local backend default at `http://localhost:3001` so
  `pnpm dev` is usable from a clean checkout without an ignored `.env.local`.
- An explicit configured URL always wins and trailing slashes are normalized.
- Production never falls back to localhost; an absent API URL remains a
  configuration failure.
- The frontend still treats the backend as the authentication authority and
  never stores private keys, passwords, or refresh tokens in browser storage.

## Data flow

```text
Next.js env -> runtime URL resolver -> browser auth/API adapter
                           -> Nest /v1/auth/* or /v1/session/bootstrap
                           -> HTTP-only refresh cookie + in-memory access token
```

The server session checker and client auth adapter now resolve the same base
URL, preventing a login request and the subsequent protected-page check from
pointing at different endpoints.

## Public API and UI behavior

No backend endpoint or response contract changed. `POST /v1/auth/login`,
`POST /v1/auth/register`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`,
`GET /v1/auth/session`, and `GET /v1/session/bootstrap` remain unchanged.

When development starts without `frontend/.env.local`, the `/auth` form now
calls `http://localhost:3001/v1/auth/login` instead of showing
“Authentication is not configured.” A configured non-local URL continues to be
used as-is. Production still requires an explicit API URL.

## Migration and security implications

No database migration or seed change is required. The default is limited to
`NODE_ENV !== "production"`; it does not weaken production fail-closed behavior.
The API URL is public transport configuration, while all credentials and token
material remain handled by the existing backend/session controls.

## Verification

- `prettier --check` on all changed frontend files — passed.
- `tsc --noEmit` in `frontend` — passed.
- frontend ESLint — passed.
- `pnpm build` in `frontend` — passed.
- `GET http://localhost:3000/auth` — `200`; auth form rendered and the old
  configuration error was absent.
- `GET http://localhost:3000/auth` with the backend-issued refresh cookie —
  `307` redirect to `/`, proving the server-side session check uses the same
  fallback URL.
- `GET http://localhost:3001/v1/health/live` — `200`.
- `POST http://localhost:3001/v1/auth/login` with the seeded demo account —
  `200`, user returned, access token present, refresh cookie present.

## Known gaps

- A real browser submit was not automated because entering a password into a
  browser form is sensitive input; the API and rendered UI were verified
  separately.
- Production deployments must still provide
  `NEXT_PUBLIC_FINWISE_API_URL` (or a server-side API URL for server session
  checks) at build/runtime as appropriate for the deployment model.

## Follow-up

- Add a frontend test harness for auth adapter behavior, including missing URL,
  network failure, refresh, and typed backend errors.
- Add a staging E2E login journey with secrets supplied by the test environment.

## Suggested Conventional Commit

```text
fix(web): default local API URL for development auth

Use one environment resolver across browser auth, server sessions, and feature
API calls while keeping production configuration fail-closed.
```
