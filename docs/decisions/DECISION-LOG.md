# Finwise decision log

This is an append-oriented log. If a decision is superseded, retain the old
entry and link it to the new decision.

## Confirmed decisions

| ID | Date | Decision | Consequence |
| --- | --- | --- | --- |
| D-001 | 2026-08-26 | Finwise is designed as a future paid SaaS; initial users are the owner and friends. | Tenant isolation and future entitlement boundaries must be designed early, while billing is deferred. |
| D-002 | 2026-08-26 | A user can have a personal workspace and join multiple shared workspaces. | Membership is many-to-many between users and workspaces. |
| D-003 | 2026-08-26 | Workspace financial data is isolated. | Transactions, categories, budgets, reports, accounts, connections, and imports require workspace scoping. |
| D-004 | 2026-08-26 | Budgets are soft limits, not stores of money. | Budget remaining is derived from limits and eligible spending and is distinct from account balance. |
| D-005 | 2026-08-26 | Authorization uses workspace-defined custom roles and API-enforced permissions. | Fixed role enums are not the primary authorization model; resource policies are still required. |
| D-006 | 2026-08-26 | The MVP currency is VND. | Multi-currency conversion and gains/losses are deferred, but the model must avoid assuming floating-point money. |
| D-007 | 2026-08-26 | A bank connection belongs to one workspace and supports multiple bank accounts. | Connection and imported data must carry workspace scope. |
| D-008 | 2026-08-26 | New bank records enter a confirmation inbox; the connecting member confirms them. | Unconfirmed provider data is separate from normal transactions and has stricter visibility. |
| D-009 | 2026-08-26 | Other workspace admins see bank-derived transactions after confirmation, not raw pending imports. | Authorization combines permissions with connection-custodian resource policy. |
| D-010 | 2026-08-26 | Web and mobile are first-class Finwise clients. | Financial rules belong on the backend and both clients consume consistent contracts. |
| D-011 | 2026-08-26 | A workspace member may have multiple roles; effective permissions are the union of active role permissions. | Authorization requires member-role and role-permission many-to-many relationships. |
| D-012 | 2026-08-26 | Every workspace has exactly one protected owner role. | Role CRUD cannot delete or weaken the owner role; ownership transfer needs a guarded workflow. |
| D-013 | 2026-08-26 | Loan tracking includes principal, interest, repayment schedules, due dates, actual repayments, and reminders. | Loan is a dedicated domain capability rather than only a generic account balance. |
| D-014 | 2026-08-26 | Initial investment types are stocks, cryptocurrency, and gold, with manual input accepted. | Holdings and valuation must work without an automatic market-price provider. |
| D-015 | 2026-08-26 | Savings, loans, and investments live inside the workspace that owns or controls them. | Workspace remains an ownership/access boundary; wealth features use dedicated modules inside it. |
| D-016 | 2026-08-26 | Split transactions across multiple categories are required in MVP. | The ledger needs transaction-level account effect plus category lines whose amounts sum exactly to the total. |
| D-017 | 2026-08-26 | A group collection may request the same amount from every participant or a custom amount per participant. | Collection obligations require per-participant target amounts even when initialized from one common default. |
| D-018 | 2026-08-26 | Participant is workspace-scoped and distinct from User; it may be linked to a workspace membership. | Groups can track non-users and later link identities without rewriting financial history. |
| D-019 | 2026-08-26 | The default group flow is member submission followed by treasurer verification and posting. | Pending submissions do not affect financial balances before verification. |
| D-020 | 2026-08-26 | A group may grant direct transaction creation to multiple members through permissions. | Family-style workspaces can operate without mandatory treasurer approval while class funds remain controlled. |
| D-021 | 2026-08-26 | Member-paid expenses support sponsored/non-reimbursable and reimbursable modes. | Member-paid activity and group-account cash movement remain distinct. |
| D-022 | 2026-08-26 | Sponsored member activity is reported separately and does not consume treasury budget. | Group budget measures costs borne by the treasury, while reports can still acknowledge sponsored value. |
| D-023 | 2026-08-26 | Budget rollover supports `none`, `positive_only`, and `full_balance`. | Full balance carries negative overspending as well as positive remainder. |
| D-024 | 2026-08-26 | Finwise leads with daily money tracking plus personal/group treasury management. | Onboarding and the initial habit loop prioritize transaction capture, review, shared funds, and monthly understanding. |
| D-025 | 2026-08-26 | Basic account reconciliation is required in MVP. | Accounts need auditable checkpoints that compare Finwise cleared balance with real-world balance. |
| D-026 | 2026-08-26 | Recurring transactions and bill reminders are deferred beyond MVP. | The first release focuses on trustworthy daily capture and review. |
| D-027 | 2026-08-26 | Authorization can restrict access to individual financial accounts. | Capability checks must be combined with account scope, including aggregate reports and transfers. |
| D-028 | 2026-08-26 | Simple workspace-scoped tags on transaction lines are included in MVP. | Tags provide cross-cutting filters/reporting without multiplying categories. |
| D-029 | 2026-08-26 | Finwise does not introduce a Project domain entity now. | Personal events use tags; collaborative activities needing isolated accounts, members, permissions, and budgets use workspaces. |
| D-030 | 2026-08-26 | Account visibility supports normal, exclude-selected, include-only, and owner-only modes. | A workspace can hide an account from some members or everyone except the protected owner without weakening capability checks. |
| D-031 | 2026-08-27 | Finwise mobile uses one Flutter/Dart codebase targeting iOS and Android. | Expo/React Native is removed from the target architecture; mobile packages, build tooling, and CI follow Flutter. |
| D-032 | 2026-08-27 | Next.js web, Flutter iOS, and Flutter Android all use the same NestJS business API. | NestJS is the single authorization and financial-rule boundary; client applications cannot create competing business backends. |
| D-033 | 2026-08-27 | The repository is a polyglot monorepo: pnpm manages Node/TypeScript projects and Dart pub manages Flutter. | One Git repository and root CI orchestrate both ecosystems without forcing Flutter dependencies into pnpm. |
| D-034 | 2026-08-27 | The tracked Expo starter is superseded and will be replaced by a clean Flutter scaffold in a dedicated migration. | Source replacement remains reviewable and recoverable through Git instead of being mixed into architecture documentation. |

## Proposed decisions awaiting confirmation

| ID | Date | Proposal | Reason |
| --- | --- | --- | --- |
| P-001 | 2026-08-26 | Savings, loans, and investments live inside the workspace that owns them rather than using separate workspace types. | Confirmed by D-015. |
| P-002 | 2026-08-26 | Cross-workspace movement creates two independently authorized records with optional correlation, not one cross-tenant transfer. | Preserves isolation, audit, and independent correction. |
| P-003 | 2026-08-26 | Use a transaction header plus balance-effect postings/entries for the core ledger. | Handles transfers, lending, liabilities, and future investments without a brittle conditional model. |
| P-004 | 2026-08-26 | A member can have multiple roles and receives the union of their allowed permissions; MVP has no explicit deny rules. | Keeps custom RBAC composable and understandable. |
| P-005 | 2026-08-26 | Investment market-price changes create valuation snapshots rather than cash transactions. | Separates unrealized value changes from realized cash income. |
| P-006 | 2026-08-26 | CSV and bank imports share normalization, deduplication, matching, and confirmation concepts. | Prevents parallel ingestion systems with inconsistent behavior. |
| P-007 | 2026-08-26 | Begin as a modular monolith with bounded contexts and one local database transaction boundary. | Preserves financial atomicity and module ownership without premature distributed-system overhead. |
| P-008 | 2026-08-26 | Use an internally balanced immutable journal with hidden system accounts while keeping user-facing income/expense/transfer forms simple. | Gives transfers, lending, liabilities, investments, refunds, and corrections one provable balance model. |
| P-009 | 2026-08-26 | Correct posted financial events by reversal and replacement, not in-place mutation. | Keeps balances rebuildable and audit/reconciliation history intact. |
| P-010 | 2026-08-26 | Use allow-union RBAC for capabilities plus typed resource policies; explicit member account exclusions override role inclusions. | Keeps general permission composition simple while supporting required per-account privacy. |
| P-011 | 2026-08-26 | A guarded owner transfer atomically replaces the single owner; bank custody uses separately audited delegation/takeover. | Avoids stranded workspaces without making bank raw-data privacy an implicit owner override. |
| P-012 | 2026-08-26 | Use parent budget modes `BY_CHILDREN`, `SHARED_POOL`, and `HYBRID`; only the funded cap owner rolls over. | Supports fixed, percentage, and flexible children without double-counting planned amounts or carry. |
| P-013 | 2026-08-26 | The first group module is shared treasury plus collections, sponsored expense, claims, and reimbursement, excluding general peer-debt settlement. | Covers class/family governance while avoiding an unrelated Splitwise debt engine in MVP. |
| P-014 | 2026-08-26 | An approved reimbursable claim counts as group expense and payable; later reimbursement settles cash without counting the expense twice. | Separates expense recognition from treasury cash movement and preserves honest obligations. |
| P-015 | 2026-08-26 | Model loans as contracts with versioned expected schedules and separately confirmed actual payment allocations. | Due dates and projected interest must never be mistaken for paid principal/interest. |
| P-016 | 2026-08-26 | Model investments as exact-quantity holdings/trades plus valuation snapshots; price movement is not a cash transaction. | Supports manual MVP input, cost basis, and net worth without fake income. |
| P-017 | 2026-08-26 | Use permission-filtered, rebuildable read projections in the same database before introducing a separate analytics system. | Keeps reports practical without making derived data authoritative or leaking hidden accounts. |
| P-018 | 2026-08-27 | **Superseded by D-033.** Consolidate backend, frontend, mobile, and pure shared packages into one root pnpm workspace without Nx/Turborepo initially. | Flutter uses Dart pub and cannot be governed as a pnpm package; only Node/TypeScript projects belong to the root pnpm workspace. |
| P-019 | 2026-08-27 | Use the NestJS `/v1` REST API and generated OpenAPI client as the canonical web/mobile contract. | Mobile needs a stable platform-neutral boundary; Prisma/domain models must not leak into clients. |
| P-020 | 2026-08-27 | Use Supabase Auth for MVP identity while keeping all workspace authorization and financial access in NestJS. | It fits the existing Supabase footprint and supports web/mobile sessions without making the Data API the business backend. |
| P-021 | 2026-08-27 | **Superseded by D-031.** Continue mobile development with Expo React Native and Expo Router rather than PWA, Flutter, or bare React Native. | Product owner selected Flutter for the shared iOS/Android application. |
| P-022 | 2026-08-27 | Mobile MVP supports cached reads and queued new transaction drafts offline; the server alone confirms transactions and balances. | Preserves useful daily capture on weak networks without implementing a conflicting offline financial ledger. |
| P-023 | 2026-08-27 | Delay Redis/BullMQ until bank sync, large imports, or notifications require durable background execution. | Manual ledger operations remain simpler; later workers consume idempotent outbox-driven jobs without making Redis financial truth. |

## Deferred decisions

| ID | Date | Decision | Revisit when |
| --- | --- | --- | --- |
| X-001 | 2026-08-26 | Multi-currency behavior is deferred. | A validated user need requires more than VND. |
| X-002 | 2026-08-26 | SaaS pricing, subscription tiers, and premium entitlements are deferred. | Core retention is demonstrated or premium features are prioritized. |
