# Finwise engineering rules

These rules apply to the whole repository. More specific `AGENTS.md` files may
add rules for their own directory, but must not weaken these rules.

## Before writing code

- Read the relevant implementation plan under `docs/implementation-plan/`.
- Inspect the existing module, types, tests, and package scripts before adding
  new files.
- For a non-trivial change, write down the affected business rules, data flow,
  and test cases before implementation.
- Reuse existing project conventions and dependencies. Do not introduce a new
  library when the current stack already solves the problem.
- Keep each change focused. Do not mix unrelated refactors into a feature.

## Architecture

The project has two applications:

```text
frontend/  Next.js + React + TypeScript
backend/   NestJS + TypeScript
```

Backend code follows a pragmatic Clean/Hexagonal Architecture:

```text
domain
  ↓
application
  ↓
interface adapters / presentation
  ↓
infrastructure
```

Dependencies point inward. The domain and application layers must not depend on
NestJS, HTTP, ORM entities, PostgreSQL, provider SDKs, or frontend types.

- Domain entities and value objects contain business invariants and remain
  framework-independent.
- Application use cases orchestrate business actions and depend on ports,
  not concrete repositories or external services.
- Controllers only parse input, authenticate/authorize, call a use case, and
  map the result to an HTTP response.
- Repositories, database models, bank providers, queues, and other external
  services are infrastructure adapters.
- Map DTOs, persistence models, and domain models explicitly at boundaries.
- Do not make a global service/container/module own unrelated business logic.
- Keep bounded contexts separate: identity, workspace, funds, transactions,
  and bank sync must not share accidental domain models.

## SOLID rules

### Single Responsibility

- A class/module/function has one reason to change.
- Controllers do not calculate balances, repositories do not enforce HTTP
  permissions, and UI components do not own API orchestration.
- Split code when a file mixes transport, business rules, persistence, and
  formatting.

### Open/Closed

- Add new bank providers, transaction strategies, or notification channels by
  implementing a port/adapter rather than editing a long conditional chain.
- Use a strategy, adapter, or factory only when there is a real variation to
  isolate; do not create abstractions for one implementation without a reason.

### Liskov Substitution

- Implementations of a port must honor the port's contract, error semantics,
  and transaction guarantees.
- An in-memory repository used in tests must behave like the production
  repository for the use case being tested.

### Interface Segregation

- Define small interfaces around a use case's needs.
- Do not inject a large `EverythingService` or a repository with dozens of
  unrelated methods when a focused port is enough.

### Dependency Inversion

- Application code depends on interfaces/ports.
- Concrete PostgreSQL repositories, provider SDKs, queues, and HTTP clients are
  wired at the application edge.
- Never import an infrastructure implementation into a domain entity or use
  case just for convenience.

## Clean Code rules

- Use clear domain names: `workspaceMember`, `fundId`, `destinationFundId`,
  `voidTransaction`; avoid vague names such as `data`, `item`, `helper`, or
  `process` when a precise name is possible.
- Prefer small functions with one level of abstraction and explicit inputs and
  outputs.
- Keep control flow shallow. Extract a function when nesting or branching hides
  the business rule.
- Remove dead code, duplicated logic, unused imports, and commented-out code.
- Do not use `any` in TypeScript. Model unknown external data as `unknown`,
  validate it at the boundary, and narrow it before use.
- Avoid magic strings and numbers. Use typed constants, enums, or domain value
  objects where they represent a real business concept.
- Comments explain why, trade-offs, or external constraints; they must not
  restate obvious code.
- Prefer immutable data and pure functions for calculations and transformations
  where practical.
- Handle errors explicitly. Do not swallow errors, use empty catch blocks, or
  return fake success values.
- Do not expose database errors, stack traces, access tokens, or internal IDs
  unnecessarily in API responses.
- Validate at boundaries and enforce important invariants again in the domain
  or database. Frontend validation never replaces backend validation.

## Financial-domain rules

- Never use JavaScript floating-point arithmetic for financial calculations.
  Use a decimal/money representation and format only at the presentation edge.
- Store transaction amounts with a clear convention: MVP amounts are positive;
  transaction type determines whether money is added or removed.
- A transfer must atomically debit the source fund and credit the destination
  fund.
- A transaction must never reference a fund, category, or member from another
  workspace.
- Do not hard-delete financial transactions. Void/archive them and keep an
  audit record with actor, timestamp, reason, and relevant before/after data.
- Balance caches are derived data. Every balance-changing operation must leave
  enough information to rebuild the balance from the transaction source of
  truth.
- Bank imports must be idempotent. Retrying a sync must not create duplicate
  internal transactions.
- Do not log plaintext passwords, access tokens, refresh tokens, or sensitive
  bank payloads.

## Frontend rules

- Follow the more specific Next.js instructions in `frontend/AGENTS.md`.
- Organize domain features under feature folders. Keep reusable UI separate
  from feature-specific UI.
- Keep route/page components thin; move API calls and feature behavior into
  feature services/hooks.
- Do not call `fetch` or an API client directly from presentational components.
- Keep server state, authentication state, and local UI state separate.
- Every data-driven screen must handle loading, empty, error, retry, and
  permission-denied states.
- Do not trust route params or cached client state for authorization.
- Invalidate or update affected queries after mutations so transaction lists and
  balances do not disagree.
- Prefer accessible semantic HTML and keyboard-operable controls.

## Backend rules

- Keep NestJS controllers thin and put business actions in application use
  cases/services.
- Keep DTOs at the HTTP boundary; do not use request DTOs as domain entities or
  database models.
- Put authorization checks in backend guards/policies/use cases, not only in
  frontend visibility logic.
- Wrap financial writes that affect multiple rows in a database transaction.
- Use explicit repository ports and adapters for persistence.
- Keep provider-specific bank fields and SDK types inside the bank adapter;
  expose a provider-neutral internal model to the application layer.
- Use typed error codes that the frontend can handle without parsing message
  text.
- Add unit tests for domain/use-case logic without requiring a real database;
  add integration tests for repository and database constraints.

## Design-pattern guidance

Use patterns to solve a demonstrated problem, not to make code look advanced.
Preferred patterns for Finwise when justified:

- Repository: isolate persistence behind an application port.
- Adapter: isolate bank providers and external APIs.
- Strategy: choose provider-specific sync or categorization behavior.
- Factory: construct valid domain objects when creation has multiple invariants.
- Unit of Work/transaction boundary: keep multi-record financial changes atomic.
- Domain events: notify audit, balance rebuild, or sync workflows after a
  committed domain action.

Avoid:

- Singleton global state for business data.
- God classes and `Utils`/`Helpers` dumping grounds.
- Generic repositories that expose every table operation to every use case.
- Service locator patterns that hide dependencies.
- CQRS, event sourcing, microservices, or elaborate factories without a proven
  requirement from the current feature.

## Testing and verification

Every feature must include tests at the appropriate level:

- Domain tests for invariants and pure calculations.
- Use-case tests with in-memory ports/fakes.
- Integration tests for PostgreSQL constraints and repository behavior.
- API/e2e tests for authentication, authorization, and critical flows.
- Frontend tests for user-visible behavior and permission states.

Before considering a change complete:

1. Run formatter and linter for the affected application.
2. Run unit and integration tests relevant to the change.
3. Run type checking and build when shared contracts or configuration change.
4. Review the diff for accidental files, secrets, debug logs, and unrelated
   refactors.
5. Update the relevant implementation-plan document when architecture or
   business behavior changes.

## Delivery checklist

- [ ] Business rule is documented or already covered by the implementation plan.
- [ ] Dependency direction remains inward.
- [ ] No business logic lives only in the controller or UI.
- [ ] Inputs and external data are validated.
- [ ] Financial writes are atomic and auditable.
- [ ] Authorization is enforced server-side.
- [ ] Tests cover the happy path and important failure paths.
- [ ] Lint, typecheck, tests, and build pass for the affected app.
