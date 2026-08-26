# Ingestion, bank sync, import inbox, and reconciliation domain

Status: Proposed, except the confirmed inbox/custodian requirements  
Last updated: 2026-08-26

## 1. Business purpose

External data is evidence, not automatically Finwise's financial truth. This
context safely receives unreliable, duplicated, mutable, and differently shaped
bank/file data, then helps an authorized reviewer match or confirm it into the
Ledger.

## 2. Posting alternatives

### Option A: bank/file rows immediately become transactions

- Pros: zero-review convenience and fast initial demo.
- Cons: duplicates affect balances; pending amounts can change; bad categories
  pollute budgets; group members may see private raw descriptions; matching a
  manually entered transaction becomes correction work.

### Option B: temporary preview with no persisted inbox

- Pros: simple storage and one-session import UX.
- Cons: large imports cannot be resumed; background bank sync has nowhere to
  wait; audit and dedup state disappear.

### Option C: persistent provider-neutral review inbox

- Pros: resumable, auditable, idempotent, supports both files and banks, allows
  matching before posting, and enforces stricter raw-data visibility.
- Cons: requires a state machine, matching rules, and clear queue UX.

**Recommendation: Option C.** Bank and file sources share normalization,
deduplication, candidate matching, and confirmation concepts, while each source
adapter retains its own raw payload format.

## 3. Context-owned model

### BankConnection

Belongs to one workspace and has provider, status, encrypted credential
reference, custodian membership, sync cursor, consent/expiry metadata, and
health state. Tokens and raw secrets never enter domain events, client DTOs, or
application logs.

### ExternalAccountLink

Maps a provider account identity to one Finwise financial account. Linking the
same real bank account through multiple connections is detectable but not
assumed impossible.

### ImportSession

Represents one file upload or manual batch: uploader, source type, file hash,
mapping/template, counts, status, and idempotency key. Original files need a
retention policy because statements can contain sensitive data.

### ImportedRecord

Stores:

- workspace, source, external account, stable provider key when available;
- normalized amount/direction, effective/posted dates, description, merchant;
- provider lifecycle (`pending`, `posted`, `removed`, `unknown`);
- review lifecycle, version, raw-payload reference/hash;
- match/confirmation outcome and linked ledger transaction;
- dedup and matching evidence.

Provider lifecycle and Finwise review lifecycle are separate axes. A record may
be provider-posted but still waiting for Finwise review.

## 4. Recommended review state machine

```text
RECEIVED -> NEEDS_REVIEW -> MATCHED or CONFIRMED or IGNORED
                    \-> NEEDS_ATTENTION

Provider update: RECEIVED/NEEDS_REVIEW -> SUPERSEDED or UPDATED
Confirmed source later changes/removes -> DISCREPANCY (ledger remains immutable)
```

Definitions:

- `MATCHED`: linked to an existing posted ledger transaction; no new balance
  effect.
- `CONFIRMED`: created exactly one new posted ledger transaction.
- `IGNORED`: user decided it should not create/match a transaction; reason kept.
- `NEEDS_ATTENTION`: ambiguous duplicate, conflicting mapping, invalid amount,
  or missing accessible target account.
- `DISCREPANCY`: provider later changed/removed evidence already confirmed;
  requires review, not deletion of financial history.

Each terminal action is idempotent. Concurrent reviewers cannot both confirm
the same record; use version/row locking and a unique source link.

## 5. Deduplication strategy alternatives

### Provider ID only

Fast and precise for one connection, but misses the same account linked twice,
provider ID churn, and file re-imports.

### Fingerprint only

Works across files/providers but identical legitimate transactions can share
date, amount, and description.

### Layered identity and candidate matching

**Recommendation.** Apply in order:

1. source idempotency key: provider + connection + external record ID + version;
2. file idempotency: file hash + row identity within a workspace/import mapping;
3. external-account identity to detect repeated bank links;
4. normalized fingerprint for duplicate **candidates**, not automatic deletion;
5. candidate match against manually posted ledger transactions by account,
   amount, direction, date window, and description similarity;
6. reviewer resolves ambiguous cases.

Automatic actions require high confidence and must retain the evidence. Two
equal charges at the same merchant can both be real.

## 6. Pending-to-posted and provider mutation

Never assume an external transaction ID is immutable across its lifecycle.
Adapters expose provider-neutral changes: added, modified, removed, and a link
from a final record to a pending predecessor when the provider offers it.

- Pending records may appear in the private inbox but should not be posted by
  default; wait for final posting unless the user explicitly accepts the risk.
- When pending becomes posted, supersede/link rather than show two rows.
- If amount/name changes before review, update the normalized version and show
  the change.
- If a confirmed provider record later changes or disappears, keep the ledger
  transaction and raise a discrepancy. The user can reverse/replace it through
  Ledger rules.

## 7. Custodian and raw-data visibility

Confirmed product rule: the connecting member reviews that connection's raw
pending records, and ordinary administrators see the transaction after it is
confirmed.

Recommended policy:

- custodian: read/review raw records for owned connection;
- delegated reviewer: optional explicit connection-level assignment;
- owner: sees connection health and counts but not raw descriptions by default;
- audited takeover: owner can transfer custody after explicit confirmation;
- after takeover, the new custodian gains review access; credentials remain
  server-side and are never shown;
- posted transaction visibility follows its financial account policy.

This balances the user's requested privacy with workspace recoverability. A
silent owner override would undermine the privacy promise; no recovery path
would strand sync when a custodian leaves.

### File imports

Recommendation: an import session is private to its uploader and explicitly
delegated reviewers until records are confirmed. This matches bank-inbox privacy
and avoids exposing raw statement rows. Workspace managers can see operational
metadata (session status/count/error) without descriptions. Confirmed/matched
transactions follow normal account policy.

## 8. Confirmation and matching flow

1. Adapter persists raw version and normalized record idempotently.
2. Policy checks custodian/delegated-reviewer access.
3. Reviewer selects target account, date, payee, category split, and tags, or a
   candidate existing transaction.
4. Application revalidates amount, workspace, account scope, and source version.
5. `match`: create one unique match link, no financial posting; or `confirm`:
   post one ledger journal and source link in the same transaction.
6. After commit, refresh projections and queue non-critical notifications.

Bulk confirmation is a sequence of independently idempotent items with a result
per row. One invalid record should not make 999 valid records impossible to
review, but “all-or-nothing” may be offered for small controlled batches.

## 9. Reconciliation alternatives

### Balance overwrite

Set Finwise account balance equal to the bank statement. Simple but destroys the
explanation of how the difference arose. Reject.

### Informational comparison only

Shows a difference but cannot produce an auditable corrected ledger.

### Checkpoint plus explicit adjustment

**Recommendation.** A reconciliation session records statement date, external
ending balance, calculated cleared balance, difference, reviewed items, actor,
and completion time. If the user accepts an unexplained difference, create an
explicit adjustment journal with a reason and link it to the checkpoint. Never
rewrite historical entry amounts or the account balance field.

Distinguish:

- cleared: evidence is verified or matched;
- reconciled: a period/account balance has been proven at a checkpoint;
- provider available/current balance: informational and may include pending
  activity under provider-specific rules.

## 10. Provider adapter contract

The application depends on a provider-neutral port returning validated unknown
data narrowed into internal types. A new bank provider implements:

- connect/refresh/revoke consent;
- list external accounts;
- incremental sync with opaque cursor;
- added/modified/removed records;
- provider health and retry classification.

Provider-specific SDK objects stop at the infrastructure boundary. Sync retries
use exponential backoff and idempotency; permanent consent/auth errors require
user action instead of endless retries.

## 11. Decisions still needing product-owner confirmation

1. Confirm private-by-uploader CSV/Excel sessions as recommended.
2. Confirm owner-visible operational metadata but no raw pending description.
3. Confirm explicit, audited custodian takeover and optional delegated reviewer.
4. Decide original file/payload retention duration and whether users can delete
   raw files after all records are resolved.
5. Decide whether provider-pending records may ever be manually confirmed before
   they post.

## 12. External design references

- [Plaid transaction states](https://plaid.com/docs/transactions/transactions-data/)
  for pending-to-posted replacement, changed amounts/descriptions, and later
  modified/removed provider records.
- [Plaid sync migration guide](https://plaid.com/docs/transactions/sync-migration/)
  for cursor-based added/modified/removed ingestion.
- [Plaid transaction troubleshooting](https://plaid.com/docs/transactions/troubleshooting/)
  for legitimate duplicate scenarios and repeated account connections.
