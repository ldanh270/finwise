# Safe log redaction walkthrough

Date: 2026-08-31
Phase: 10 — Quality, security, and operations
Status: Implemented as a small redaction gate; production logging, metrics, and recovery controls remain.

## Scope and non-goals

This slice adds a framework-independent redaction helper for structured operational context and credential-like values embedded in error messages. Backend startup failure logging now uses the helper, and tests cover nested objects, arrays, tokens, passwords, and OTP values.

It does not claim a complete structured log sink, PII tracing policy, metrics backend, authenticated metrics endpoint, rate limiting, secret scanner, backup/restore drill, or incident runbook.

## Affected files and modules

- `backend/src/shared/presentation/safe-log.ts` — key-aware and text-aware redaction functions.
- `backend/src/shared/presentation/safe-log.spec.ts` — regression tests for nested and embedded sensitive values.
- `backend/src/main.ts` — startup catch path uses `safeErrorMessage`.
- Phase 10/index documentation and this walkthrough.

## Business rules

- Access/refresh tokens, passwords, secrets, authorization/cookie values, OTPs, and raw/bank payload fields are replaced with `[REDACTED]`.
- Redaction recurses through object and array contexts and converts `bigint` to a non-ambiguous display string rather than throwing during logging.
- Unknown startup failures produce a safe message; application errors still use the typed response filter and never expose stack traces.
- The helper is an operational boundary only; it does not authorize access or replace audit records.

## Data flow

```text
startup error/context -> safeErrorMessage/redactSensitive -> operator log
                         (credential/raw fields removed)
```

No token or raw import payload is sent to a client by this change.

## Public API and UI behavior

No HTTP or UI contract changed. Internal callers can use `redactSensitive(value)` for structured contexts and `safeErrorMessage(error)` for error strings. Startup failures continue to set a non-zero process exit code.

## Migration and security implications

No migration. Existing logs remain subject to deployment sink configuration; callers must invoke the helper before logging request/provider contexts. Production rollout still needs a centralized logger, retention policy, PII review, and secret-scanning CI gate.

## Verification

- Backend TypeScript: passed.
- Backend ESLint: passed with one pre-existing warning in `group.service.ts:741`.
- Backend Jest: 11 suites, 46 tests passed.
- Nest production build: passed.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Route all structured request/provider logs through a single logger that applies this helper by default.
2. Add redaction tests for headers, nested provider payloads, and trace/crash metadata.
3. Add rate-limit, secret-scan, dependency/license, backup/restore, and recovery-runbook evidence before pilot approval.

## Phase commit message

```text
feat(ops): add sensitive-data log redaction boundary

Redact credential-like keys and error values recursively, and apply safe error
messages to startup logging so operational diagnostics cannot expose tokens,
passwords, OTPs, or raw financial payloads.
```
