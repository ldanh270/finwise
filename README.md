# Finwise

## Setup

Copy the backend environment template, fill in the Supabase connection values,
then install dependencies and generate the Prisma client:

```powershell
Copy-Item backend/.env.example backend/.env
pnpm setup
```

`pnpm setup` installs both applications with their lockfiles and runs
`pnpm db:generate`. It does not create or modify environment files.

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
```
