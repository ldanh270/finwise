# Finwise

Finwise is a VND-first, multi-workspace money-management application. The
Next.js web client and Expo React Native client use the NestJS `/v1` API;
financial truth and authorization never live in the clients.

The repository is organized as a pnpm workspace for local development.
`backend/` and `frontend/` are independently installable Node applications, so
the API can be built and run on a server with npm alone. `packages/` contains
transport-only shared packages, and `docs/` is the product/domain source of
truth.

The current implementation covers custom JWT authentication, personal/shared
workspaces, VND exact-money accounts and immutable journals, budgets, Group
Treasury, CSV ingestion/reconciliation, permission-aware web screens, and a
mobile online path with SecureStore sessions, workspace-scoped SQLite cache,
and controlled offline income/expense drafts. Manual loan/payment and investment
trade/valuation APIs are also available behind the shared client. The remaining
production gates are normalized Prisma persistence and provider/device
operations (especially bank-provider selection, iOS signing, and physical-device
tests), not another mobile scaffold. The roadmap remains tracked in
[`docs/implementation-plan/README.md`](docs/implementation-plan/README.md).

## Setup

Copy the backend environment template, fill in the PostgreSQL-compatible
connection values,
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

### Server install (npm, no pnpm required)

The backend has its own `package.json` and can be deployed independently. On a
build or runtime server, run these commands from the repository root:

```powershell
npm run server:install
npm run server:build
npm run server:db:deploy
npm run server:start
```

The equivalent commands from `backend/` are `npm install`, `npm run build`,
`npm run db:deploy`, and `npm run start:prod`. `npm install` is intentional:
the pnpm workspace lockfile is for local workspace/mobile development, while
the server lane must not require pnpm or Corepack.

## Development

```powershell
pnpm dev             # frontend :3000 and backend :3001
pnpm dev:frontend
pnpm dev:backend
```

After installing `backend/` and `frontend/` with npm, the combined runner also
works without pnpm:

```powershell
npm run dev
```

The runner detects the package manager that launched it. `pnpm dev` keeps the
workspace filters; `npm run dev` invokes `npm --prefix backend|frontend`.

For a phone smoke test with Expo Go, run `pnpm dev:mobile:go` and scan the full
QR shown in the terminal. `pnpm dev:mobile:go:offline` skips Expo's remote
version check when the CLI cannot reach the network. The phone and computer
must share a Wi-Fi network; set `mobile/.env` to the computer's LAN API URL.

Override the combined-dev ports with `FRONTEND_PORT` and `BACKEND_PORT` when
needed.

If the runner reports an occupied port, inspect only the configured dev ports
and stop the owning process when it is a stale Finwise process:

```powershell
netstat -ano | Select-String ':3000|:3001'
taskkill /PID <pid-from-netstat> /T /F
```

The preflight does not terminate arbitrary processes automatically.

## Database

```powershell
pnpm db:generate
pnpm db:validate
pnpm db:status
pnpm db:migrate -- --name add_transactions  # local development; replace the name
pnpm db:migrate:create -- --name add_transactions
pnpm db:seed                             # idempotent demo data
pnpm db:studio
pnpm db:pull                             # introspect an existing database
pnpm db:format
pnpm db:reset                            # destructive; development only
```

All backend database scripts are also npm-compatible. For CI/staging/
production use `npm run db:deploy` (or `npm run server:db:deploy`) so no pnpm
binary is required.

Use `DIRECT_URL` for Prisma CLI migrations and `DATABASE_URL` for the backend
runtime connection. The current provider is `cockroachdb` because the configured
cloud endpoint is CockroachDB-compatible. Prisma 7's Windows CLI schema engine
may require Linux CI plus the CockroachDB CA certificate for cloud migrations.
The demo seed refuses to run when `NODE_ENV=production` unless
`ALLOW_DEMO_SEED=true` is explicitly set.

## Quality checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm contracts:check
```

For a server-only quality gate, use `npm run lint`, `npm run server:typecheck`,
`npm run server:test`, and `npm run build`. Full workspace checks still include
the Expo mobile package and therefore remain pnpm commands.
