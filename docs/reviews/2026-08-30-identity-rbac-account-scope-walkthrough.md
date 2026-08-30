# Identity, RBAC, and account-scope slice — change walkthrough

Date: 2026-08-30  
Scope: custom role lifecycle, workspace member visibility, role assignment,
account access policy, access preview, and contract/e2e coverage

## Outcome

The Phase 2 slice now exposes server-side custom role and account-scope
operations on the existing workspace boundary. Owners can list active members,
list/create/update/delete non-protected roles, assign roles to members, update
account visibility, and preview the accounts visible to a member.

This slice intentionally does not claim the full Phase 2 exit: invitations,
membership acceptance/removal, owner transfer, workspace archive, Supabase OTP,
and production JWKS verification remain follow-up work.

## Business rules implemented

- Effective role permissions are allow-union permissions; owners bypass role
  checks so the workspace cannot be made unmanageable.
- The protected `Owner` role cannot be renamed, permission-edited, or deleted.
- Role names are unique case-insensitively within a workspace.
- Role permissions are validated against the typed Finwise permission catalog;
  unsupported permission strings are rejected at the application boundary.
- Role assignment is workspace-scoped and idempotent for an existing assignment.
- Account access policies support workspace default, exclude-selected,
  include-only, and owner-only modes plus member overrides.
- The owner cannot be hidden by a member-specific deny override.
- Access preview reuses the same account-list policy path used by normal reads;
  it does not expose hidden-account aggregates.

## Data flow

```text
HTTP role/access command
  -> FinwiseAuthGuard
  -> CoreController (route/body parsing)
  -> CoreService (role/access response mapping)
  -> CoreStorePort
  -> InMemoryFinwiseStore (membership, permission, scope invariants)
  -> typed response or FinwiseError envelope
```

The application layer remains framework-independent. Nest wiring constructs
`CoreService` through a factory and injects the `CoreStorePort` implementation;
the service does not import NestJS, Prisma, or HTTP types.

## API walkthrough

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/v1/workspaces/:workspaceId/members` | List active workspace members |
| `GET` | `/v1/workspaces/:workspaceId/roles` | List roles and sorted permissions |
| `POST` | `/v1/workspaces/:workspaceId/roles` | Create a custom role |
| `PATCH` | `/v1/workspaces/:workspaceId/roles/:roleId` | Update a non-protected role |
| `DELETE` | `/v1/workspaces/:workspaceId/roles/:roleId` | Delete an unassigned, non-protected role |
| `POST` | `/v1/workspaces/:workspaceId/members/:memberId/roles` | Assign a role to an active member |
| `POST` | `/v1/workspaces/:workspaceId/accounts/:accountId/access` | Update account visibility or member override |
| `GET` | `/v1/workspaces/:workspaceId/members/:memberId/access-preview` | Preview member-visible accounts |

Example role command:

```json
{
  "name": "Reviewer",
  "permissions": ["workspace.read", "transaction.read"]
}
```

Example account policy command:

```json
{
  "visibilityMode": "include_only",
  "memberId": "member-id",
  "allowed": true
}
```

## Files changed

- `backend/src/core/domain/ledger.types.ts` — typed permission catalog.
- `backend/src/core/application/core.ports.ts` — role/member/access port
  contracts.
- `backend/src/core/application/core.service.ts` — request parsing and public
  response mapping.
- `backend/src/core/infrastructure/in-memory-finwise.store.ts` — RBAC, role
  lifecycle, assignment, and account policy invariants.
- `backend/src/core/presentation/core.controller.ts` — HTTP routes.
- `backend/src/core/core.module.ts` — application-to-adapter factory wiring.
- `backend/test/app.e2e-spec.ts` — role, member, policy, and preview API flow.
- `backend/src/core/application/core.service.spec.ts` — protected-role and
  owner-visibility unit cases.
- `contracts/openapi.json` — first-slice role/member/access paths and schemas.

## Verification evidence

- Backend Prettier check: pass.
- Backend ESLint: pass.
- Backend TypeScript: pass.
- Backend unit tests: 7 passed.
- Backend e2e tests: 2 passed, including role/member/access-preview flow.
- Backend Nest build: pass.
- OpenAPI JSON check: pass.
- `git diff --check`: pass.

## Migration and security notes

- No database writes or migration deletion were performed. The in-memory
  adapter is test/development infrastructure only.
- PostgreSQL role/member/account-scope persistence must enforce the same
  workspace composite constraints and protected-owner invariant before pilot.
- A valid authenticated token still requires active workspace membership and
  capability; hidden resources return a visibility-safe not-found response.
- Production Supabase OTP/JWKS and invitation tokens are not part of this slice.

## Known gaps and next slice

1. Add invitation records with expiry, acceptance, replay protection, and
   membership removal/audit workflows.
2. Add owner-transfer initiate/accept/cancel with atomic ownership swap.
3. Replace in-memory role/access storage with Prisma repositories and database
   transactions after read-only migration preflight.
4. Add frontend administration screens once the generated API client replaces
   the current contract snapshot.
