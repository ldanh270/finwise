# Mobile logout data cleanup walkthrough

## Scope and non-goals

This slice closes the local-data cleanup gap during mobile logout. Once the
existing draft policy confirms every workspace draft is synced, exported, or
discarded, all SQLite key/value records for the authenticated user are removed.
It does not delete server data, change JWT rotation, erase another user's
partition, or silently discard unresolved drafts.

## Affected files and modules

- `mobile/src/sync/outbox-persistence.ts` — focused prefix-storage port.
- `mobile/src/sync/sqlite-storage.ts` — parameterized, escaped prefix delete.
- `mobile/src/session/clear-user-data.ts` — user partition prefix and cleanup
  use case.
- `mobile/src/session/clear-user-data.spec.ts` — preservation/isolation tests.
- `mobile/app/(app)/settings.tsx` — cleanup-before-sign-out workflow.
- `mobile/app/(app)/_layout.tsx` and `mobile/src/ui/app-lock-gate.tsx` — the
  biometric password-recovery path uses the same cleanup boundary and supports
  async recovery errors.
- `mobile/src/index.ts` — public mobile boundary export.
- `docs/implementation-plan/README.md` and Phase 8 — delivery record.

## Business rules and data flow

The logout path is now:

```text
logout request
  -> inspect every accessible workspace outbox
  -> block until sync/export/discard is explicit
  -> delete finwise-cache:<encoded-user>:* SQLite keys
  -> clear SecureStore session and sign out
```

The prefix covers cached overview/accounts/transactions/budgets, outbox
snapshots, and staged receipt metadata for every workspace. A user-specific
prefix and parameterized SQL prevent cross-user deletion; wildcard characters
in the prefix are escaped for SQLite `LIKE` matching.

## Public API and UI behavior

No server endpoint changes. Settings keeps the existing pending-draft warning.
When cleanup succeeds, logout continues normally. If local cleanup or the
session clear fails, the user remains signed in and sees a retryable message
rather than a misleading signed-out state with data left behind. Biometric
password recovery follows this same path.

## Migration and security implications

- No PostgreSQL/Prisma migration is required; the local `finwise_kv` table is
  cleaned in place.
- Confirmed financial data remains server-owned and is never reconstructed from
  the deleted cache.
- Cleanup removes only keys beginning with the normalized, URL-encoded user
  partition prefix. Another user/workspace cannot be selected by input.
- Unresolved drafts are protected by the pre-existing sync/export/discard gate;
  this change does not weaken recovery or auditability.

## Verification

- `pnpm --filter mobile test -- --runInBand` — 14 suites, 47 tests passed.
- `pnpm --filter mobile typecheck` — passed.
- `pnpm format:check` — backend, frontend, and mobile checks passed.
- `git diff --check` — passed.

## Known gaps and follow-up

- Add a native SQLite integration test that executes `removeByPrefix` on an
  actual Expo database; the current unit test uses a deterministic in-memory
  prefix adapter because Jest does not load Expo's native ESM module.
- Validate receipt file removal policy separately when server-authorized upload
  and app-private copied files are introduced.

## Commit message

```text
fix(mobile): clear user partitions on logout

Remove cached reads, outbox snapshots, and staged receipt metadata after the
pending-draft logout gate passes, preserving per-user isolation and refusing
to claim logout when local cleanup fails.
```
