# Vercel services deployment walkthrough

## Scope and non-goals

This slice makes the repository deployable as one Vercel Services project with
the Next.js frontend and NestJS backend behind the same domain. It does not
change financial business rules, authentication policy, database migrations, or
mobile deployment.

## Affected files and modules

- `vercel.json` defines the frontend/backend services, the internal service
  binding, and public routing.
- `frontend/src/lib/api/runtime-url.ts` supports same-origin browser calls and
  the server-side Vercel service binding.

## Business rules and data flow

- Public `/v1/*` requests are routed to NestJS, which already owns the `/v1`
  global prefix.
- All other public paths are routed to Next.js.
- Browser requests use the current origin when no public API URL is configured.
- Server-side Next.js requests use `FINWISE_INTERNAL_API_URL`, injected by the
  Vercel service binding, when no explicit `FINWISE_API_URL` is configured.

## Public API and UI behavior

The existing NestJS `/v1` API remains unchanged. The frontend can use the same
Vercel domain for authentication, workspace data, transactions, reports,
budgets, imports, and other API calls. Explicit `NEXT_PUBLIC_FINWISE_API_URL`
and `FINWISE_API_URL` values still take precedence for split-host deployments.

## Migration and security implications

- Vercel Project Settings must use Framework Preset `Services` and Root
  Directory `.` (the repository root), otherwise Vercel cannot load this root
  `vercel.json` and will report that services are missing.
- Backend production secrets remain Vercel environment variables and are not
  placed in the repository.
- The service binding is server-side only; browser traffic uses the public
  same-origin `/v1` route.

## Verification

- Parsed `vercel.json` as JSON and checked the service and rewrite entries.
- Ran the affected frontend typecheck and production build.
- Ran the backend production build.

## Known gaps and follow-up

- Vercel environment variables still need to be configured for production:
  `DATABASE_URL`, JWT key/issuer/audience variables, and `FRONTEND_ORIGINS`.
- A real Vercel preview deployment is required to verify the account's Services
  entitlement and the platform's service orchestration; this repository change
  cannot alter dashboard-level Root Directory or Framework settings.

## Commit message

`fix(deploy): configure Vercel services for the full stack`
