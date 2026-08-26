# Finwise implementation planning index

Status: Requirements discovery in progress  
Last updated: 2026-08-26

The previous database schema is not an approved source of domain truth. It will
be redesigned after the requirements and ledger decisions are confirmed. Do not
extend the existing Prisma schema merely because a table already exists.

## Required reading

1. [`../requirements/SRS.md`](../requirements/SRS.md)
2. [`../requirements/RDS.md`](../requirements/RDS.md)
3. [`../decisions/DECISION-LOG.md`](../decisions/DECISION-LOG.md)
4. [`../domain/README.md`](../domain/README.md) and the context document relevant
   to the change
5. repository `AGENTS.md`

## Planning phases

| Phase | Status | Exit condition |
| --- | --- | --- |
| 0. Product and domain discovery | In progress | Core open questions for workspace, permissions, budget, ledger, groups, loans, and investments are answered |
| 1. MVP use-case inventory | Pending | User journeys and use cases have acceptance criteria and required permissions |
| 2. Domain and ledger design | Pending | Aggregates, invariants, transaction semantics, and error codes are approved |
| 3. Persistence redesign | Pending | New schema, constraints, migrations, and repository ports trace to approved rules |
| 4. API and sync design | Pending | Contracts, authorization, idempotency, and inbox state machine are specified |
| 5. Web and mobile experience | Pending | Navigation and critical screens cover loading/error/empty/permission states |
| 6. Delivery slices | Pending | Vertical slices have tests, dependencies, and measurable completion criteria |

## Current instruction to implementing agents

Do not implement or migrate the new financial model yet. Continue requirements
discovery and resolve the open questions in the RDS. The existing schema may be
discarded later, but deletion and migration strategy require an explicit
implementation task after the replacement model is approved.
