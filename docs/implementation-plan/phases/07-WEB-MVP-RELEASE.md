# Phase 7 — Web MVP hardening and pilot release

Status: MVP command boundary complete — ledger/group command surfaces delivered; auth, accessibility, and pilot gates remain
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
- Auth pilot requires password recovery/MFA planning, login/refresh rate limits,
  generic responses, abuse monitoring, key rotation, and safe request IDs.

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
| Critical journeys | Login → bootstrap → account → transaction → budget/report refresh |
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

## Delivered slices

- 2026-08-31: policy-filtered transaction CSV export is available at
  `GET /v1/workspaces/:workspaceId/transactions/export`; the web dashboard
  provides download progress, success, and retryable error states. See the
  [change walkthrough](../../reviews/2026-08-31-web-mvp-hardening-walkthrough.md).
- 2026-08-31: overview responses now expose a truthful server-computed
  `hasPartialAccess` indicator for hidden account scopes. See the [partial
  access walkthrough](../../reviews/2026-08-31-partial-access-indicator-walkthrough.md).
- 2026-08-31: the web dashboard consumes the scoped balance endpoint and shows
  ledger/cleared/reconciled detail per visible account with independent error
  fallback. See the [web balance views walkthrough](../../reviews/2026-08-31-web-balance-views-walkthrough.md).
- 2026-08-31: account creation, opening balances, and income/expense/transfer
  commands are available through feature-owned web forms with refresh-after-
  success and typed error states. See the [ledger command walkthrough](../../reviews/2026-08-31-web-ledger-command-walkthrough.md).
- 2026-08-31: the Transactions screen now exposes an idempotent, reasoned Void
  action that posts a reversal and renders server-provided `posted`/`voided`
  status. See the [transaction correction walkthrough](../../reviews/2026-08-31-web-transaction-correction-walkthrough.md).
- 2026-08-31: Group Treasury progress, separated report measures, and direct
  expense posting are available in a workspace-scoped web section. See the
  [Group Treasury web walkthrough](../../reviews/2026-08-31-group-treasury-web-walkthrough.md).
- 2026-09-01: dashboard typography now uses the loaded Geist UI family, the
  Overview empty state is responsive and non-overlapping, Group Treasury
  summary cards share the standard metric rhythm, and the shell has one
  profile affordance. See the [web UI consistency walkthrough](../../reviews/2026-09-01-web-ui-consistency-walkthrough.md).
- 2026-09-01: empty workspaces now expose usable account and transaction
  command forms instead of an inert empty-state action; the API journey is
  covered end-to-end across ledger, planning, Group Treasury, CSV import, and
  reconciliation, and the Overview budget call-to-action opens the Budgets
  editor. See the [command journey fix walkthrough](../../reviews/2026-09-01-web-command-journey-fix-walkthrough.md).
- 2026-09-01: dashboard and Group Treasury summary metrics now use flat,
  softly tinted surfaces without outlined boxes or colored top rules. See the
  [summary card flatness walkthrough](../../reviews/2026-09-01-stat-card-flatness-walkthrough.md).
- 2026-09-01: summary metrics, top-level panels, and matching loading states
  now share the `--radius-panel` token, keeping the visual language consistent
  across loaded and empty states. See the [summary radius consistency walkthrough](../../reviews/2026-09-01-summary-radius-consistency-walkthrough.md).

The phase remains open until the full MVP workflows, operational controls,
accessibility checks, and pilot recovery drills meet the exit criteria above.
