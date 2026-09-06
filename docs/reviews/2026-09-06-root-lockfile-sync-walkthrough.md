# Root lockfile sync walkthrough

## Scope and non-goals

This slice synchronizes the root pnpm lockfile with the backend dependency
manifest so Vercel's frozen install can resolve the current workspace. It does
not change application code, runtime behavior, database schema, or deployment
routing.

## Affected files and modules

- `pnpm-lock.yaml` now records `backend`'s direct `express@^5.2.1` dependency.

## Dependency data flow

`backend/package.json` is the dependency source, the root workspace lockfile is
the CI/Vercel installation contract, and `pnpm install --frozen-lockfile` checks
that their specifiers match before installing all five workspace projects.

## Compatibility and rollback

The change is additive and preserves the existing resolved Express package and
version. Rollback is a normal Git revert; no data migration or runtime contract
change is involved.

## Verification

- Regenerated with `pnpm install --lockfile-only --ignore-scripts --offline`.
- Confirmed the root lockfile contains the backend `express@^5.2.1` importer.
- A frozen install progressed past lockfile validation before the local package
  recreation was interrupted due to the workspace machine's resource limits.

## Known gaps and follow-up

The final proof is the next Vercel deployment, which uses its own clean Linux
build machine and should rerun `pnpm install --frozen-lockfile` from scratch.
