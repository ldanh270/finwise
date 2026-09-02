# Phase 10 — Quality, security, and operations gates

Status: Applies continuously; mandatory before pilot and every later release  
Depends on: all feature phases; may run test planning in parallel  
Unblocks: release approval

## Objective

Provide evidence that Finwise is correct, tenant-isolated, observable,
recoverable, and operable under normal and failure conditions.

## Business rules

- Authorization is deny-by-default and rechecked server-side for every request;
  test capability, membership, resource/account scope, and business state
  independently. Hidden data must not leak through aggregates, ratios, chart
  scales, counts, exports, logs, or notifications.
- PostgreSQL is the financial source of truth. Every multi-row financial write
  is atomic, immutable posted history is preserved, and projections rebuild from
  source journals.
- Never log passwords, OTPs, access/refresh tokens, bank credentials, full bank
  payloads, sensitive notes, or raw financial uploads. Keep application audit
  separate from operational logs; redact PII in traces/crash reports.
- Secrets use platform secret management and environment isolation. Service
  keys and encryption keys never enter client bundles or queue payloads.
- Rate-limit auth, invitations, uploads/imports, exports, and write commands;
  surface typed safe errors and request IDs. Verify backups and recovery before
  claiming readiness.

## Data flow and operational controls

```text
request/job -> correlation + structured safe log -> metric/trace/audit event
             -> database/outbox commit -> worker/reporter
             -> alert/runbook -> operator action and auditable result
```

Track API latency/error rate, auth failures, import/inbox backlog, sync lag,
worker retries, projection freshness, database health, storage retention, and
reconciliation discrepancies. Health is liveness; readiness also checks the
critical database/config dependencies.

## Schema and API surface

Verify all domains provide audit actor/time/reason/before-after or source links,
idempotency records, projection checkpoints, and outbox outcomes. Add a safe
`/v1/health/live` and `/v1/health/ready`, version/build metadata, metrics endpoint
behind operations auth, and typed error envelope. Provide operator commands for
projection rebuild/diff, reconciliation review, migration status, raw-file
retention, failed outbox replay, and incident export without exposing secrets.

## Client behavior

Web and mobile display actionable safe errors, retry only when the command is
idempotent, show stale/offline/partial states, and never mask a failed financial
commit as success. Session expiry preserves drafts under the defined logout
policy. Notification payloads carry safe route identifiers, not sensitive
amounts/descriptions; opening a notification reloads and authorizes the object.

## Test matrix

| Area | Required cases |
| --- | --- |
| Domain/use case | money, balancing, split, rollover, RBAC precedence, group allocation, schedule/quantity invariants |
| Persistence | tenant constraints, immutable posted rows, exactly-one owner, idempotency/source uniqueness, locks |
| API | JWT validation, `401`/`403`, typed errors, pagination, concurrency, rate limits, OpenAPI compatibility |
| UI/mobile | critical journeys, all loading/empty/error/denied/offline/partial states, accessibility |
| Security | secret/log scan, upload validation, authorization fuzzing, cross-tenant/aggregate inference, CSRF/session checks |
| Reliability | retry/duplicate delivery, transaction rollback, outbox replay, projection rebuild/diff |
| Recovery | backup restore, migration rollback/recovery, key rotation plan, disaster runbook |
| Release | format, lint, typecheck, unit/integration/E2E, build, dependency/license/secret scans |

## Migration notes and rollout

Every schema migration has forward/recovery notes and runs in isolated dev,
staging, and production pipelines. Take a backup and verify restore before
destructive/large migrations. Roll out feature flags gradually; monitor errors,
projection lag, inbox backlog, and duplicate/failed commands. Incident response
preserves financial history, pauses unsafe writes if needed, and records actor,
time, decision, and recovery. Run a ledger rebuild after migration and compare
account/report totals before enabling the next phase.

## Exit criteria

- Required test, security, accessibility, observability, backup/restore, and
  rebuild evidence is attached to each release candidate.
- No unresolved critical authorization, data-integrity, secret-leak, or recovery
  finding remains.
- On-call/runbooks cover auth outage, database outage, duplicate import, failed
  worker, projection drift, leaked credential response, and rollback.
- Pilot and subsequent releases have a named approver, monitored rollout, and
  auditable post-release review.

## Delivered slices

- 2026-08-31: liveness/readiness endpoints with safe 503 dependency handling,
  build metadata, and allowlisted request correlation IDs. See the [change
  walkthrough](../../reviews/2026-08-31-qa-health-correlation-walkthrough.md).
- 2026-08-31: startup diagnostics now use a tested recursive redaction boundary
  for credential-like keys and embedded sensitive error values. See the [safe
  log redaction walkthrough](../../reviews/2026-08-31-safe-log-redaction-walkthrough.md).
- 2026-09-02: the Windows/Unix development runner now reports which child
  process exited and whether it ended by exit code or signal, preserving the
  original coordinated shutdown behavior. See the [development runner exit
  diagnostics walkthrough](../../reviews/2026-09-02-dev-runner-exit-diagnostics-walkthrough.md).

The continuous gate remains open until observability, security scanning,
recovery drills, rate limits, and release evidence are attached to a pilot
candidate.
