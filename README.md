# Finwise

Finwise is a VND-first, multi-workspace money-management application. The
Next.js web client and future React Native client use the NestJS `/v1` API;
financial truth and authorization never live in the clients.

The repository is organized as a pnpm workspace. `backend/` owns the modular
NestJS API, `frontend/` owns the Next.js web experience, `packages/` contains
transport-only shared packages, and `docs/` is the product/domain source of
truth.

The current implementation slice covers development-auth bootstrap, personal
and shared-workspace boundaries, VND exact-money accounts, opening balances,
income/expense/transfer journals, idempotent commands, void-by-reversal, audit
history, custom RBAC/account scope, and a responsive web dashboard shell. The
remaining MVP contexts (workspace persistence, password recovery/MFA,
PostgreSQL repositories/migrations, budgets,
Group Treasury, CSV reconciliation, and the pilot hardening gate) remain
tracked in [`docs/implementation-plan/README.md`](docs/implementation-plan/README.md).

## Setup

Copy the backend environment template, fill in the PostgreSQL connection values,
then install dependencies and generate the Prisma client:

```powershell
Copy-Item backend/.env.example backend/.env
pnpm setup
```

`pnpm setup` installs all workspace packages and runs `pnpm db:generate`. It
does not create or modify environment files.

Generate a local RSA signing pair for custom JWT sessions and copy the printed
values into `backend/.env`:

```powershell
node scripts/generate-jwt-keys.mjs
```

## Development

```powershell
pnpm dev             # frontend :3000 and backend :3001
pnpm dev:frontend
pnpm dev:backend
```

Override the combined-dev ports with `FRONTEND_PORT` and `BACKEND_PORT` when
needed.

## Database

```powershell
pnpm db:generate
pnpm db:validate
pnpm db:status
pnpm db:migrate --name add_transactions  # local development; replace the name
pnpm db:migrate:create --name add_transactions
pnpm db:deploy                           # CI/staging/production
pnpm db:seed                             # idempotent demo data
pnpm db:studio
pnpm db:pull                             # introspect an existing database
pnpm db:format
pnpm db:reset                            # destructive; development only
```

Use `DIRECT_URL` for Prisma CLI migrations and `DATABASE_URL` for the backend
runtime connection. The demo seed refuses to run when `NODE_ENV=production`
unless `ALLOW_DEMO_SEED=true` is explicitly set.

## Quality checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm contracts:check
```
