# Group reimbursement idempotency walkthrough — 2026-08-31

## Scope

This Group Treasury slice makes the reimbursement command safely retryable.
`POST /v1/workspaces/:workspaceId/group/claims/:claimId/reimburse` now requires
`Idempotency-Key`; the group application service hashes the command, replays
the stored response for an identical retry, and rejects key reuse with changed
input before another ledger transfer can be posted.

## Non-goals

- Collection receipt allocation, split sponsored expenses, bulk inbox actions,
  and group reporting are not added here.
- The idempotency map is still in-memory; durable PostgreSQL uniqueness and a
  transaction/unit-of-work boundary remain persistence work.

## Affected files and modules

- `backend/src/group/application/group.ports.ts` — focused idempotency port.
- `backend/src/group/infrastructure/in-memory-group.store.ts` — hash and
  workspace-scoped idempotency records.
- `backend/src/group/application/group.service.ts` — reimbursement command
  hashing, replay, and required header validation.
- `backend/src/group/presentation/group.controller.ts` — header mapping.
- `backend/src/group/application/group.service.spec.ts` — duplicate-transfer
  regression coverage.
- `contracts/openapi.json` — required `Idempotency-Key` parameter.

## Business rules

- Reimbursement remains a transfer that settles payable cash; it never counts
  the claim expense twice.
- A retry with the same workspace/key/operation/request hash returns the exact
  prior result and does not call the ledger again.
- A missing key is validation failure; reusing the key with a different payer,
  amount, date, or claim is a conflict.
- All command inputs remain positive VND minor-unit strings.

## Data flow

```text
HTTP Idempotency-Key + reimbursement body
 -> service request hash
 -> group idempotency port lookup
 -> one ledger transfer + payable update + saved response
 -> replay on duplicate retry
```

## Public API and UI behavior

The reimbursement route now documents and enforces the required header. Existing
web/mobile clients must preserve the key across network retries; no UI was
changed in this backend-only slice.

## Migration and security implications

No database migration yet. Production must persist the idempotency key with a
workspace/operation uniqueness constraint in the same transaction as the
reimbursement transfer. Stored responses contain only typed result data; no
tokens or raw provider payloads are logged.

## Verification

- Backend Prettier check: passed.
- Backend ESLint: passed.
- Backend TypeScript check: passed.
- Group Jest suite: passed (3 tests, including duplicate replay).
- Nest build: passed.
- OpenAPI validation: passed after contract update.

## Known gaps and follow-up

1. Add durable idempotency records and unit-of-work coordination with the
   PostgreSQL ledger adapter.
2. Apply the same command contract to collection verification and other group
   mutations that cross the ledger boundary.
3. Add bulk retry/result reporting and group audit/event projections.

## Commit message

`fix(group): make reimbursement retries idempotent`

The body should note that the required header prevents duplicate transfers and
that durable uniqueness remains pending.
