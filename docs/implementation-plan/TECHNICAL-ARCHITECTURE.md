# Finwise technical architecture plan

Status: Platform architecture confirmed; remaining infrastructure choices Proposed  
Last updated: 2026-08-29

This document translates the approved product/domain direction into a technical
architecture. It does not authorize implementation or replacement of the old
Prisma schema until the open decisions are confirmed.

## 1. Current repository baseline

| Area | Current state |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 starter |
| API | NestJS 11, TypeScript, Prisma 7, PostgreSQL |
| Mobile | React Native/TypeScript for iOS and Android; Expo development builds and Prebuild/CNG are the recommended baseline |
| Repository | TypeScript monorepo target; applications currently use separate pnpm installs and the mobile source migration is pending |
| Database | Existing Prisma model is an obsolete database-first draft and is not approved domain truth |
| Auth | No implementation selected; `externalAuthUserId` indicates an intended external identity provider |

## 2. Recommended system shape

```text
Next.js web ----------- shared generated TypeScript client ----+
                                                               |
React Native iOS ------ shared generated TypeScript client ----+--> NestJS API /v1
                                                               |          |
React Native Android -- shared generated TypeScript client ----+          |
                                                                          |
                                                               +----------+----------+
                                                               |                     |
                                                     PostgreSQL                 Worker process
                                                               |               bank sync/import/
                                                               |               notifications
                                                               +--- outbox/jobs -----+

External edges: Finwise Auth crypto, bank providers, object storage,
push notification service, future market-price providers.
```

Recommendations:

1. Keep a modular monolith. Do not split business domains into microservices.
2. NestJS is the only authoritative business API for web and mobile.
3. Next.js renders the web product and may adapt web sessions, but owns no
   financial rules and does not query PostgreSQL directly.
4. Mobile uses one React Native codebase for iOS and Android and the same public
   API contract as web.
5. PostgreSQL is the transactional source of truth. Redis/queues and read
   projections are derived/infrastructure concerns.
6. Auth crypto and storage adapters stay at the edges; web/mobile must not
   query PostgreSQL to bypass Nest authorization.

## 3. Repository strategy

### Alternatives

| Direction | Advantages | Disadvantages |
| --- | --- | --- |
| Keep separate pnpm installs and lockfiles | Minimal immediate migration | Dependency drift, duplicated installs, awkward shared-client generation |
| One pnpm workspace for all TypeScript projects | One lockfile, shared generated client, consistent tooling | Requires a focused workspace/lockfile migration |
| Nx/Turborepo immediately | Task graph and caching | Additional framework and configuration before scale proves a need |

**Recommendation:** consolidate `backend`, `frontend`, `mobile`, and pure
TypeScript packages into one root pnpm workspace and lockfile. Root scripts/CI
orchestrate the applications. Do not add Nx/Turborepo until task-graph scale or
CI timing demonstrates a need.
Keep the current directory names:

```text
finwise/
  backend/
  frontend/
  mobile/             # Expo + React Native TypeScript project
  packages/
    api-client/       # generated from Nest OpenAPI for web and mobile
    eslint-config/    # optional when duplication becomes material
    tsconfig/         # optional shared compiler baselines
  contracts/
    openapi.json      # generated canonical transport contract
  docs/
```

Do not share UI code between Next.js and React Native merely because both use
React. Share the OpenAPI contract, generated platform-neutral TypeScript client,
product terminology, design tokens where semantics match, and behavioral test
cases—not runtime domain classes. Web and mobile provide separate auth, fetch,
storage, and presentation adapters. Generated clients are disposable and must
never contain business rules.

## 4. API contract

### Alternatives

#### REST + OpenAPI

- Strong fit with NestJS controllers and resource/action workflows.
- Generates a platform-neutral TypeScript client for web and mobile.
- HTTP semantics, idempotency, caching, file upload, and error codes are clear.
- Requires disciplined DTO/version management.

#### GraphQL

- Flexible client-selected projections.
- Adds resolver authorization, N+1/query-cost control, caching, and mutation
  workflow complexity that the MVP does not need.

#### tRPC/shared server types

- Excellent TypeScript inference for one tightly coupled web application.
- Couples clients to server implementation, fits NestJS poorly, and weakens the
  explicit API boundary needed by mobile and future integrations.

**Recommendation:** versioned REST API with OpenAPI as the executable contract.

Rules:

- base path `/v1`;
- workspace-owned resources use a trusted route scope such as
  `/v1/workspaces/{workspaceId}/accounts`;
- Nest DTOs generate the OpenAPI document; OpenAPI Generator produces a
  platform-neutral TypeScript client with injected runtime/auth configuration;
- never share Prisma models or domain entities as client contracts;
- money crosses JSON as a string minor-unit value or a structured Money DTO,
  never a JavaScript floating-point number;
- use ISO-8601 timestamps with timezone and explicit date-only strings for
  accounting dates;
- cursor pagination for transaction/import/audit histories;
- typed error envelope with stable `code`, safe `message`, `details`, and
  `requestId`;
- all retriable financial creation/confirmation commands accept an
  `Idempotency-Key` or client-generated command ID;
- optimistic concurrency/version fields protect approval and inbox actions;
- OpenAPI generation and breaking-contract detection run in CI.

## 5. Web architecture

Use Next.js App Router. Pages/layouts are Server Components by default; use
Client Components only for interactive forms, charts, browser APIs, and local UI
state.

Recommended flow:

```text
Server Component -> internal Nest API URL -> initial data/render
Client feature hook -> public/same-origin Nest API -> mutation/revalidation
```

The canonical API remains Nest. Avoid recreating controllers and business use
cases in Next Route Handlers or Server Actions.

For deployment, prefer an ingress/rewrite where `/api/v1/*` reaches Nest on the
same public origin, while Next serves UI routes. This reduces CORS/cookie
complexity without adding a JavaScript proxy handler for every endpoint. If the
chosen host cannot support this, use a small Next BFF only for session/token
adaptation and file upload; it still delegates all authorization/business logic
to Nest.

Suggested frontend structure:

```text
frontend/
  app/                       # route/layout/loading/error boundaries
  src/
    features/
      workspace/
      accounts/
      transactions/
      budgets/
      group-treasury/
      imports/
    components/ui/           # web-only reusable presentation
    lib/api/                 # generated client adapters/query keys
    lib/auth/
    lib/formatting/          # presentation-only money/date formatting
```

State guidance:

- server state: TanStack Query or an equivalent query cache when client-side
  synchronization is needed;
- route/initial data: Server Components;
- forms: a dedicated form/validation layer;
- ephemeral UI state: local React state first;
- auth/session: one provider boundary;
- never put authoritative balances, permissions, or financial rules in a global
  client store.

Web should lead configuration-heavy workflows: workspace administration,
custom roles, nested budget setup, CSV mapping, bank reconciliation, detailed
reports, and audit history.

## 6. Backend module architecture

Organize Nest modules by bounded context, not by global controller/service/model
folders:

```text
backend/src/
  modules/
    identity/
    workspace-access/
    ledger/
    planning/
    ingestion/
    group-treasury/
    lending/
    investments/
    reporting/
  shared/
    domain/                  # minimal shared Money/IDs/errors only
    application/             # clock, unit-of-work, idempotency ports
    infrastructure/          # Prisma, config, logging, outbox wiring
  app.module.ts
  main.ts
```

Each business module uses:

```text
domain/          entities, value objects, policies, events
application/     use cases, command/query models, ports
presentation/    Nest controllers, guards, HTTP DTOs/mappers
infrastructure/  Prisma repositories, provider adapters, module wiring
```

Dependency rules:

1. Domain imports no NestJS, Prisma, HTTP, provider SDK, or frontend code.
2. Application depends on focused ports, not concrete repositories.
3. Controllers parse/authenticate/authorize/call/map only.
4. Prisma records are mapped explicitly to domain objects.
5. One context references another by typed ID/snapshot and an explicit port or
   application service, not by importing its ORM/domain entity.
6. Cross-context financial operations use an application unit of work while
   the modular monolith shares PostgreSQL.

Recommended API execution order:

```text
authenticate -> resolve membership -> permission/resource policy
-> validate DTO -> execute use case/domain invariants
-> atomic persistence -> outbox -> safe response
```

## 7. Authentication and authorization

### Identity-provider alternatives

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| Finwise Auth | Full credential/session control, RS256/JWT, PostgreSQL auditability | Key rotation, abuse controls, recovery and MFA are owned operationally |
| Self-hosted Better Auth | More control and TypeScript-first | More operational/security ownership; mobile integration must be proven |
| Clerk/Auth0 | Fast polished auth and administration | Higher recurring cost and vendor coupling |

**MVP decision:** Finwise-owned email/password auth with PostgreSQL-backed
refresh sessions and RS256 access JWTs.
The detailed login, provisioning, refresh, logout, and deletion proposal is in
[`AUTH-SESSION-ARCHITECTURE.md`](AUTH-SESSION-ARCHITECTURE.md).

Boundary rules:

- Finwise Auth proves identity only; workspace roles/account policies remain in
  Finwise;
- Nest verifies access-token signature, issuer, audience, expiry, and subject
  using provider JWKS/high-quality JWT tooling;
- Nest maps `sub` to internal `UserId` and performs authorization on every API
  request;
- web uses secure, HTTP-only session cookie integration where practical;
- React Native uses the generated Finwise auth contract behind an approved
  SecureStore-backed session adapter and sends the access token only to NestJS
  business endpoints;
- biometric unlock is a local app-lock convenience, not a replacement for
  server authentication;
- clients never receive database service keys or bank secrets.

## 8. Persistence and money representation

PostgreSQL remains recommended. Prisma is an infrastructure adapter,
not the domain model.

Recommended numeric model:

- Money: integer minor units in the domain (`bigint`) plus currency; VND has zero
  decimal minor digits;
- API: serialize minor units as strings to avoid unsafe JSON numbers;
- PostgreSQL: `bigint` or sufficiently constrained `numeric(..., 0)` after a
  Prisma serialization spike;
- investment quantities, unit prices, rates, and percentages: separate exact
  decimal types with explicit scale/rounding;
- never use `number` for financial calculation.

Persistence redesign must include:

- composite workspace constraints for cross-tenant references;
- immutable journal header/entries and reversal links;
- unique idempotency/source keys;
- derived balance projections that can be rebuilt;
- audit/outbox records in the same transaction as the business write;
- indexes derived from approved queries, not speculative blanket indexing.

Use isolated PostgreSQL resources for development, staging, and production.
Migrations run through CI/deploy, never from browser or
mobile clients.

## 9. Background jobs and events

Do not add Redis to the manual-ledger foundation. Synchronous financial commands
and same-database projections are sufficient initially.

Introduce asynchronous infrastructure when bank sync, large imports,
notifications, or market prices arrive:

1. transaction writes business state and an outbox row atomically;
2. relay enqueues an idempotent job after commit;
3. Nest worker consumes with retry/backoff and records outcome;
4. duplicate delivery is safe because provider/source/command IDs are unique.

Recommended queue when required: BullMQ with managed Redis, because Nest has a
maintained integration and it supports independent worker processes. Keep job
payloads small and reference database IDs; never place credentials or full bank
payloads in Redis. Financial truth remains PostgreSQL even if Redis is lost.

Initial processes:

```text
api       Nest HTTP process
worker    Nest application context for queues/outbox/providers
web       Next.js process/platform
```

They remain one codebase/deployment unit initially and can scale separately
later.

## 10. Files, receipts, and exports

Use object storage (S3-compatible or managed provider) for CSV originals,
receipts, avatars, and generated exports. PostgreSQL stores metadata, ownership,
hash, scan status, retention status, and object key—not large binary payloads.

- issue short-lived signed URLs only after backend authorization;
- validate size/MIME/extension and scan untrusted uploads;
- imports keep source file hashes for idempotency;
- export generation becomes a background job when datasets become large;
- raw bank/import retention follows the privacy decision in the ingestion spec.

## 11. Observability and security baseline

- structured logs with request/correlation ID and workspace/user IDs where safe;
- never log token, password, full bank payload, or sensitive notes;
- application audit trail is separate from operational logs;
- centralized exception mapping with typed public errors;
- health/readiness endpoints check process and critical dependencies;
- metrics for API latency/error rate, job retries, sync lag, inbox backlog, and
  projection freshness;
- error reporting for web/mobile/backend with PII scrubbing;
- rate limits on auth, invitations, imports, exports, and write endpoints;
- secrets in platform secret management; bank-token encryption keys outside the
  database;
- dependency/security scanning in CI;
- backup/restore and ledger-rebuild drills before public paid launch.

## 12. Test architecture

| Layer | Required tests |
| --- | --- |
| Domain | Money, ledger balancing, budget rollover, authorization precedence, loan calculations |
| Application | Use cases with in-memory ports, idempotency, approval and failure paths |
| Persistence | Prisma mappings, composite tenant constraints, atomic transactions, concurrency |
| API | Authn/authz, resource scope, error contracts, OpenAPI compatibility |
| Web | Loading/empty/error/denied states, critical forms and reports |
| Mobile | Offline drafts, retry/idempotency, secure logout, deep links, platform behavior |
| End-to-end | Sign in -> workspace -> account -> transaction -> budget/balance refresh |

Unit/use-case tests do not require a real database. Integration tests use a real
ephemeral PostgreSQL database matching production features. Avoid mocking Prisma
so deeply that database constraints are never tested.

## 13. Deployment direction

Deployment provider is Open. The architecture requires:

- Next-compatible web runtime or container;
- long-running/container Nest API rather than relying exclusively on short-lived
  serverless functions;
- separately runnable worker once background jobs are enabled;
- managed PostgreSQL;
- managed Redis only when BullMQ is introduced;
- React Native Android builds may run locally or in compatible CI; React Native
  iOS builds require macOS/Xcode locally or a macOS cloud runner, code signing,
  TestFlight, and App Store Connect;
- TLS, custom domains, staging, centralized secrets, backups, and regional
  placement appropriate to target users.

Vercel for Next plus a container platform for Nest/worker is a reasonable
default, but should be chosen after budget, region, operational preference, and
expected pilot traffic are known.

## 14. Technical delivery slices

### Slice 0: foundation decisions

- approve ledger/auth/mobile offline decisions;
- establish one root pnpm workspace for backend, frontend, mobile, and shared
  TypeScript packages;
- establish environment validation, OpenAPI generation, generated client, CI;
- replace starter pages only after the conventions are documented.

### Slice 1: identity and workspace shell

- Finwise Auth spike for Next + React Native + Nest JWT verification;
- user provisioning, workspace creation/switching;
- protected routes and permission-denied contract;
- web/mobile workspace shell.

### Slice 2: accounts and immutable manual ledger

- Money value object, account, journal, entries, opening balance;
- manual income/expense/transfer, idempotency, reversal/replacement;
- balance projection and audit;
- web setup/transaction list; mobile quick entry and recent history.

### Slice 3: classification and monthly planning

- budget tree, split lines, tags;
- monthly soft budget and selected rollover rules;
- dashboard/read projections;
- web budget setup; mobile monthly snapshot.

### Slice 4: group treasury

- participants, collections, contribution submission/verification;
- direct group spending, sponsored/claim/reimbursement workflow;
- approval inbox on web/mobile and push-notification foundation.

### Slice 5: ingestion and reconciliation

- CSV normalization/inbox/matching/idempotency first;
- reconciliation checkpoints;
- one bank adapter only after file/manual flows prove the ledger contract;
- BullMQ/Redis worker introduced when needed by this slice.

### Slice 6: wealth modules

- savings goals;
- loan contract/schedule/payment allocation;
- manual holdings/trades/valuations;
- net-worth/read projections.

Each slice includes backend rules, API contract, applicable web/mobile UX,
tests, migration, audit, and observability. Do not build all backend contexts
before exposing one usable vertical workflow.

## 15. Decisions required before implementation

1. Confirm Finwise-owned auth operations, key rotation, and recovery policy.
2. Approve the pnpm monorepo and one shared generated TypeScript OpenAPI client.
3. Approve mobile offline level defined in the mobile plan.
4. Confirm email/password as the first login method; defer OTP/social methods.
5. Choose deployment budget/provider preference and primary region.
6. Confirm whether the first pilot needs receipts/image uploads and push
   notifications.
7. Confirm whether web and mobile launch together or mobile follows the first
   web ledger slice.
