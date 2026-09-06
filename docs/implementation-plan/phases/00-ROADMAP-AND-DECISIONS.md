# Phase 0 — Roadmap and implementation decisions

Status: Approved implementation baseline  
Depends on: SRS, RDS, domain documents, technical/auth/mobile architecture  
Blocks: all subsequent phases

## Objective

Turn the product and domain documents into one executable delivery order. The
MVP is web-first and includes identity, personal/shared workspaces, custom RBAC,
the immutable VND ledger, budgets, Group Treasury core, CSV inbox, and basic
reconciliation. React Native follows the web MVP; bank adapters, lending, and
investments are expansion work.

## Confirmed implementation defaults

- Use a modular NestJS monolith with PostgreSQL and Prisma only in the
  infrastructure layer. Keep domain/application code framework-independent.
- Expose REST `/v1` with Nest-generated OpenAPI and a disposable generated
  TypeScript client shared by web and React Native. Do not share ORM/domain
  types with clients.
- Use Finwise-owned email/password authentication on PostgreSQL. Nest signs
  short-lived RS256 access JWTs and rotates hashed opaque refresh sessions;
  Nest owns all workspace/resource authorization. Production requires key
  rotation, rate limits, recovery controls, and generic auth responses.
- Bootstrap one personal workspace exactly once per internal user. Additional
  workspaces are explicit creates or invitations.
- Effective permissions are the union of active roles. Typed resource policies
  handle account visibility; member-specific exclusions override role
  inclusion and the protected owner always has visibility.
- Use an internally balanced immutable journal. VND money is bigint minor units
  in code and PostgreSQL; JSON serializes minor units as strings. Correct a
  posted event with reversal plus replacement, never an update or delete.
- budgets are at most two levels. Budgets are soft monthly plans supporting
  `BY_CHILDREN`, `SHARED_POOL`, and `HYBRID`; rollover belongs to the funded cap
  owner. Reports exclude hidden data without leaking it through totals.
- Group MVP covers participants, collections, submissions/verification,
  sponsored expense, claims, payables, and reimbursement. It does not include
  Splitwise-style peer settlement.
- CSV and bank records share one inbox/matching model. Matching is not posting;
  confirmation is idempotent and creates one ledger source link.
- React Native uses Expo Router, development builds, and Prebuild/CNG after web
  MVP. Offline is limited to manual income/expense drafts with an explicit
  SQLite outbox; the server remains the only ledger authority.
- Lending expansion begins with interest-free and one reducing-balance
  convention, cash-basis actuals plus labeled unpaid projections. Investment
  expansion uses manual trades/holdings/valuations and weighted-average display.

## Dependency graph

```text
0 decisions/preflight
  -> 1 platform
  -> 2 identity/workspace/access
  -> 3 ledger/accounts
  -> 4 classification/budgets/reports
  -> 5 Group Treasury
  -> 6 imports/reconciliation
  -> 7 web hardening/pilot
  -> 8 React Native mobile
  -> 9 wealth/bank beta
  -> 10 quality/security/operations (gates every release)
```

Phases 3–6 are sequential at the business-contract level because each later
context posts through Ledger. Implementation may parallelize UI and test work
after its required contracts exist.

## Business rules

The roadmap defaults below are binding implementation assumptions for this
delivery plan. Any change requires an append-only decision-log entry and an
update to the affected phase before code is changed.

## Schema and API surface

The phase contracts are additive and workspace-scoped. Shared transport uses
`MoneyDto`, typed errors, cursor pagination, idempotency keys, expected versions,
and the generated `/v1` OpenAPI client. Feature-specific models and endpoints
are defined in Phases 2–9; no phase may expose Prisma models directly.

## Client behavior

Web is the first client and owns configuration-heavy workflows. React Native is
delivered after the web MVP and consumes the same generated contract. Both
clients must preserve server authority, exact money strings, permission-aware
states, and explicit loading/empty/error/partial behavior.

## Test matrix

Phase gates cover domain invariants, use cases with in-memory ports, persistence
constraints, API authorization/contracts, web/mobile behavior, security, and
rebuild/recovery evidence. A phase is not complete when an applicable test
budget has no named case in its phase document.

## Required preflight

1. Record the approved defaults above in the decision log as dated adoption
   entries if product governance requires a separate confirmation record.
2. Inspect database environments and Prisma migrations read-only. If they are
   empty/demo-only, replace the obsolete draft with a new baseline in the
   implementation phase. If real user data exists, stop and write a preserving
   migration map; never drop or reinterpret it automatically.
3. Create requirements traceability from every `FR-*`/`NFR-*` in SRS to a phase,
   API contract, and test case. Missing mappings fail the phase gate.
4. Freeze the release boundary: bank API, mobile, loans, investments,
   recurring transactions, multi-currency, billing, and Splitwise settlement do
   not block web MVP.

## Current preflight evidence (2026-09-01)

- The configured CockroachDB Cloud target was inspected read-only. Its schema
  contains the two approved migrations, one demo user, one personal workspace,
  one owner membership, and no financial account.
- The target was not reset or rebaselined. `pnpm db:deploy` verifies both
  migration checksums and reports the target up to date; `pnpm db:seed` is
  idempotent.
- Preflight now performs exact row-presence checks because Cockroach-compatible
  `reltuples` statistics can remain zero after inserts. Any detected row marks
  the database as containing data and blocks an unsafe fresh baseline decision.
- Requirements traceability is recorded in
  [`../REQUIREMENTS-TRACEABILITY.md`](../REQUIREMENTS-TRACEABILITY.md).
- The approved release boundary and decisions are reflected in this phase pack;
  no proposal currently blocks the first online identity/ledger slice.

## Cross-phase business rules

- `WorkspaceId` is present on every workspace-owned aggregate and is checked at
  both use-case and persistence boundaries.
- Authentication, membership, capability, resource scope, and business state
  are separate gates. A valid JWT does not imply workspace access.
- Financial writes that affect multiple rows use one database transaction;
  audit/outbox records are committed with the business write.
- Posted financial truth is rebuildable from immutable source rows. Caches and
  projections are disposable and must carry freshness metadata.
- Dates use workspace timezone; effective date drives cashflow/budget, while
  recorded/posted timestamps drive operational audit.

## Deliverables and acceptance

- Eleven phase files (this file through `10-QA-SECURITY-OPERATIONS.md`) remain
  the implementation checklist and are linked from the planning index.
- Each phase has dependency, rules, data flow, schema/API surface, client
  behavior, tests, migration notes, and exit criteria.
- The index identifies the current phase and the next unblocked phase.

## Migration and rollback posture

All database changes are additive migrations until the data preflight proves a
safe baseline replacement. Every migration has a rollback/recovery note,
backup/restore verification, and a projection rebuild path. No phase may hard
delete a posted journal or silently discard user data.

## Delivered preflight tooling

- 2026-08-31: `pnpm db:preflight` (or `node scripts/database-preflight.mjs`)
  performs a read-only PostgreSQL metadata inspection, detects placeholder
  credentials, reports whether estimated table data exists, and sanitizes
  connection-failure diagnostics. It never migrates, resets, deletes, or
  rebaselines a database. See the [database preflight walkthrough](../../reviews/2026-08-31-database-preflight-walkthrough.md).

## Exit criteria

- Product owner decisions in the roadmap are reflected in implementation docs.
- Database preflight result is recorded and determines baseline-vs-preserving
  migration work.
- Requirements traceability and phase dependencies are complete.
- Phase 1 is unblocked; no application code is changed by this phase.
