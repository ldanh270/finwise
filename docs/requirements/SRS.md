# Finwise Software Requirements Specification (SRS)

Status: Living draft
Last updated: 2026-08-26
Primary audience: product owner, designers, engineers, and coding agents

## 1. Product vision

Finwise is a multi-tenant money-management SaaS for individuals and groups. A
user can manage a private financial workspace and participate in separate
shared workspaces such as a family fund, class fund, or travel group.

The lead product experience is daily money tracking plus personal/shared
treasury management. Budgeting supports that habit; wealth dashboards and
advanced automation expand it later.

The initial release is intended for the product owner and friends. The long-term
product is a paid SaaS with premium capabilities. Web and mobile are first-class
clients of the same backend business rules.

## 2. Product outcome

Finwise should help a user:

1. record daily income and spending;
2. understand monthly spending through summaries and charts;
3. monitor soft budgets and see how much budget remains;
4. understand where money is held across cash, banks, savings, loans, and
   investments;
5. collaborate on shared money without exposing unrelated personal finances;
6. progressively automate data entry through files and bank connections.

## 3. Actors

### 3.1 User

An authenticated person who can own and join multiple workspaces.

### 3.2 Workspace member

A user who has membership in a workspace. Access is determined by workspace
roles, permissions, and resource-specific policies.

### 3.3 Workspace owner

The single protected member responsible for the workspace, its membership,
permission setup, and eventually its SaaS billing. Ownership is not shared;
the guarded transfer workflow is still under design.

### 3.4 Bank connection custodian

The member who establishes a bank connection. The custodian can review and
confirm pending imported bank records from that connection. Other members only
see transactions after confirmation unless a later delegation rule is approved.

## 4. Confirmed product requirements

### 4.1 Workspace isolation

- **FR-WS-001** A user can belong to multiple workspaces.
- **FR-WS-002** A workspace may represent personal finances or shared finances.
- **FR-WS-003** Transactions, accounts, budgets, reports, bank
  connections, imports, and other financial data are isolated by workspace.
- **FR-WS-004** Membership in one workspace grants no access to another
  workspace.
- **FR-WS-005** Personal and shared workspaces use the same core financial
  model; collaboration and permissions differ by membership configuration.

### 4.2 Accounts and balances

- **FR-ACC-001** The MVP supports cash and bank accounts.
- **FR-ACC-002** The product direction also includes savings, money lent to
  others, and investments. Their detailed accounting behavior is under design.
- **FR-ACC-003** Opening balance is configured per account, not per workspace.
- **FR-ACC-004** A workspace can connect multiple banks and can contain multiple
  accounts from each connection.
- **FR-ACC-005** Account balance and budget remaining are distinct values and
  must never be presented as interchangeable.

### 4.3 Transactions

- **FR-TXN-001** Members with permission can manually record income, expense,
  and transfers between accounts in the same workspace.
- **FR-TXN-002** Confirmed financial transactions affect account balances.
- **FR-TXN-003** Financial transaction history must be auditable. Destructive
  deletion is not an accepted correction workflow.
- **FR-TXN-004** A transfer within one workspace must update both source and
  destination atomically.
- **FR-TXN-005** The system must prevent a transaction from referencing
  accounts, budgets, or members in another workspace.
- **FR-TXN-006** A transaction may be split into multiple budget lines. The
  line amounts must sum exactly to the transaction amount, while the account
  balance changes only once by the transaction total.
- **FR-TXN-007** The MVP supports account reconciliation: comparing Finwise's
  cleared balance with the external real-world balance and recording an
  auditable reconciliation checkpoint.

### 4.4 Budgets and soft monthly plans

- **FR-BUD-001** A workspace manages its own income and expense budgets.
- **FR-BUD-002** The MVP uses soft budgets. A budget is a spending plan or limit,
  not a separate store of money.
- **FR-BUD-003** Spending against a budget does not reserve or move money between
  accounts.
- **FR-BUD-004** The product shows budget limit, actual eligible spending, and
  remaining budget for a defined period.
- **FR-BUD-005** Monthly budget review and charts are core daily/monthly product
  experiences.
- **FR-BUD-006** A budget can configure whether unused amount rolls into the
  following period. Supported rollover modes are no rollover, positive-only
  rollover, and full-balance rollover including overspending.
- **FR-TAG-001** The MVP supports workspace-scoped tags on transaction lines.
  A line has exactly one budget and zero or more tags.
- **FR-TAG-002** Tags support create, rename, archive, assignment, filtering,
  and reporting. Tags do not change balances or consume budget limits.

### 4.5 Workspace authorization

- **FR-AUTHZ-001** Workspace authorization uses permissions rather than a fixed
  set of hard-coded business roles.
- **FR-AUTHZ-002** A workspace can create, read, update, and delete custom roles.
- **FR-AUTHZ-003** A role groups permissions, and members receive access through
  assigned roles.
- **FR-AUTHZ-003A** A member can receive multiple roles. Effective permissions
  are the union of the permissions allowed by their active roles.
- **FR-AUTHZ-004** Backend APIs enforce their required permission; hiding a UI
  control is not authorization.
- **FR-AUTHZ-005** Some operations additionally enforce resource-specific
  policies. For example, generic transaction permissions do not automatically
  grant access to another member's unconfirmed bank imports.
- **FR-AUTHZ-006** Each workspace has exactly one owner. The owner role is
  protected from deletion and from changes that would make the workspace
  unmanageable.
- **FR-AUTHZ-007** Financial-account access can be restricted per role/member.
  Possessing a capability such as `transaction.read` is insufficient when the
  relevant account is outside the actor's allowed account scope.
- **FR-AUTHZ-008** Transfers require sufficient access to both source and
  destination accounts. Reports, balances, and charts must not leak data from
  accounts the viewer cannot access.
- **FR-AUTHZ-009** An account visibility policy can expose the account normally,
  hide it from selected roles/members, expose it only to selected roles/members,
  or restrict it to the workspace owner. The owner can never be excluded.

### 4.6 Manual and automated ingestion

- **FR-IMP-001** The product supports manual data entry.
- **FR-IMP-002** The product will support CSV/Excel import and export.
- **FR-IMP-003** The product will support bank API connections.
- **FR-IMP-004** Imported bank records enter a persistent review inbox before
  becoming normal workspace transactions.
- **FR-IMP-005** The bank connection custodian confirms records imported through
  that connection.
- **FR-IMP-006** Other workspace administrators can view a bank transaction only
  after it has been confirmed as a workspace transaction.
- **FR-IMP-007** Retrying a bank sync or file import must not create duplicate
  imported records or duplicate financial transactions.

### 4.7 Currency and platforms

- **FR-CUR-001** The MVP operates in VND.
- **FR-CLIENT-001** Finwise has web and mobile clients backed by consistent
  server-side business rules.

### 4.8 Loans and investments

- **FR-LOAN-001** Loan tracking covers principal, interest, repayment schedules,
  due dates, actual repayments, and reminders.
- **FR-LOAN-002** Expected repayments and actual repayments are distinct. A due
  date passing does not automatically mark principal or interest as paid.
- **FR-INV-001** Initial investment tracking targets stocks, cryptocurrency, and
  gold.
- **FR-INV-002** The initial product accepts manually entered holdings, trades,
  and valuations. Automatic market price integrations are deferred.
- **FR-WEALTH-001** Savings, loans, and investment portfolios belong to the
  workspace that owns or controls them. They are financial modules within that
  workspace, not separate workspaces merely because their asset type differs.

### 4.9 Group participants and submissions

- **FR-GRP-001** A participant is a workspace-scoped person tracked in group
  collections, sponsorships, claims, or reimbursements. A participant is
  distinct from an authenticated user and may optionally be linked to one
  workspace membership.
- **FR-GRP-002** Group collections support a common requested amount or a custom
  requested amount for each participant.
- **FR-GRP-003** The default controlled workflow is member submission followed
  by treasurer verification and posting.
- **FR-GRP-004** Members granted direct transaction-create permission can post
  transactions without the default verification workflow.
- **FR-GRP-005** A member-paid group expense may be sponsored without
  reimbursement or submitted for reimbursement.
- **FR-GRP-006** Sponsored, non-reimbursable activity is reported separately and
  does not consume the workspace's treasury budget.

### 4.10 Savings goals

- **FR-GOAL-001** A workspace can define savings goals with a target amount and
  optional target date.
- **FR-GOAL-002** A goal is a progress/planning concept, not a financial account
  and not proof that money has been reserved.
- **FR-GOAL-003** The MVP progress method remains Proposed: manual progress,
  progress derived from one linked savings account, or both with an explicit
  method label.

## 5. MVP scope proposal

This section is **Proposed**, not yet confirmed as the final release boundary.

### Include

- authentication and user profile;
- personal and shared workspace creation;
- invitations and membership;
- custom roles and permissions;
- cash and bank accounts with opening balances;
- manual income, expense, and same-workspace transfer;
- budgets and monthly soft budgets;
- basic savings goals after their progress method is confirmed;
- transaction list and monthly overview charts;
- simple transaction-line tags and tag filters;
- CSV import through the same review inbox concept used by bank sync;
- one initial bank integration only after the manual ledger is stable;
- account reconciliation;
- basic audit history.

### Defer

- SaaS subscriptions and premium entitlements;
- multi-currency conversion and exchange-rate gains/losses;
- automatic investment market pricing;
- project/event entities and project-specific budgets;
- recurring transaction templates, bill reminders, and subscription detection;
- full loan amortization and collection workflows;
- Splitwise-style member debt allocation and settlement optimization;
- accounting-grade financial statements;
- automatic categorization based on machine learning.

## 6. Non-functional requirements

- **NFR-SEC-001** Every backend data access must be scoped by authenticated user
  and workspace membership.
- **NFR-SEC-002** Bank credentials and tokens must be encrypted and must never be
  exposed to clients or application logs.
- **NFR-DATA-001** Monetary values must use decimal/money types, never JavaScript
  floating-point arithmetic.
- **NFR-DATA-002** Multi-record financial writes must be atomic.
- **NFR-DATA-003** Balance caches, charts, and summaries are derived data and
  must be rebuildable from financial source records.
- **NFR-AUDIT-001** Material financial changes record actor, time, action, and
  sufficient before/after information.
- **NFR-IDEMP-001** External ingestion is idempotent.
- **NFR-UX-001** Data-driven screens handle loading, empty, error, retry, and
  permission-denied states.
- **NFR-CONSISTENCY-001** Web and mobile must not independently invent financial
  rules that differ from the backend.

## 7. Success measures to define

The following product metrics remain open:

- percentage of pilot users recording transactions on multiple days per week;
- monthly budget setup and review rate;
- percentage of imports confirmed rather than abandoned;
- retention after the first month;
- time required to reconcile a month of transactions;
- willingness to pay and which future capability drives payment.

## 8. Requirements traceability

Detailed invariants and data flows for these requirements live in
[`RDS.md`](RDS.md). Product and architectural decisions are recorded in
[`../decisions/DECISION-LOG.md`](../decisions/DECISION-LOG.md).
