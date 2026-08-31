# Database migration preflight walkthrough — 2026-08-31

## Scope

This Phase 0 slice adds a read-only database preflight command. It discovers a
usable `DATABASE_URL` from the environment or backend `.env`, refuses known
placeholder/local fallback credentials, and when configured runs a read-only
transaction that reports database identity, table metadata, and estimated row
presence.

## Non-goals

- No migration, reset, schema replacement, write, or data transformation is
  performed.
- PostgreSQL estimates are evidence only; they do not classify demo versus real
  user data automatically.
- The command does not print credentials or inspect row payloads.

## Affected files and modules

- `scripts/database-preflight.mjs` — read-only inspection and safe result
  states with sanitized failure diagnostics.
- `package.json` — `db:preflight` convenience command.
- Phase 0/index docs and this walkthrough.

## Business rules

- Placeholder Supabase passwords and the local fallback URL are treated as
  not configured.
- Configured inspection uses `BEGIN READ ONLY`, catalog metadata only, and
  always attempts rollback/connection close.
- `READY` evidence with estimated data requires owner review before any
  baseline decision; the script never chooses rebaseline automatically.

## Data flow

```text
DATABASE_URL/env file -> placeholder guard
                      -> read-only PostgreSQL metadata
                      -> READY / NOT_CONFIGURED / FAILED report
```

## Public API and UI behavior

No HTTP or UI behavior changed. Operators can run `pnpm db:preflight` before
Phase 1 migration work and archive its JSON output with the release evidence.

## Migration and security implications

The command is intentionally non-destructive and does not expose connection
strings. It is safe to run against a candidate environment, but production
credentials must still be handled by the operator's secret store and shell.

## Verification

- Placeholder `.env` preflight: passed with `NOT_CONFIGURED` and no connection.
- Node preflight tests: passed; configured connection failures expose only a
  bounded error code and never the raw driver message.
- Repository `git diff --check`: passed.
- No migration/reset command was invoked.

## Known gaps and follow-up

1. Run with a real read-only credential and attach output to the migration
   decision log.
2. Compare table estimates with an owner-reviewed demo/user-data inventory.
3. Add CI artifact retention and a preserving migration map if data exists.

## Commit message

`feat(platform): add read-only database preflight`

The body should mention placeholder detection, read-only catalog inspection,
and the fact that no automatic migration decision is made.
