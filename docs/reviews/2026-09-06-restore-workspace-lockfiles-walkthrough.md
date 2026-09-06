# Restore workspace lockfiles walkthrough

## Scope and non-goals

This slice restores the pnpm workspace manifests and lockfiles required by
GitHub Actions and keeps each workspace lockfile synchronized with its package
manifest. It does not change application code, runtime behavior, database
schema, or Vercel routing.

## Affected files and modules

- `.gitignore` no longer ignores package-manager lockfiles.
- `pnpm-workspace.yaml` and `pnpm-lock.yaml` restore the root workspace
  installation contract.
- `backend/pnpm-workspace.yaml` and `backend/pnpm-lock.yaml` restore the
  backend standalone installation contract, including direct
  `class-transformer`, `class-validator`, and `express` dependencies.
- `frontend/pnpm-workspace.yaml` and `frontend/pnpm-lock.yaml` restore the
  frontend standalone installation contract, including direct `prettier`.

## CI data flow

GitHub checkout → tracked workspace manifest and lockfile →
`actions/setup-node` pnpm cache lookup → frozen dependency installation. The
cache step can now find the root `pnpm-lock.yaml`, and each nested project also
has a valid lockfile when deployed from that directory.

## Compatibility and rollback

The change restores previously used package-manager metadata and makes the
lockfiles match the existing manifests. Rollback is a normal Git revert; no
data migration or runtime contract change is involved.

## Verification

- Root `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline` passed.
- Standalone backend frozen-lockfile validation passed.
- Standalone frontend frozen-lockfile validation passed after adding
  `prettier@^3.4.2` to its importer.
- `git diff --check` passed.

## Known gaps and follow-up

The GitHub Actions run must be rerun from a commit containing these restored
files. The Node 20 deprecation and `punycode` messages are warnings and are
separate from the missing-lockfile failure.
