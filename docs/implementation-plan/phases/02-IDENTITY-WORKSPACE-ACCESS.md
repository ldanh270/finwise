# Phase 2 — Identity, workspace, and access

Status: In progress — development bootstrap/isolation slice landed; production auth/RBAC workflows pending  
Depends on: [Phase 1](01-PLATFORM-FOUNDATION.md), [auth/session architecture](../AUTH-SESSION-ARCHITECTURE.md)  
Unblocks: all workspace-owned features

## Objective

Provision verified identities into isolated workspaces and enforce custom RBAC
plus account/resource visibility on every API query and command.

## Business rules

- Supabase proves identity only. Verify JWT signature, issuer, audience, expiry,
  and subject in Nest; never use email as the identity key.
- Unique `(providerIssuer, providerSubject)` maps to one internal `User`.
- The first successful bootstrap creates one personal workspace, one owner
  membership, and one protected owner role atomically. Concurrent calls return
  the same result and cannot duplicate either resource.
- A workspace has exactly one active owner, is archived rather than hard-deleted,
  and rejects new financial writes while archived.
- Active roles grant the union of capabilities. No generic deny rules are
  introduced in MVP.
- Resource policy precedence is owner override, `owner_only`, member exclusion,
  member inclusion, role scope, then workspace default. A participant linked to
  a member does not gain permissions.
- Owner transfer requires current-owner initiation, recent re-authentication,
  target acceptance, one atomic owner swap, and an audit record. Only owner may
  archive in MVP.

## Data flow

```text
Supabase token -> Nest verifier -> ExternalIdentity/User lookup or provision
                -> membership/workspace bootstrap -> policy context
                -> command/query use case -> scoped repository -> response
```

Every repository method requires a trusted `workspaceId` and actor policy
context. Hidden accounts are filtered before aggregation, export, notification,
search, or chart calculation.

## Schema and API surface

Add workspace-scoped models: `User`, `ExternalIdentity`, `Workspace`,
`Membership`, `Role`, `Permission`, role-permission and membership-role joins,
`Invitation`, account/resource visibility policy and member exceptions, and
authorization audit entries. Include status/version/timestamps and composite
tenant foreign keys where supported. Keep provider tokens/secrets outside the
database.

Expose at minimum:

- `GET /v1/session/bootstrap`;
- workspace list/create/update/archive/switch context;
- member list/invite/accept/remove and role assignment;
- role/permission read/create/update/delete with owner-role protections;
- account-access policy update and “preview access as member”;
- owner-transfer initiate/accept/cancel;
- typed `401`, `403`, membership, rate-limit, and provisioning errors.

## Client behavior

Web implements OTP request/code screens, session proxy/refresh, protected
layouts, workspace switcher, member/role/account-visibility administration,
denied and partial-data states. It never treats hidden navigation as security.
The generated client is prepared for mobile; mobile auth/session adapter and
secure storage are delivered in Phase 8, but bootstrap response shape must stay
platform-neutral.

## Test matrix

| Area | Required cases |
| --- | --- |
| Identity | first login, mutable email, duplicate provider subject, concurrent bootstrap |
| Auth | invalid issuer/audience/signature/expiry, missing token, refresh once |
| Tenant | cross-workspace ID/reference/query rejection, removed membership |
| RBAC | multi-role union, protected owner role, role mutation audit |
| Account scope | owner-only, include/exclude precedence, hidden aggregate/count/export leaks |
| Workflow | invite expiry/replay, owner transfer acceptance/atomicity, archive blocking |
| API/UI | `401` vs `403`, loading/empty/denied/partial and safe generic auth errors |

## Migration notes

Do not infer internal users from the old `externalAuthUserId` field without a
provider/subject migration map. If existing identities are real, preserve the
original provider subject and create `ExternalIdentity` rows transactionally.
Seed exactly one protected owner role per workspace; use explicit repair tooling
for malformed legacy memberships, never a request-time silent fix.

## Exit criteria

- OTP login to bootstrap returns one stable user and personal workspace.
- All workspace routes enforce membership and resource policy server-side.
- Role/account scope changes are audited and hidden data cannot leak through
  reports or aggregates.
- Ownership transfer and archive workflows have passing atomicity tests.

## First-slice evidence

`backend/src/auth` now provides a development token boundary and
`GET /v1/session/bootstrap` provisions one internal user plus one personal
workspace through an in-memory adapter. Production Supabase JWKS validation,
OTP UI, invitations, custom role CRUD, and owner transfer are intentionally
left for the remainder of this phase.
