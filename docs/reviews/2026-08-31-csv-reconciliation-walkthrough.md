# CSV ingestion and reconciliation walkthrough — 2026-08-31

## Scope

This Phase 6 slice adds a bounded `ingestion/` context for:

- CSV header/date/amount/type validation and normalized rows;
- private workspace import sessions with SHA-256 file hash and row fingerprints;
- same-file idempotent re-import and possible-duplicate evidence;
- match-without-posting plus terminal ignore/needs-attention decisions;
- row confirmation that creates exactly one Ledger journal;
- reconciliation checkpoints and explicit adjustment journals.

Object storage encryption/retention, bulk-confirm result aggregation and
durable source-link/audit tables are intentionally not claimed complete.

## Business rules

1. Session and rows are workspace/account scoped. Account visibility is checked
   before reading, matching, confirming or reconciling rows.
2. Re-importing the same account/file hash returns the original session. A new
   file with the same normalized fingerprint is flagged `needs_attention`, not
   silently discarded.
3. `match` only stores a candidate transaction ID. `confirm` either links that
   match or posts one balanced income/expense journal and records its ID.
   Confirmation requires `Idempotency-Key`; ignored/attention rows cannot post.
4. Reconciliation captures ledger balance at checkpoint time. The only balance
   change is an explicit adjustment whose positive amount equals the absolute
   difference and is posted as a compensating journal.

## Data flow

```text
CSV -> hash/parse -> ImportSession + ImportedRecord(NEEDS_REVIEW)
    -> match (no cash) | confirm -> Ledger journal/source ID
statement -> checkpoint(ledger, external, difference)
          -> explicit adjustment -> resolved checkpoint
```

The import service depends on an `ImportStorePort`; the infrastructure adapter
uses core Ledger ports for account scope and posting.

## Affected files/modules

- `backend/src/ingestion/domain/ingestion.types.ts` — session, row and
  reconciliation state records.
- `backend/src/ingestion/application/ingestion.ports.ts` — store boundary.
- `backend/src/ingestion/application/ingestion.service.ts` — input validation
  and exact-money response mapping.
- `backend/src/ingestion/infrastructure/in-memory-import.store.ts` — CSV
  parser, hashes, state machine, dedup, confirmation and adjustment posting.
- `backend/src/ingestion/presentation/ingestion.controller.ts` and
  `ingestion.module.ts` — `/v1/workspaces/:id/imports` and reconciliation routes.
- `backend/src/app.module.ts` — module registration.
- `contracts/openapi.json` — import/reconciliation contracts.
- `backend/src/ingestion/application/ingestion.service.spec.ts` — dedup,
  match, confirm, replay and reconciliation tests.

## Public API and client behavior

Routes include session creation/list, normalized row list, match, confirm,
ignore, needs-attention, reconciliation start and adjustment. Imported rows
remain visibly pending until confirmation; only confirmed rows expose a journal
ID. Web will provide mapping/review/discrepancy screens; mobile consumes only
post-confirmation balances/history.

## Migration/security implications

Raw CSV content is held only in the in-memory adapter for this slice; production
must move it to encrypted object storage, issue short-lived URLs, redact raw
payloads from logs and expire/delete raw files after resolution/30 days while
retaining normalized evidence. No imported or reconciliation row can bypass
workspace/account authorization.

## Verification

- Backend Prettier, ESLint and TypeScript checks — pass.
- Unit suites — 18 tests pass, including import hash dedup, match/no-balance,
  idempotent confirmation and reconciliation adjustment.
- E2E suite — 2 tests pass.
- Nest build — pass.
- OpenAPI contract check — pass.
- `git diff --check` — pass before commit.

## Known gaps and follow-up

- Add object storage adapter, upload MIME/malware checks, retention jobs and
  manual raw-file delete eligibility.
- Add bulk confirm with per-row commit/error results and command idempotency.
- Add durable `ImportSourceLink`, candidate evidence, audit/version rows and
  reconciliation session history in Prisma.
- Add web CSV mapping/review and discrepancy UI with partial/error states.
