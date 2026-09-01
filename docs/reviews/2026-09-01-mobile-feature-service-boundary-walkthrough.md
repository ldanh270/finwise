# Mobile feature-service boundary walkthrough — 2026-09-01

## Scope and non-goals

This slice moves mobile transport orchestration out of Expo route files and
into bounded-context services under `mobile/src/features`. Routes keep React
state, validation, rendering, navigation, and cache invalidation while the
services own calls to the shared `FinwiseApiClient`. There is no HTTP, schema,
ledger, or user-visible behavior change in this slice.

## Affected files

- `mobile/src/features/overview/overview-service.ts` — overview and balance
  reads.
- `mobile/src/features/ledger/ledger-service.ts` — account, opening-balance,
  transaction, void, and CSV export operations.
- `mobile/src/features/planning/budget-service.ts` — category, tag, budget,
  period, and close operations.
- `mobile/src/features/group/group-service.ts` — Group Treasury reads and
  commands.
- `mobile/src/features/ingestion/ingestion-service.ts` — CSV and
  reconciliation reads and commands.
- `mobile/app/(app)/*.tsx` — route composition now calls feature services
  instead of the API client directly.
- `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md` and
  `progress.md` — architecture delivery record.

## Business rules and data flow

The dependency direction is now explicit:

```text
Expo route (UI state/navigation)
        -> mobile feature service (transport boundary)
        -> @finwise/api-client
        -> Nest /v1 API
```

The services do not calculate money, authorize work, or mutate cache state.
They preserve exact Money DTOs, idempotency keys, and the trusted workspace ID
passed by the route. Domain and authorization rules remain server-owned.

## Public API and UI behavior

No public contract changed. Existing overview, account, ledger, budget, group,
CSV, and reconciliation requests use the same paths and payloads. Mobile users
see the same forms, loading/error/empty states, offline draft behavior, and
post-mutation invalidation as before.

## Migration and security implications

No database migration or native configuration change. The service layer does
not store tokens; the authenticated client still receives its token through
the existing SecureStore-backed context. Workspace IDs remain explicit at the
boundary, preventing a global API singleton from accidentally crossing scopes.

## Verification

- `pnpm lint` — pass.
- `pnpm --filter mobile format:check` — pass.
- `pnpm typecheck` — pass for all TypeScript projects.
- `pnpm test:mobile` — pass (7 suites, 28 tests).
- `pnpm test:e2e` — pass (4 API journeys).
- `pnpm build` — pass for NestJS and Next.js.
- `pnpm --filter mobile export:android` — pass (976 modules, Hermes bundle).
- `pnpm --filter mobile export:ios` — pass (979 modules, Hermes bundle).
- `Select-String` audit — no direct `api.*` calls remain under
  `mobile/app`; auth/bootstrap calls remain in their intended `mobile/src`
  boundaries.

## Known gaps and follow-up

Routes still own screen-level query/mutation state and cache invalidation;
extracting reusable query hooks is a future refactor only if multiple screens
need the same lifecycle. Physical-device process-death/network tests and
macOS iOS native compilation/signing remain release gates.

## Commit message

```text
refactor(mobile): isolate feature transport services

Move API orchestration behind bounded-context services so Expo routes remain
focused on presentation, navigation, and state while preserving contracts.
```
