# Root pnpm workspace install-policy walkthrough

Date: 2026-08-31
Phase: 1 — Platform foundation
Status: Implemented

## Scope and non-goals

The root workspace now carries the dependency safety settings that were left
behind when the backend moved from its standalone pnpm workspace. The lockfile
was regenerated to include the existing mobile package importer, and the
single newly published transitive package that is already present in the
reviewed lockfile (`ignore@7.0.7`) is explicitly excluded from the minimum
release-age check.

This does not disable supply-chain verification globally, upgrade unrelated
dependencies, or claim that native Expo builds are available on every host.

## Affected files and modules

- `pnpm-workspace.yaml` — root `allowBuilds`, module-purge behavior, and the
  narrowly scoped release-age exclusion.
- `pnpm-lock.yaml` — deterministic importer/resolution entries for the mobile
  workspace package.
- `docs/implementation-plan/README.md` and
  `docs/implementation-plan/phases/01-PLATFORM-FOUNDATION.md` — delivery
  record and review index.

## Business rules

- Root installs must evaluate the same minimum-release-age policy as the
  former backend workspace; only explicitly reviewed package coordinates may be
  excluded.
- The lockfile must describe every package selected by `pnpm-workspace.yaml`,
  including mobile, so frozen CI installs cannot silently use a stale graph.
- Prisma and SWC build scripts remain explicitly allowed at the workspace
  boundary; application code does not gain permission to execute arbitrary
  dependency scripts.

## Data flow

```text
pnpm-workspace.yaml + package manifests
        -> policy verification for every lockfile entry
        -> mobile importer resolution
        -> node_modules link/install state
        -> root dev/build commands
```

## Public API and UI behavior

No HTTP, generated-client, web, or mobile UI behavior changed. The operator
workflow is now consistent: root `pnpm install` can validate the reviewed
lockfile, and `pnpm dev` can reach the backend/frontend scripts after the
workspace dependencies are linked.

## Migration and security implications

No database migration or financial data change. The exception is exact and
auditable rather than a global `trust-lockfile` bypass. The lockfile still
passes the policy verifier and retains integrity metadata for all 1,501
entries. Once `ignore@7.0.7` is older than the configured release-age window,
the exception can be removed in a follow-up cleanup.

## Verification

- `pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts`: passed;
  lockfile regenerated and policy verification passed for 1,119 entries.
- `pnpm install --offline --frozen-lockfile --ignore-scripts`: policy passed;
  the first run correctly reported the stale mobile importer before lockfile
  regeneration.
- `pnpm --filter backend install --frozen-lockfile --ignore-scripts`: passed.
- `pnpm --filter frontend install --frozen-lockfile --ignore-scripts`: passed.
- `pnpm --filter mobile install --frozen-lockfile --ignore-scripts`: passed.
- Root `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`: passed;
  lint reports one pre-existing warning and zero errors.
- `git diff --check`: passed.
- `git status --short`: only the intended workspace/config and review files are
  changed.

## Known gaps and follow-up

1. Finish a full clean install on a host with sufficient Windows filesystem
   throughput, then run root `pnpm build`, `pnpm lint`, `pnpm typecheck`, and
   `pnpm test` from the fresh workspace.
2. Remove the `ignore@7.0.7` exception after the package naturally clears the
   minimum-release-age window, or pin a reviewed older version if policy
   requires a permanently reproducible graph.
3. Keep Expo native toolchain verification as the Phase 8 device/build gate.

## Commit message

```text
fix(platform): repair root pnpm workspace install policy

Carry dependency safety settings to the root workspace and regenerate the
lockfile with the mobile importer so frozen installs validate consistently.
```
