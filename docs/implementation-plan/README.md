# Finwise implementation planning index

Status: Implementation roadmap approved; Phase 0 preflight ready
Last updated: 2026-08-30

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

## Approved implementation phases

The phase documents below are the executable plan. Each one records its
dependencies, business rules, data flow, schema/API surface, web/mobile
behavior, test matrix, migration notes, and exit criteria.

| Phase | Status | Exit condition |
| --- | --- | --- |
| [00. Roadmap and decisions](phases/00-ROADMAP-AND-DECISIONS.md) | Ready | Decisions, release boundary, preflight, and traceability are frozen |
| [01. Platform foundation](phases/01-PLATFORM-FOUNDATION.md) | In progress | Monorepo, `/v1`, generated OpenAPI client, exact-money/error ports, and CI gates work |
| [02. Identity/workspace/access](phases/02-IDENTITY-WORKSPACE-ACCESS.md) | In progress | Bootstrap, RBAC, invitations, membership lifecycle, owner transfer and archive work; Supabase/OTP persistence remains |
| [03. Ledger/accounts/transactions](phases/03-LEDGER-ACCOUNTS-TRANSACTIONS.md) | In progress | In-memory opening/income/expense/transfer/reversal slice works; Prisma adapter and full CRUD remain |
| [04. Classification/budgets/reporting](phases/04-CLASSIFICATION-BUDGETING-REPORTING.md) | Blocked by 03 | Split lines, nested budgets, rollover, goals, and filtered reports pass |
| [05. Group Treasury](phases/05-GROUP-TREASURY.md) | Blocked by 02–04 | Collections, submissions, sponsorship, claims, payables, and reimbursement pass |
| [06. Ingestion/reconciliation](phases/06-INGESTION-RECONCILIATION.md) | Blocked by 02–03 | CSV inbox, dedup/match/confirm, retention, and checkpoints pass |
| [07. Web MVP release](phases/07-WEB-MVP-RELEASE.md) | Blocked by 02–06 | Web MVP, accessibility, operations, release drills, and pilot gate pass |
| [08. React Native mobile](phases/08-REACT-NATIVE-MOBILE.md) | After web MVP | Online mobile path and controlled offline outbox pass on iOS/Android |
| [09. Wealth/bank beta](phases/09-WEALTH-AND-BANK-BETA.md) | Expansion | Wealth semantics and provider sync/retry/security gates pass |
| [10. QA/security/operations](phases/10-QA-SECURITY-OPERATIONS.md) | Continuous gate | Test, security, recovery, observability, and release evidence is complete |

## Current instruction to implementing agents

Implement phases in dependency order. Start with Phase 0 database preflight and
requirements traceability, then Phase 1 platform work. Do not extend the old
Prisma draft as a shortcut. If preflight finds real user data, stop baseline
replacement and write a preserving migration map. Keep financial truth in the
NestJS/PostgreSQL boundary; clients consume the generated contract only.
