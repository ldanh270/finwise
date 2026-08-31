# Mobile manual-draft sync walkthrough — 2026-08-31

## Scope

This slice adds the online sync coordinator for the mobile manual
income/expense outbox. A queued draft transitions through `SYNCING`, posts via
an injected provider-neutral port with its stable `clientCommandId` as the
idempotency key, and records the server transaction ID only after success.

## Non-goals

- Expo native runtime, SQLite persistence, and SecureStore session wiring are
  still deferred because mobile dependencies/device builds are not available
  in this workspace.
- Transfer, correction, approval, import, and reconciliation commands remain
  online-only and are not accepted by this outbox.
- The outbox never calculates or mutates a confirmed balance locally.

## Affected files and modules

- `mobile/src/sync/outbox.ts` — `ManualDraftSyncPort`, sync orchestration, and
  failure classification.
- `mobile/src/sync/outbox.spec.ts` — success, retry, conflict, and stable-key
  coverage.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` — delivered
  online sync evidence and remaining device gates.
- `docs/implementation-plan/README.md` — walkthrough index link.

## Business rules

- `clientCommandId` is stable across every retry and is sent as
  `Idempotency-Key`; a new key is never generated during sync.
- Successful server acknowledgement is the only transition to `SYNCED`.
- Network/unknown failures become `RETRYABLE_FAILURE` and increment attempts.
- Conflict, validation, permission, membership, and idempotency failures become
  `NEEDS_USER_ACTION` so the app cannot silently replay an ambiguous command.
- A queued draft is not a confirmed transaction and cannot affect local balance
  projections.

## Data flow

```text
LOCAL_DRAFT -> QUEUED -> SYNCING
                         |-- success -> SYNCED(serverTransactionId)
                         |-- transient error -> RETRYABLE_FAILURE
                         `-- business/conflict error -> NEEDS_USER_ACTION
```

## Public API and UI behavior

The sync coordinator consumes `ManualDraftSyncPort`, which maps to the shared
Nest manual transaction command at the app edge. No UI was changed; a future
mobile screen can render each state and gate logout from `canLogout`.

## Migration and security implications

No migration is added. The production adapter must persist the outbox row and
command payload atomically (SQLite), partition it by user/workspace, and avoid
logging tokens or financial payloads. Server idempotency remains authoritative;
the client state machine is not a substitute for server uniqueness.

## Verification

- Mobile Prettier check: passed.
- Mobile TypeScript check with backend type roots: passed.
- Mobile Jest suite: passed (4 tests).

## Known gaps and follow-up

1. Add a SQLite-backed `OutboxStore` with process-restart recovery and
   explicit sync queue locking.
2. Adapt the shared generated client and Supabase SecureStore session to this
   port.
3. Verify process death, weak network, logout protection, and duplicate retry
   behavior on physical iOS/Android development builds.

## Commit message

`feat(mobile): add idempotent manual draft sync`

The body should mention stable command IDs, retry/actionable failure states,
and the deferred SQLite/device verification gates.
