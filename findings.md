# Findings

## 2026-08-27 architecture planning state

- The current documentation set contains SRS, RDS, six bounded-context/domain
  analyses, a decision log, a technical architecture, and a dedicated mobile
  architecture.
- Flutter is now the target mobile stack for both iOS and Android; the existing
  Expo starter is superseded and requires a dedicated source migration.
- Next.js web, Flutter iOS, and Flutter Android use the same NestJS business API.
  Financial tables are not a direct client-facing API.
- OpenAPI is the canonical transport contract and generates separate TypeScript
  and Dart clients.
- Android release builds can run on Windows, Linux, or macOS with the Android
  toolchain. iOS release builds require macOS, Xcode, Apple signing, and an
  Apple Developer account for TestFlight/App Store distribution.
- The root planning-memory files had not yet recorded the 2026-08-27 technical
  architecture decisions and must be synchronized before this planning phase
  is considered complete.
- `mobile/AGENTS.md` still contained Expo-only guidance after the Flutter
  decision. It was replaced with Flutter migration, shared-Nest-API, security,
  offline, money, and verification guardrails so future agents cannot extend
  the superseded starter accidentally.
- The persistence audit found no confirmed Flutter/shared-backend decision that
  exists only in conversation. The only remaining Expo proposal in the docs is
  explicitly marked superseded to preserve decision history.
- Requirements discovery is intentionally not globally complete: unresolved
  product and infrastructure choices remain recorded as Proposed/Open. They are
  not missing documentation and must not be silently treated as confirmed.

> **Historical context only.** The assumptions below predate the product
> discovery recorded on 2026-08-26 and must not be treated as current
> requirements. See `docs/requirements/SRS.md`, `docs/requirements/RDS.md`, and
> `docs/decisions/DECISION-LOG.md`.

## Repository

- The repository currently contains only `README.md` and `LICENSE`.
- No existing frontend, backend, migration, or test structure was found.
- The implementation plan can therefore define the initial project layout.

## Current DBML risks

- IDs are mixed between UUID and unconstrained `varchar`.
- PostgreSQL `timestamp` is used instead of `timestamptz`.
- `workspace_id` is duplicated on domain rows but is not enforced together with
  the referenced fund/category IDs.
- Transfer invariants are documented in notes but not enforced with database
  constraints.
- One `bank_connection` is currently limited to one fund, which does not model
  providers that expose multiple bank accounts from one connection.
- `fund_balances` is a cache and must not become the financial source of truth.
- Workspace membership does not track invitation or active/removed state.
- Transactions do not record who created or changed them.

## MVP assumptions used in the plan

- A workspace is a shared money group such as a family or small team.
- Active workspace members can view all funds in that workspace.
- The MVP has one owner per workspace.
- Each fund has one currency; transfers must use the same currency.
- Amounts are stored as positive values. Transaction type determines whether
  money is added or removed.
- A transfer uses one transaction row with source and destination funds in the
  MVP. A full double-entry ledger can be added later if required.
- Bank data is first stored as provider data, then mapped to internal
  transactions.
- Expense splitting and member settlement are postponed until after the core
  ledger and bank sync are stable.
