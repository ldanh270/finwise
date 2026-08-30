# Foundation and ledger vertical slice — change walkthrough

Date: 2026-08-30  
Scope: platform foundation, development identity bootstrap, workspace/account
boundaries, immutable ledger first slice, web dashboard shell, and roadmap
artifacts

## Outcome

Finwise now has a runnable first online slice instead of the Nest “Hello World”
and default Next.js page. A development-authenticated user can bootstrap one
personal workspace, create an account, post an opening balance or a manual
income/expense/transfer, list the visible ledger, inspect audit history, and
void a posted transaction through a reversal. The web shell consumes a typed API
adapter and presents loading, empty, error, denied, and partial-data states.

This is not the full MVP roadmap. PostgreSQL persistence, production Supabase
OTP/JWKS validation, budgets, Group Treasury, CSV reconciliation, mobile,
wealth, and bank beta remain gated follow-up phases.

## Business rules implemented

- VND amounts are accepted as decimal strings and stored/calculated as `bigint`.
- Financial commands require `Idempotency-Key`; replaying the same key and body
  returns the original response, while reusing it with another request conflicts.
- Journals contain at least two positive entries, balance increases and
  decreases to the transaction amount, and update account projections together.
- Income and expense use hidden system counter-accounts; transfers have two
  different accounts in the same workspace.
- Posted rows are not edited or deleted. Voiding posts an opposite-entry
  reversal and marks the original journal voided.
- Workspace membership and account visibility are checked before reads and
  writes. A transaction is hidden if any non-system account entry is outside the
  viewer’s allowed scope.
- Bootstrap keys identities by `(providerIssuer, providerSubject)` and
  provisions one personal workspace per internal user.

## Data flow

```text
HTTP request
  -> request-id middleware / global validation
  -> FinwiseAuthGuard (dev token boundary or HS256 fallback)
  -> CoreController (transport parsing only)
  -> CoreService (application orchestration)
  -> CoreStorePort
  -> InMemoryFinwiseStore (first-slice adapter)
  -> response mapper / typed error filter
```

The application service depends on `CoreStorePort`, not the in-memory adapter.
Prisma remains an infrastructure boundary; the old migration is preserved until
database preflight proves that a baseline replacement is safe.

## Backend walkthrough

| Surface | Behavior |
| --- | --- |
| `GET /v1/health` | Unauthenticated liveness response |
| `GET /v1/session/bootstrap` | Provisions/returns internal user, personal workspace, and suggested workspace |
| `POST /v1/workspaces` | Creates another owner workspace after bootstrap |
| `GET/POST /v1/workspaces/:workspaceId/accounts` | Lists or creates visible VND accounts |
| `GET /v1/workspaces/:workspaceId/overview` | Returns permission-filtered accounts, recent journals, and exact string totals |
| `POST .../accounts/:accountId/opening-balance` | Posts a dated opening-balance journal; requires idempotency key |
| `GET/POST .../transactions` | Lists or posts income, expense, and same-workspace transfer journals |
| `GET .../transactions/:transactionId` | Returns a visible immutable journal |
| `POST .../transactions/:transactionId/void` | Creates reversal plus audit record; requires reason and idempotency key |
| `GET .../transactions/:transactionId/audits` | Returns chronological audit entries |

Development authentication accepts `x-finwise-user-id` or `Bearer dev:<id>` when
`NODE_ENV` is not production. Production Supabase verification still needs the
planned JWKS/OTP integration and operational rate limits.

## Web walkthrough

- `frontend/app/page.tsx` delegates to the feature page instead of owning API
  orchestration.
- `dashboard-page.tsx` keeps request state separate from local navigation state.
- `client.ts` is the transport adapter; presentational components do not call
  `fetch` directly.
- `contracts.ts` validates unknown API payloads before rendering.
- `money.ts` formats VND with `BigInt` at the presentation edge, avoiding
  floating-point arithmetic for financial values.
- The dashboard’s default unconfigured state is explicit and does not invent
  demo balances or transactions.

## Contract and documentation changes

- `contracts/openapi.json` records the first-slice REST contract.
- `packages/api-client` provides a transport-only client seam for web/mobile;
  official Nest Swagger plus `typescript-fetch` generation is still pending.
- `docs/implementation-plan/phases/` contains the eleven roadmap phase files.
- `docs/implementation-plan/REQUIREMENTS-TRACEABILITY.md` maps every current
  SRS requirement ID to a phase, API surface, and test evidence.
- `.github/workflows/ci.yml` defines install, format, lint, typecheck, contract,
  test, e2e, and build gates.

## Verification evidence

| Check | Result |
| --- | --- |
| Backend Prettier check | Pass |
| Backend ESLint | Pass |
| Backend TypeScript | Pass |
| Backend unit tests | 5 passed |
| Backend e2e tests | 2 passed |
| Backend Nest build | Pass |
| Frontend Prettier check | Pass |
| Frontend ESLint | Pass |
| Frontend TypeScript | Pass |
| Frontend Next production build | Pass |
| API client TypeScript | Pass |
| OpenAPI JSON contract check | Pass |
| `git diff --check` | Pass |

## Migration and security review

- No database migration was deleted or applied. `DATABASE_URL` was not
  configured during this change, so the legacy migration remains intentionally
  preserved.
- The replacement Prisma schema is a domain-oriented draft, but its generated
  client and baseline migration must be regenerated/validated after the
  read-only data preflight. Local Prisma validation is currently blocked by the
  environment failing to resolve `pathe` from `@prisma/dev`.
- The in-memory store is not production persistence and must not be used for a
  pilot. A PostgreSQL repository and database transaction boundary are required
  before production data is enabled.
- No access token, password, OTP, or bank payload is logged by the new code.
- The development auth header must be disabled in production with
  `FINWISE_DEV_AUTH=false` and replaced by verified Supabase tokens.

## Review checklist

- [x] Application service depends on a port, not NestJS or Prisma.
- [x] Money crosses the API as strings and remains exact internally.
- [x] Tenant and account-scope checks happen server-side.
- [x] Financial writes are idempotent, balanced, and auditable.
- [x] UI handles non-happy data states without fake financial data.
- [ ] Replace in-memory adapter with Prisma/PostgreSQL unit-of-work.
- [ ] Generate client from Nest OpenAPI and add compatibility freshness checks.
- [ ] Add production auth, RBAC/invitations, and remaining MVP contexts.

## Follow-up

1. Complete read-only database preflight and choose baseline versus preserving
   migration.
2. Wire Prisma repositories behind `CoreStorePort` and add persistence tests.
3. Replace the development auth verifier with Supabase OTP/JWKS flow.
4. Finish role/member/account CRUD, then implement classification/budgeting.
5. Continue through Group Treasury, CSV reconciliation, and web pilot gates.
