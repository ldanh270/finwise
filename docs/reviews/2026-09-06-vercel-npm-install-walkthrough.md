# Vercel npm install walkthrough

## Scope and non-goals

This slice makes Vercel use npm for root, backend-root, and frontend-root
deployments. It does not change application code, financial behavior, database
schema, or API routing.

## Affected files and modules

- `vercel.json` overrides installation for a monorepo deployment.
- `backend/vercel.json` overrides installation and keeps the Nest serverless
  entrypoint when the Vercel Root Directory is `backend/`.
- `frontend/vercel.json` overrides installation when the Root Directory is
  `frontend/`.

## Deployment data flow

Vercel Root Directory → matching `vercel.json` → npm installs the selected
application dependencies with lifecycle scripts disabled → existing Vercel
builder runs. The explicit `installCommand` prevents pnpm lockfile detection
from selecting `pnpm install --frozen-lockfile`.

## Compatibility and rollback

This is deployment configuration only. The local and GitHub Actions pnpm
workflow remains supported by the tracked workspace lockfiles. Rollback is a
normal Git revert; no data migration or runtime contract change is involved.

## Verification

- Validated all three Vercel configuration files as JSON.
- Confirmed the backend and frontend npm install commands work with
  `--ignore-scripts` and `--no-package-lock`.
- Root, backend, and frontend frozen-lockfile checks pass as a fallback when
  Vercel or CI runs pnpm outside the override.

## Known gaps and follow-up

The next deployment must be made from a commit containing these files. Its log
should show the explicit npm install command rather than Vercel's automatic
`pnpm install` command.
