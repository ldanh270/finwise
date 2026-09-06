# Restore workspace lockfiles walkthrough

## Scope and non-goals

This slice restores the root pnpm workspace manifest and lockfile required by
GitHub Actions. Independently deployed web apps use npm lockfiles so Vercel can
install them without detecting nested pnpm workspaces. It does not change
application code, runtime behavior, database schema, or API routing.

## Affected files and modules

- `.gitignore` no longer ignores package-manager lockfiles.
- `pnpm-workspace.yaml` and `pnpm-lock.yaml` restore the root workspace
  installation contract, including direct backend dependencies.
- `backend/package-lock.json` and `frontend/package-lock.json` provide
  standalone npm installation contracts for Vercel's two app roots.

## CI data flow

GitHub checkout → tracked root workspace manifest and lockfile →
`actions/setup-node` pnpm cache lookup → frozen dependency installation. A
Vercel app-root checkout sees its own `package-lock.json` and selects npm.

## Compatibility and rollback

The change restores previously used package-manager metadata and makes the
lockfiles match the existing manifests. Rollback is a normal Git revert; no
data migration or runtime contract change is involved.

## Verification

- Root `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline` passed.
- Backend and frontend npm lockfiles were generated with lifecycle scripts
  disabled.
- `git diff --check` passed.

## Known gaps and follow-up

The GitHub Actions and Vercel runs must be rerun from a commit containing these
restored root and app lockfiles. The Node 20 deprecation and `punycode`
messages are warnings and are separate from the missing-lockfile failure.
