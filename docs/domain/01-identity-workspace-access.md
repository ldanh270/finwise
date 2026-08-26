# Identity, workspace, and access-control domain

Status: Proposed, except requirements already marked Confirmed in the SRS  
Last updated: 2026-08-26

## 1. Business purpose

Identity proves who a person is. Workspace defines whose financial book is
being operated. Access control decides what that authenticated person may do to
a specific resource in that workspace. These are related but different rules.

## 2. Workspace model alternatives

### Option A: separate PersonalWorkspace and GroupWorkspace models

Advantages:

- onboarding and UI labels are explicit;
- group-only fields can be attached directly to the group model.

Disadvantages:

- accounts, transactions, budgets, imports, and reports need duplicate foreign
  keys or polymorphic logic;
- a personal workspace cannot naturally become shared;
- code tends to branch on workspace type instead of permissions/capabilities.

### Option B: one Workspace model with a strict `type` controlling behavior

Advantages:

- one tenant key and less persistence duplication;
- easier than two independent models.

Disadvantages:

- `if personal / if family / if class` conditionals spread through services;
- real groups do not fit one fixed workflow: a family may allow direct posting
  while a class fund may require treasurer approval.

### Option C: one Workspace boundary with intent and enabled capabilities

`kind` or an onboarding template may be `personal`, `family`, `class_fund`, or
`other`, but it selects defaults and labels rather than hard-coded financial
rules. Membership, permissions, and enabled modules determine actual behavior.

Advantages:

- one consistent tenant model;
- workflows adapt to the group's governance;
- templates improve onboarding without becoming permanent constraints.

Disadvantages:

- capability combinations and permission presets must be validated;
- UI cannot assume behavior from a single workspace-type enum.

**Recommendation: Option C.** Workspace kind is descriptive and may select a
default template. It must not be used as an authorization decision.

## 3. Aggregates and lifecycle

### Workspace aggregate

Owns:

- identity, name, timezone, default currency, lifecycle status;
- exactly one current `ownerMembershipId`;
- enabled domain capabilities and onboarding intent;
- archive state.

Important invariants:

1. Exactly one active member is the owner.
2. Currency is VND for MVP.
3. A workspace with financial history is archived, not hard-deleted.
4. Archiving blocks new financial writes but preserves permitted read/export.

### Membership aggregate

Owns a user's relationship to one workspace, status, joined/left timestamps,
assigned roles, and member-specific access exceptions. Removing a member
revokes access but never removes their historical actor/submission references.

### Role aggregate

Owns a workspace-scoped role name and permission set. Names such as Treasurer,
Member, and Viewer are templates, not hard-coded logic. The protected Owner role
cannot be deleted or stripped of required management permissions.

### Participant

Participant does **not** belong to this authorization model. It lives in Group
Treasury and can optionally link to a membership. A participant never receives
API permissions simply because it is linked to a user.

## 4. Authorization model alternatives

### Option A: fixed roles only

Advantages: very simple UI, queries, and tests.  
Disadvantages: cannot represent the requested custom governance; role names
become scattered conditionals; exceptions require code releases.

### Option B: arbitrary per-user permissions and ACLs only

Advantages: maximum flexibility.  
Disadvantages: difficult to explain, audit, reuse, and migrate; two similar
members can silently have different powers; administration becomes error-prone.

### Option C: custom RBAC plus resource policies

Roles grant reusable capabilities such as `transaction.read` or
`transaction.post`. Account visibility and bank-custodian ownership are then
evaluated as resource-specific policies.

Advantages:

- matches custom roles and multiple roles;
- stable permission vocabulary can map directly to use cases/APIs;
- handles “may read transactions, but not this account/raw bank inbox.”

Disadvantages:

- policy evaluation needs one central, testable implementation;
- denial reasons and report filtering require care.

**Recommendation: Option C.** A request is allowed only when all required gates
pass:

```text
authenticated
AND active workspace membership
AND required capability from active roles
AND resource scope permits the object
AND business-state rule permits the action
```

The backend derives the actor and workspace from trusted authentication/route
context. It never trusts a client-supplied role, actor ID, or balance.

## 5. Permission design

Permissions should name business actions, not pages or HTTP verbs. Recommended
examples:

| Area | Example permissions |
| --- | --- |
| Workspace | `workspace.read`, `workspace.update`, `workspace.archive` |
| Membership | `member.invite`, `member.read`, `member.manage_roles`, `member.remove` |
| Roles | `role.read`, `role.create`, `role.update`, `role.delete` |
| Accounts | `account.read`, `account.create`, `account.update`, `account.reconcile` |
| Transactions | `transaction.read`, `transaction.submit`, `transaction.post`, `transaction.reverse` |
| Budgets | `budget.read`, `budget.manage` |
| Imports | `import.create`, `import.review`, `bank_connection.manage` |
| Group | `collection.manage`, `contribution.submit`, `claim.submit`, `claim.approve`, `reimbursement.post` |
| Reports | `report.read`, `report.export` |

Avoid one generic `manage_everything` permission in custom roles. Owner can be
represented by a protected policy override plus the complete required set.

## 6. Multiple roles and explicit deny

### Alternative 1: allow-union only

Effective capabilities are the union of permissions in all active roles.

- Pros: predictable; easy to explain and cache.
- Cons: cannot express a negative exception inside a broadly allowed role.

### Alternative 2: role allow plus arbitrary deny

- Pros: highly expressive.
- Cons: precedence is hard to reason about; a member can lose access through a
  distant role change; support/debugging becomes difficult.

**Recommendation:** use allow-union for capabilities. Do not introduce generic
permission denies in MVP. The requested account hiding is a typed resource
policy, not a generic deny mechanism.

## 7. Account-access policy

Supported modes are already confirmed:

- `workspace_default`;
- `exclude_selected`;
- `include_only`;
- `owner_only`.

Recommended evaluation precedence:

1. protected owner is always permitted;
2. `owner_only` denies every non-owner;
3. a member-specific exclusion denies that member;
4. a member-specific inclusion permits the member in `include_only` mode;
5. role-based inclusion/exclusion is evaluated across active roles;
6. otherwise apply the account's workspace default.

This precedence makes an explicit member exception stronger than a broad role.
Because this is a security rule, the product must show administrators a
“preview access as member” explanation rather than only checkboxes.

Scope applies consistently to account details, transactions, search, reports,
budgets, exports, notifications, dashboard totals, net worth, and both ends of a
transfer. Hidden values must not leak through aggregates or counts.

## 8. Ownership transfer

Alternatives:

| Approach | Benefit | Risk |
| --- | --- | --- |
| Owner cannot transfer | Simplest invariant | Workspace becomes stranded |
| Admin can promote another owner at any time | Recoverable | Privilege escalation and conflicting owners |
| Guarded atomic transfer | Preserves exactly one owner and supports recovery | Requires a dedicated workflow |

**Recommendation: guarded atomic transfer.** Only the current owner initiates a
normal transfer to an active member; require recent re-authentication, explicit
acceptance by the target, and an atomic swap. Record actor, old/new owner, time,
and reason. A platform support recovery path is separate, highly audited, and
must not reveal bank credentials.

## 9. Data and security enforcement

- Every repository query accepts a trusted `WorkspaceId`; no “find by ID then
  hope the controller checked the tenant” path.
- Use composite uniqueness/foreign-key constraints containing `workspace_id`
  where practical.
- PostgreSQL row-level security may be added as defense in depth, but it does
  not replace application policies and is risky if connection/session context
  is misconfigured.
- Authorization is deny-by-default and evaluated on every command/query.
- Cache effective role permissions only with an invalidation/version strategy.
- Audit membership, role, owner, account-scope, and bank-custodian changes.

## 10. Decisions still needing product-owner confirmation

1. Can a user own multiple personal workspaces, or is one default created and
   additional workspaces treated as custom/shared?
2. Must the target accept ownership transfer, or is current-owner confirmation
   sufficient?
3. Is a member-level account exclusion intended to override role inclusion as
   recommended above?
4. Can non-owner workspace managers archive the workspace?

## 11. External design references

- [NIST RBAC FAQ](https://csrc.nist.gov/Projects/Role-Based-Access-Control/faqs)
  for the user-role-permission relationship and role constraints.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  for deny-by-default, least privilege, per-request object authorization, and
  combining role/attribute/relationship rules.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  for server-side ownership checks and not trusting client-supplied actor,
  tenant, role, or balance data.
