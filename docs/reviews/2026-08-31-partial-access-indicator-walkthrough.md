# Partial-access overview indicator walkthrough — 2026-08-31

## Scope

This web/API hardening slice makes the overview's `hasPartialAccess` flag
reflect server-side account visibility instead of a hard-coded false value.
The policy engine compares all active user accounts with the accounts visible
to the requesting member; owners remain explicitly non-partial.

## Non-goals

- No account names, balances, or hidden-resource counts are disclosed to a
  partial viewer.
- This does not add new roles, persistence migrations, or UI copy; the
  existing frontend indicator consumes the flag when present.

## Affected files and modules

- `backend/src/core/application/core.ports.ts` — partial-access query port.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — scoped policy
  evaluation across active non-system accounts.
- `backend/src/core/application/core.service.ts` — overview response mapping.
- `backend/src/core/application/core.service.spec.ts` — owner/member coverage.

## Business rules

- Owner always sees all active non-system accounts and receives
  `hasPartialAccess: false`.
- A member receives `true` if at least one active non-system account is hidden
  by owner-only, include-only, or member exclusion policy.
- Hidden accounts remain excluded from account totals and transaction lists;
  the flag is only an explicit UX signal.

## Data flow

```text
overview request -> visible account list + visible transactions
                 -> partial-access policy query
                 -> hasPartialAccess boolean in overview response
```

## Public API and UI behavior

`GET /v1/workspaces/:workspaceId/overview` now emits a truthful
`hasPartialAccess` value. The existing web dashboard renders its privacy note
when this value is true.

## Migration and security implications

No migration is added. A production repository must calculate this flag under
the same tenant/account-scope transaction as the visible projection and avoid
returning hidden-account identities or aggregate counts.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Core service Jest suite: passed with owner/member visibility coverage.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add PostgreSQL policy-query integration tests for excluded/include-only
   grants and archived accounts.
2. Surface partial indicators on budgets, reports, exports, and mobile views.
3. Add aggregate inference tests covering zero-result hidden workspaces.

## Commit message

`fix(authz): report partial account visibility`

The body should mention server-side policy evaluation and hidden aggregate
protection.
