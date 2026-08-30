# Membership lifecycle walkthrough — 2026-08-30

## Scope

This slice completes the development-boundary membership workflows required
after the RBAC/account-scope slice:

- create, list, accept and revoke workspace invitations;
- remove an active non-owner member;
- initiate, target-accept and owner-cancel ownership transfer;
- archive a workspace through the current owner only.

It is intentionally an in-memory application slice. Production Supabase OTP,
email delivery, durable authorization audit, database row locks and
re-authentication are not included.

## Business rules

1. Invitation creation requires `membership.manage`, an active workspace and a
   bootstrapped internal target user. A duplicate active member or pending
   invitation is rejected.
2. Invitations expire after seven days and are terminally
   `accepted`, `revoked` or `expired`. Only the invited identity may accept.
3. Removing a member marks the membership `removed` and removes its active
   workspace lookup. The owner cannot be removed; ownership must be transferred
   first.
4. Only the current owner can initiate/cancel a transfer. The target must
   explicitly accept while the source owner and target membership remain active.
   Acceptance flips both owner flags and moves the protected Owner role in one
   in-memory operation.
5. Only the owner can archive a workspace. Archived workspaces reject financial
   writes and new invitations.

## Data flow

```text
authenticated actor
  -> CoreController route
  -> CoreService input validation/response mapping
  -> CoreStorePort membership operation
  -> in-memory invitation/member/transfer maps
  -> typed API response
```

The service depends only on `CoreStorePort`; no Nest, Prisma or provider SDK
types cross into the application/domain boundary.

## Domain/schema changes

- Added `InvitationStatus`, `OwnerTransferStatus`,
  `WorkspaceInvitationRecord` and `OwnerTransferRecord`.
- Added store indexes by invitation token and lifecycle maps for invitations and
  owner transfers.
- Kept Prisma migration untouched pending Phase 0 database preflight.

## API contract

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/v1/workspaces/:workspaceId/invitations` | Create invitation from `invitedUserId` and optional `roleId`. |
| GET | `/v1/workspaces/:workspaceId/invitations` | List invitations with refreshed expiry state. |
| POST | `/v1/invitations/:token/accept` | Accept as the invited actor and create active membership. |
| POST | `/v1/workspaces/:workspaceId/invitations/:invitationId/revoke` | Revoke pending invitation. |
| DELETE | `/v1/workspaces/:workspaceId/members/:memberId` | Remove non-owner active member. |
| POST | `/v1/workspaces/:workspaceId/owner-transfers` | Initiate target-accept transfer. |
| POST | `/v1/owner-transfers/:transferId/accept` | Target accepts transfer. |
| POST | `/v1/workspaces/:workspaceId/owner-transfers/:transferId/cancel` | Current owner cancels pending transfer. |
| POST | `/v1/workspaces/:workspaceId/archive` | Owner archives workspace. |

The hand-maintained OpenAPI snapshot includes request/response schemas and
stable `403`, `404` and `409` outcomes.

## Web/mobile behavior

No dedicated UI was added in this slice. The generated-client-ready API shape
supports a future member admin screen, invitation acceptance route and owner
transfer confirmation. Mobile consumes the same routes in Phase 8; it must keep
workspace cache partitioning and require online state for these workflows.

## Verification

- `prettier --check` (backend) — pass.
- ESLint (backend) — pass.
- TypeScript `tsc --noEmit` — pass.
- Backend unit suite — 10 tests pass, including invitation acceptance/removal,
  target-only ownership transfer and archive write blocking.
- OpenAPI contract check — pass.
- Nest build and e2e suite are rerun at the phase commit gate.

## Migration/security notes

Invitation tokens are opaque UUIDs and are returned only because this is a
development adapter; production must email a single-use token without logging
it. Authorization is checked in the store/use-case path, not inferred from
frontend navigation. Archived workspace writes are blocked server-side.

## Follow-ups / exit gap

- Replace in-memory maps with Prisma repositories after database preflight.
- Add Supabase JWKS/issuer/audience validation, OTP/SMTP and re-authentication.
- Add durable authorization audit and database uniqueness/locking for concurrent
  invitation and transfer commands.
- Add web admin screens and invitation email delivery.
