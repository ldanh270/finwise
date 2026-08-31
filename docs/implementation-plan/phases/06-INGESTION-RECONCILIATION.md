# Phase 6 — CSV ingestion and reconciliation

Status: MVP boundary complete — CSV inbox/review, confirmation decisions, bulk partial-failure results, reconciliation, and raw-delete guard slices are usable; durable persistence/object retention remain
Depends on: [Phase 2](02-IDENTITY-WORKSPACE-ACCESS.md), [Phase 3](03-LEDGER-ACCOUNTS-TRANSACTIONS.md), Phase 1 object-storage/audit ports  
Unblocks: full web MVP and future bank adapters

## Objective

Provide a private, auditable inbox for CSV/bank evidence, safe deduplication and
matching, idempotent confirmation into Ledger, and reconciliation checkpoints.

## Business rules

- `ImportSession` and normalized records are workspace-scoped. Keep original
  file metadata/hash/version and normalized evidence; large/raw files live in
  encrypted object storage with short-lived authorized URLs.
- State machine is `RECEIVED → NEEDS_REVIEW → MATCHED | CONFIRMED | IGNORED |
  NEEDS_ATTENTION`. Match never posts. Confirm creates or links exactly one
  posted journal and one source link atomically.
- Deduplication uses provider/file/source identifiers plus stable normalized
  fingerprints. Re-importing the same file is idempotent. A possible duplicate
  is reviewable, never silently discarded.
- A CSV uploader or delegated custodian can see authorized raw rows. Other
  admins see confirmed transactions and operational metadata only unless the
  resource policy delegates raw access. Every query still obeys account scope.
- Bulk confirm is per row: valid rows commit independently; failures return
  typed row results. Terminal actions are idempotent and cannot confirm ignored
  or already-confirmed data without an explicit correction flow.
- Reconciliation compares cleared Ledger balance with an external statement at
  a dated checkpoint. Difference is resolved by matching, missing-entry posting,
  or explicit adjustment journal with reason; never overwrite balance.
- Raw originals may be manually deleted after all rows resolve and are
  automatically deleted after 30 days, subject to retention policy. Normalized
  evidence, hashes, audit, and source links remain.

## Data flow

```text
upload -> validate MIME/size/columns -> hash/store raw -> normalize rows
 -> dedup/candidate match -> reviewer decision
 -> confirm in Ledger UoW + source/audit -> reconciliation checkpoint
```

Upload scanning and object-storage metadata are external side effects guarded by
authorization. The confirmation transaction never depends on a browser-held
service key. Large imports can later emit an outbox job; MVP may process rows
synchronously with bounded batches.

## Schema and API surface

Create `ImportSession`, `ImportFile`, `ImportedRecord`, normalized provider
fields, `DedupEvidence`, `MatchCandidate`, `ImportSourceLink`, `Reconciliation
Session`, `ReconciliationCheckpoint`, and `ReconciliationAdjustment`. Include
state/version, raw hash/object key, provider/account identifiers, timestamps,
reviewer/decision reason, and unique `(workspace, sourceType, sourceKey)` where
provider guarantees stability.

Expose:

- create/import-session and upload/mapping preview;
- cursor-paginated raw/normalized rows with scoped field redaction;
- match/unmatch/confirm/ignore/needs-attention commands with `expectedVersion`;
- bulk confirm with per-record result and idempotency;
- reconciliation start/checkpoint/discrepancy/resolve/adjustment;
- raw-file delete after eligibility and export of normalized evidence.

Use typed errors for invalid upload, unsupported mapping, duplicate/conflict,
hidden account, expired session, stale row, forbidden raw access, and unresolved
reconciliation.

## Client behavior

Web leads mapping preview, column errors, duplicate review, candidate matching,
row-level confirmation, bulk result summary, discrepancy workflow, and audit
links. It clearly labels imported/pending data and never displays it as balance.
File upload progress, retry, empty, denied, stale, and partial row states are
required.

Mobile initially consumes only post-confirmation history and balance. Bank/CSV
review is web-led; mobile cannot confirm imports offline.

## Test matrix

| Area | Required cases |
| --- | --- |
| Upload | size/MIME/encoding/column validation, malware scan result, object authorization |
| Normalize | dates/amounts/provider IDs, malformed row, timezone, exact money strings |
| Dedup | same file/retry, same source key, candidate duplicate, conflicting record |
| State | every transition, terminal idempotency, match does not post, invalid transition |
| Confirm | one journal/source link, row-level bulk failure, cross-account denial |
| Retention | manual delete eligibility, 30-day raw expiry, evidence/audit preserved |
| Reconciliation | checkpoint equality/discrepancy, adjustment journal, projection rebuild |
| Security/UI | custodian raw visibility, hidden aggregates, upload/retry/denied states |

## Migration notes

Do not backfill legacy imported rows directly into `JournalTransaction`. Load
them as `NEEDS_REVIEW` with an original hash and migration source, then use the
normal confirmation path. Preserve old statement references and produce a
duplicate/reconciliation report before enabling automated imports.

## Delivered slices

- 2026-08-31: CSV dedup/match/confirm, bulk confirmation, source links, raw
  retention guard, and workspace-scoped reconciliation checkpoint listing are
  available in the in-memory vertical slice. See the [reconciliation list
  walkthrough](../../reviews/2026-08-31-reconciliation-list-walkthrough.md).
- 2026-08-31: The web dashboard now exposes import-session review, normalized
  record confirm/ignore actions, CSV staging/upload, and reconciliation
  checkpoint creation. See the [ingestion and reconciliation web walkthrough](../../reviews/2026-08-31-ingestion-reconciliation-web-walkthrough.md).

## Exit criteria

- Re-importing a CSV does not create duplicate internal transactions.
- Match leaves balances unchanged; confirm creates one auditable Ledger source
  link, and bulk errors do not roll back valid rows.
- Reconciliation checkpoints and explicit adjustments rebuild correctly and raw
  data visibility/retention rules are enforced.

## First-slice evidence

`backend/src/ingestion` now validates and normalizes bounded CSV content into a
private workspace inbox, hashes files for idempotent re-import, records
fingerprint duplicate evidence, supports match-without-posting and terminal
ignore/needs-attention decisions, and confirms exactly one income/expense
journal per row. Reconciliation checkpoints capture ledger/external balances
and resolve differences only through explicit adjustment journals. Object
storage retention and durable audit tables remain. Bulk confirmation now
returns independent row outcomes with stable retry keys, confirmed rows link to
their journal provenance, and raw deletion is guarded by terminal session
state. See the [ingestion walkthrough](../../reviews/2026-08-31-csv-reconciliation-walkthrough.md),
[bulk-confirm walkthrough](../../reviews/2026-08-31-ingestion-bulk-confirm-walkthrough.md),
and [retention walkthrough](../../reviews/2026-08-31-ingestion-retention-walkthrough.md).
