# Finwise product and engineering documentation

This directory is the source of truth for Finwise product requirements and
architecture. Agents and developers must read this index before changing the
domain model, database schema, APIs, or user-facing financial behavior.

## Document map

| Document | Purpose |
| --- | --- |
| [`requirements/SRS.md`](requirements/SRS.md) | Product scope, actors, functional requirements, and MVP boundaries |
| [`requirements/RDS.md`](requirements/RDS.md) | Domain language, business rules, data flows, invariants, and unresolved domain questions |
| [`domain/README.md`](domain/README.md) | Bounded-context map and detailed alternatives, trade-offs, and recommended business architecture |
| [`decisions/DECISION-LOG.md`](decisions/DECISION-LOG.md) | Confirmed decisions and proposals that still need approval |
| [`product-research/COMPETITIVE-FEATURE-LANDSCAPE.md`](product-research/COMPETITIVE-FEATURE-LANDSCAPE.md) | Current feature benchmark across major money-management apps and implications for Finwise |
| [`implementation-plan/README.md`](implementation-plan/README.md) | Implementation order and current planning status |

## Decision status vocabulary

- **Confirmed**: explicitly agreed with the product owner. Implementations must
  preserve this behavior unless a later decision supersedes it.
- **Proposed**: recommended design that is still being discussed. Do not treat
  it as an approved requirement.
- **Open**: a product or technical question that must be answered before the
  affected feature is implementation-ready.
- **Deferred**: intentionally outside the current MVP, but recorded to avoid a
  design dead end.

When a decision changes, update the SRS/RDS and append a dated entry to the
decision log. Do not silently rewrite history.
