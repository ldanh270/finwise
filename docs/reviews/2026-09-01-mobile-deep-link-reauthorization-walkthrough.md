# Mobile deep-link reauthorization walkthrough — 2026-09-01

## Scope and non-goals

This slice preserves a protected mobile route when an unauthenticated deep link
redirects to Login or Signup. After successful authentication, the user returns
to the requested Finwise screen. It does not authenticate a deep link, bypass
Nest authorization, support external redirects, or add push notification
delivery.

## Affected files and modules

- `mobile/src/navigation/deep-link.ts` — route whitelist and safe mapping from
  public URL paths to Expo Router group paths.
- `mobile/src/navigation/deep-link.spec.ts` — valid, grouped, malformed, and
  external path coverage.
- `mobile/app/(app)/_layout.tsx` — carries the protected path to auth.
- `mobile/app/login.tsx` and `mobile/app/signup.tsx` — restore the safe route
  and preserve it while switching between auth screens.
- `mobile/src/index.ts` — exports the navigation boundary.
- Phase 8 plan, mobile README, and planning index — delivery record.

## Business rules and data flow

```text
protected deep link
  -> authenticated layout sees signed-out state
  -> whitelist path and redirect to /login?redirectPath=...
  -> user may switch Login <-> Signup while retaining the path
  -> successful auth -> resolve whitelist -> router.replace(internal path)
```

Only known Finwise routes are accepted. The redirect value is navigation intent,
never a credential or authorization assertion; each destination still loads its
data through the authenticated API and server-side workspace policy.

## Public API and UI behavior

No backend or OpenAPI contract changed. Mobile deep links to Accounts,
Transactions, Budgets, Reports, Group, Inbox, Settings, and the new-transaction
flow now return to that screen after Login/Signup. Unknown or unsafe values
return to the authenticated Overview.

## Schema, migration, and security implications

No database or native schema migration. Redirect values are constrained to a
static internal route set, preventing open-redirect behavior. Tokens remain in
SecureStore and never enter route parameters; the route parameter contains only
the whitelisted path.

## Verification

- `pnpm --filter mobile format` — pass.
- `pnpm --filter mobile typecheck` — pass.
- `pnpm --filter mobile test -- --runInBand` — pass (12 suites, 42 tests).
- `pnpm --filter mobile export:android` — pass.
- `pnpm --filter mobile export:ios` — pass.

## Known gaps and follow-up

Physical-device deep-link association (Android intent filters and iOS universal
links) still requires configured domains and native signing profiles. This
slice handles app-scheme/internal routing; provider and operations configuration
remain release gates.

## Commit message

```text
feat(mobile): restore protected deep links after auth

Whitelist internal Expo routes and carry them through Login or Signup so a
reauthorized user returns to the requested screen without enabling open redirects.
```
