# Authentication route walkthrough — 2026-09-01

## Scope

Expose separate canonical web routes for sign-in and account creation:
`/login` and `/signup`. Keep `/auth` as a compatibility redirect so existing
bookmarks do not break.

## Non-goals

- Backend authentication endpoints remain `/v1/auth/login`,
  `/v1/auth/register`, `/v1/auth/refresh`, and `/v1/auth/logout`.
- This does not change JWT, refresh-cookie, password, or session behavior.
- This does not add password recovery or MFA screens.

## Affected files/modules

- `frontend/app/login/page.tsx` renders the login route.
- `frontend/app/signup/page.tsx` renders the registration route.
- `frontend/app/auth/page.tsx` redirects legacy traffic to `/login`.
- `frontend/app/page.tsx`, `frontend/proxy.ts`, and the sign-out button now
  use `/login` for unauthenticated navigation.
- `frontend/src/lib/auth/auth-page.tsx` accepts an initial mode and updates the
  browser route when switching between login and signup.
- `docs/implementation-plan/phases/07-WEB-MVP-RELEASE.md` records the shipped
  route boundary.

## Business rules and data flow

An unauthenticated request to a protected page is redirected by the Next.js
Proxy to `/login`. The route server component checks the refresh-cookie-backed
session and redirects an authenticated user to `/`. The client form calls the
existing backend auth API and returns to `/` after a successful session. The
legacy `/auth` page performs a server redirect to `/login`.

## Public API and UI behavior

The public URLs are now:

| URL | Mode |
| --- | --- |
| `/login` | Sign in |
| `/signup` | Create account |
| `/auth` | Compatibility redirect to `/login` |

The shared form remains visually and behaviorally consistent. The mode tabs
update the URL, so browser refresh, bookmarks, and back/forward navigation keep
the selected auth mode.

## Migration/security implications

No database or API migration is required. The route guard remains an
optimistic UX redirect only; backend JWT validation and workspace authorization
remain authoritative. No token or credential is added to the URL.

## Verification

- `pnpm format:check:frontend` — passed.
- `pnpm lint:frontend` — passed.
- `pnpm typecheck:frontend` — passed.
- `pnpm build:frontend` — passed; build output includes `/login`, `/signup`,
  and the legacy `/auth` route.

## Known gaps

The authentication form still uses a shared client component and tab buttons;
dedicated recovery and MFA routes remain outside the current MVP boundary.

## Follow-up

Add explicit browser E2E coverage for direct `/login`, direct `/signup`, legacy
`/auth`, protected-route redirect, and authenticated-user redirect once the web
E2E harness is enabled.
