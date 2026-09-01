# Finwise implementation planning index

Status: Implementation roadmap actively executing; MVP boundaries are shipped
where marked below and production gates remain explicit
Last updated: 2026-09-01

The previous database schema is not an approved source of domain truth. Phase 0
preflight determines whether Phase 1+ can establish a fresh baseline or must
preserve existing data through an explicit migration. Do not extend the old
Prisma schema merely because a table already exists.

## Required reading

1. [`../requirements/SRS.md`](../requirements/SRS.md)
2. [`../requirements/RDS.md`](../requirements/RDS.md)
3. [`../decisions/DECISION-LOG.md`](../decisions/DECISION-LOG.md)
4. [`../domain/README.md`](../domain/README.md) and the context document relevant
   to the change
5. repository `AGENTS.md`

## Technical planning documents

| Document | Purpose |
| --- | --- |
| [`TECHNICAL-ARCHITECTURE.md`](TECHNICAL-ARCHITECTURE.md) | Proposed web/API/data/monorepo/deployment architecture and vertical delivery slices |
| [`MOBILE-ARCHITECTURE.md`](MOBILE-ARCHITECTURE.md) | Confirmed React Native iOS/Android architecture, Expo workflow, offline model, navigation, sync, and release plan |
| [`AUTH-SESSION-ARCHITECTURE.md`](AUTH-SESSION-ARCHITECTURE.md) | Proposed identity provider, login methods, session lifecycle, Nest bootstrap, logout, and account-deletion architecture |
| [`REQUIREMENTS-TRACEABILITY.md`](REQUIREMENTS-TRACEABILITY.md) | SRS requirement IDs mapped to phases, API surfaces, and tests |

## Change reviews

- [Foundation and ledger vertical slice walkthrough](../reviews/2026-08-30-foundation-ledger-vertical-slice-walkthrough.md)
- [Identity, RBAC, and account-scope walkthrough](../reviews/2026-08-30-identity-rbac-account-scope-walkthrough.md)
- [Membership lifecycle walkthrough](../reviews/2026-08-30-membership-lifecycle-walkthrough.md)
- [Ledger correction and projection walkthrough](../reviews/2026-08-30-ledger-correction-projection-walkthrough.md)
- [Classification and budget walkthrough](../reviews/2026-08-31-classification-budget-walkthrough.md)
- [Group Treasury walkthrough](../reviews/2026-08-31-group-treasury-walkthrough.md)
- [CSV ingestion and reconciliation walkthrough](../reviews/2026-08-31-csv-reconciliation-walkthrough.md)
- [Ingestion and reconciliation web boundary walkthrough](../reviews/2026-08-31-ingestion-reconciliation-web-walkthrough.md)
- [Web MVP hardening walkthrough](../reviews/2026-08-31-web-mvp-hardening-walkthrough.md)
- [Mobile outbox scaffold walkthrough](../reviews/2026-08-31-mobile-outbox-scaffold-walkthrough.md)
- [Wealth domain calculators walkthrough](../reviews/2026-08-31-wealth-domain-calculators-walkthrough.md)
- [Wealth application boundary walkthrough](../reviews/2026-08-31-wealth-application-boundary-walkthrough.md)
- [QA health and correlation walkthrough](../reviews/2026-08-31-qa-health-correlation-walkthrough.md)
- [Safe log redaction walkthrough](../reviews/2026-08-31-safe-log-redaction-walkthrough.md)
- [Budget rollover domain walkthrough](../reviews/2026-08-31-budget-rollover-domain-walkthrough.md)
- [Group reimbursement idempotency walkthrough](../reviews/2026-08-31-group-reimbursement-idempotency-walkthrough.md)
- [Ingestion bulk-confirm walkthrough](../reviews/2026-08-31-ingestion-bulk-confirm-walkthrough.md)
- [Ledger source links walkthrough](../reviews/2026-08-31-ledger-source-links-walkthrough.md)
- [Auth JWT claims walkthrough](../reviews/2026-08-31-auth-jwt-claims-walkthrough.md)
- [Ingestion retention walkthrough](../reviews/2026-08-31-ingestion-retention-walkthrough.md)
- [Balance views walkthrough](../reviews/2026-08-31-balance-views-walkthrough.md)
- [Mobile outbox sync walkthrough](../reviews/2026-08-31-mobile-outbox-sync-walkthrough.md)
- [Mobile outbox persistence adapter walkthrough](../reviews/2026-08-31-mobile-outbox-persistence-adapter-walkthrough.md)
- [Mobile/web parity audit walkthrough](../reviews/2026-09-01-mobile-web-parity-audit-walkthrough.md)
- [Mobile bootstrap readiness walkthrough](../reviews/2026-09-01-mobile-bootstrap-readiness-walkthrough.md)
- [Mobile inbox data-state walkthrough](../reviews/2026-09-01-mobile-inbox-state-walkthrough.md)
- [Mobile transaction account-state walkthrough](../reviews/2026-09-01-mobile-transaction-account-state-walkthrough.md)
- [Mobile feature-service boundary walkthrough](../reviews/2026-09-01-mobile-feature-service-boundary-walkthrough.md)
- [Mobile partial-access balance walkthrough](../reviews/2026-09-01-mobile-partial-access-walkthrough.md)
- [Budget allocation walkthrough](../reviews/2026-08-31-budget-allocation-walkthrough.md)
- [Web budget planning walkthrough](../reviews/2026-08-31-web-budget-planning-walkthrough.md)
- [Reconciliation list walkthrough](../reviews/2026-08-31-reconciliation-list-walkthrough.md)
- [Runtime configuration walkthrough](../reviews/2026-08-31-runtime-config-walkthrough.md)
- [Partial access indicator walkthrough](../reviews/2026-08-31-partial-access-indicator-walkthrough.md)
- [Web balance views walkthrough](../reviews/2026-08-31-web-balance-views-walkthrough.md)
- [Shared API transport walkthrough](../reviews/2026-08-31-shared-api-transport-walkthrough.md)
- [OpenAPI contract gate walkthrough](../reviews/2026-08-31-openapi-contract-gate-walkthrough.md)
- [Database preflight walkthrough](../reviews/2026-08-31-database-preflight-walkthrough.md)
- [Group collection progress walkthrough](../reviews/2026-08-31-group-collection-progress-walkthrough.md)
- [Group Treasury MVP phase walkthrough](../reviews/2026-08-31-group-treasury-mvp-phase-walkthrough.md)
- [Group Treasury web walkthrough](../reviews/2026-08-31-group-treasury-web-walkthrough.md)
- [Web ledger command walkthrough](../reviews/2026-08-31-web-ledger-command-walkthrough.md)
- [Web transaction correction walkthrough](../reviews/2026-08-31-web-transaction-correction-walkthrough.md)
- [Root pnpm workspace install-policy walkthrough](../reviews/2026-08-31-pnpm-workspace-install-policy-walkthrough.md)
- [Windows development runner walkthrough](../reviews/2026-08-31-windows-dev-runner-walkthrough.md)
- [Root test-runner argument walkthrough](../reviews/2026-08-31-root-test-runner-arguments-walkthrough.md)
- [Nest runtime validation dependencies walkthrough](../reviews/2026-08-31-nest-runtime-validation-dependencies-walkthrough.md)

## Approved implementation phases

The phase documents below are the executable plan. Each one records its
dependencies, business rules, data flow, schema/API surface, web/mobile
behavior, test matrix, migration notes, and exit criteria.

| Phase | Status | Exit condition |
| --- | --- | --- |
| [00. Roadmap and decisions](phases/00-ROADMAP-AND-DECISIONS.md) | Ready | Decisions, release boundary, preflight, and traceability are frozen |
| [01. Platform foundation](phases/01-PLATFORM-FOUNDATION.md) | Boundary complete | Runtime primitives and strengthened contract gate work; official generator freshness remains |
| [02. Identity/workspace/access](phases/02-IDENTITY-WORKSPACE-ACCESS.md) | In progress | Bootstrap, RBAC, invitations, membership lifecycle, owner transfer and archive work; durable workspace authorization remains |
| [03. Ledger/accounts/transactions](phases/03-LEDGER-ACCOUNTS-TRANSACTIONS.md) | In progress | In-memory journals, archive, reversal/replacement and rebuild work; Prisma/checkpoints/source links remain |
| [04. Classification/budgets/reporting](phases/04-CLASSIFICATION-BUDGETING-REPORTING.md) | Planning boundary complete | Categories/tags/monthly budget editor and projections work; split UI, rollover persistence, goals/full reports remain |
| [05. Group Treasury](phases/05-GROUP-TREASURY.md) | MVP boundary complete | Core application + web progress/report slice works; production persistence and advanced workflow gates remain |
| [06. Ingestion/reconciliation](phases/06-INGESTION-RECONCILIATION.md) | MVP boundary complete | Web CSV review/confirm/ignore and reconciliation checkpoints work; durable persistence, object retention, adjustment UI, and bank adapters remain |
| [07. Web MVP release](phases/07-WEB-MVP-RELEASE.md) | MVP command boundary complete | Ledger/group web commands work; auth, accessibility, operations and pilot gates remain |
| [08. React Native mobile](phases/08-REACT-NATIVE-MOBILE.md) | Online feature parity complete | Web-used capabilities are implemented in Expo; native iOS/Android device gates remain |
| [09. Wealth/bank beta](phases/09-WEALTH-AND-BANK-BETA.md) | Application boundary complete | Loan/investment application semantics work in-memory; APIs, persistence, and provider gates remain |
| [10. QA/security/operations](phases/10-QA-SECURITY-OPERATIONS.md) | Continuous boundary work | Health, correlation, and redaction slices work; recovery, rate limits, metrics, and pilot evidence remain |

## Current instruction to implementing agents

Implement phases in dependency order. Start with Phase 0 database preflight and
requirements traceability, then Phase 1 platform work. Do not extend the old
Prisma draft as a shortcut. If preflight finds real user data, stop baseline
replacement and write a preserving migration map. Keep financial truth in the
NestJS/PostgreSQL boundary; clients consume the generated contract only.
