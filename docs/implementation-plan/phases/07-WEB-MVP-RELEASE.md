# Phase 7 — Web MVP hardening and pilot release

Status: Ready after Phases 2–6  
Depends on: identity/access, ledger, planning/reporting, Group Treasury, ingestion  
Unblocks: production pilot and Phase 8 mobile consumers

## Objective

Turn the completed web vertical slices into a safe pilot product with complete
state handling, exports/audit, operational controls, accessibility, and a
repeatable dev → staging → pilot release gate.

## Business rules and release boundaries

- Server authorization remains authoritative for every route, query, aggregate,
  export, and mutation. UI visibility only improves navigation.
- Every data-driven screen has loading, empty, cached/stale, retryable error,
  typed business error, permission-denied, and partial-data states.
- Financial actions invalidate affected transaction, balance, budget, report,
  group, and reconciliation queries together; no screen may show stale balance
  as a confirmed success.
- MVP includes auth, personal/shared ledger, categories/tags, budgets, goals,
  Group Treasury core, CSV/reconciliation, audit, exports, and core reports.
  Bank API, mobile, loans, investments, recurring transactions, multi-currency,
  billing, and peer settlement remain outside the pilot gate.
- Auth pilot requires custom SMTP, six-digit OTP cooldown/rate limits, generic
  responses, abuse monitoring, and safe support/request IDs.

## Data flow

```text
Next App Router -> session/API adapter -> Nest /v1 -> scoped use case
 -> PostgreSQL transaction/projection -> typed response
 -> query invalidation/revalidation -> accessible UI state
```

Server Components fetch initial read data through the canonical Nest API. Client
components own only forms, charts, and ephemeral state. Exports use the same
server-side policy context as reports and are logged.

## Schema and API surface

No new financial truth is introduced. Add/finish operational models as needed:
`AuditEvent`, request/error correlation metadata, export request/status, support
redaction metadata, and projection freshness/checkpoint records. Keep audit
records separate from operational logs.

Verify that the web consumes all canonical `/v1` contracts for workspace/member,
account/transaction, budget/report, group, import/reconciliation, audit, and
export operations. No Next Route Handler may reimplement a business use case.

## Client behavior

Complete permission-aware navigation and protected layouts; workspace switcher;
role/account visibility administration; transaction and budget workflows;
Group Treasury inbox; CSV/reconciliation; audit explorer; filtered CSV export;
and support-safe error details. Use semantic HTML, keyboard-operable dialogs,
focus management, labels, table alternatives for charts, and responsive layouts.

## Test matrix

| Area | Required cases |
| --- | --- |
| Critical journeys | OTP → bootstrap → account → transaction → budget/report refresh |
| Group/import | collection verification, claim/reimbursement, CSV confirm, reconciliation |
| State UX | loading/empty/stale/retry/business error/denied/partial on every data screen |
| Security | route/API cross-tenant denial, hidden-account aggregate/export leak |
| Accessibility | keyboard-only, focus/labels, contrast, screen-reader semantics, reduced motion |
| Reliability | refresh/retry, duplicate submit, session expiry, network timeout |
| Build | lint, typecheck, unit/integration/E2E, production build, OpenAPI freshness |

## Migration notes and rollout

Deploy dev, staging, and production with isolated Auth/DB/Storage resources.
Run schema migrations through CI/deploy with backup and restore verification;
never from browser clients. Pilot behind a small owner/friends allowlist. Keep
feature flags for unfinished bank/mobile/wealth modules and prepare a rollback
to the prior API/image while preserving additive migrations.

## Exit criteria

- All MVP journeys work on a production-like staging environment with no
  authorization or hidden-data leak findings.
- Accessibility and error-state acceptance checks pass for every MVP screen.
- SMTP/rate limits/redaction/audit/metrics are configured and verified.
- Backup/restore, ledger rebuild, migration, and rollback drills pass before
  pilot invitations.
