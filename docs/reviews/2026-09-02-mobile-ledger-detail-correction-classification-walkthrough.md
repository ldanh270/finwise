# Mobile ledger detail, classification, and correction walkthrough

## Scope and non-goals

This slice completes the mobile ledger review loop for a visible transaction:
open detail, inspect entries, classify an unclassified posted income/expense,
inspect audit/source evidence, and correct a posted income/expense/transfer by
an immutable reversal-and-replacement command. It does not add offline
classification/correction, transfer categorization, general reports, or a
second local ledger.

## Affected files and modules

- `packages/api-client/src/index.ts` — typed detail, classification, audit,
  source-link, and replacement operations.
- `contracts/openapi.json` — documented transaction audit operation and schema.
- `mobile/src/features/ledger/ledger-service.ts` — transport boundary wrappers.
- `mobile/src/features/ledger/transaction-detail.ts` — pure exact-money
  validation and replacement draft rules.
- `mobile/src/features/ledger/transaction-detail.spec.ts` — domain-level split
  and replacement tests.
- `mobile/src/api-client.spec.ts` — URL, body, and idempotency contract tests.
- `mobile/app/(app)/transactions.tsx` — detail panel and online workflows.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — delivered
  Phase 8 slice and remaining native gates.

## Business rules and data flow

- Only transactions returned by the workspace-scoped list can be opened; the
  detail endpoint performs the authoritative visibility check again.
- Classification lines are positive VND minor-unit strings, each selects one
  active leaf category, and their `bigint` sum must equal the transaction
  amount. Existing classification is shown read-only because backend
  classification is immutable once saved.
- Correction is online-only and limited to income, expense, and transfer
  journals. The UI requires a reason and sends one stable `Idempotency-Key`
  for the submission. The backend reverses the original and posts the
  replacement atomically; the original row is never edited.
- Voiding a journal uses the same stable-command-key boundary: a retry with an
  unchanged reason/date reuses the key, while changing the payload rotates it.
- Audit and source-link reads are separate evidence queries. Errors surface as
  retryable states rather than being rendered as empty history.

```text
transaction list -> selected id -> detail/entries
                              -> classification + categories/tags
                              -> audits + source links
                              -> online classify OR idempotent replace
                              -> invalidate transactions/overview/accounts/budgets
```

## Public API and UI behavior

Added client methods for:

- `GET /v1/workspaces/{workspaceId}/transactions/{transactionId}`
- `GET|POST /v1/workspaces/{workspaceId}/transactions/{transactionId}/classification`
- `POST /v1/workspaces/{workspaceId}/transactions/{transactionId}/replace`
- `GET /v1/workspaces/{workspaceId}/transactions/{transactionId}/audits`
- `GET /v1/workspaces/{workspaceId}/transactions/{transactionId}/source-links`

The mobile Transactions screen now supports tapping a row to inspect entries,
classification, audit history, and source evidence. A posted, unclassified
income/expense can be split across categories and tagged. A posted supported
journal exposes a correction form with account/date/description/reason fields.
Loading, unavailable, empty, and retry states are explicit for detail,
classification, audit, source, category, tag, and account reads.

## Migration and security implications

No database migration is required: all writes continue through existing ledger
application ports and the current in-memory/Prisma boundary. The audit path is
now represented in OpenAPI but does not expose tokens, raw credentials, or
unscoped records. Account/category/tag IDs are accepted only as workspace-
scoped server resources. Local mobile cache remains a read cache; no detail
mutation is queued offline.

## Verification

- `pnpm --filter mobile format` — passed.
- `pnpm --filter mobile test` — 17 suites / 59 tests passed.
- `pnpm typecheck` — api-client, backend, frontend, and mobile passed.
- `pnpm contracts:check` — 87 unique operations and 7 idempotent financial
  commands validated.
- `pnpm lint` — passed before this slice; rerun with the phase gate.
- `pnpm build` — passed before this slice; rerun with the phase gate.
- `pnpm dev` smoke — backend compiled with 0 errors and Nest started all
  routes; `ELIFECYCLE` appears when the Windows terminal interrupts the long-
  running dev process with Ctrl+C, not from a TypeScript compilation failure.

## Known gaps and follow-up

- Native Android/iOS device builds, signing, and physical-device interaction
  remain Phase 8 operations gates; CI remains authoritative on Windows.
- General reports and transfer classification are still placeholders or
  intentionally excluded by the current backend rules.
- Web does not yet expose the same detail panel; align web correction and
  classification UX in the next web ledger slice.

## Commit message

```text
feat(mobile): add ledger detail and correction workflows

Expose workspace-scoped journal evidence, exact-money classification, and
idempotent online reversal-and-replacement on mobile without mutating posted
ledger rows or queueing unsupported offline commands.
```
