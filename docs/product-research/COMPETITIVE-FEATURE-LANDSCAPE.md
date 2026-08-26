# Money-management app competitive feature landscape

Status: Product research, not approved Finwise scope  
Research date: 2026-08-26  
Audience: Finwise product owner, designers, engineers, and coding agents

## 1. Purpose and limits

This document inventories useful product patterns from major consumer finance
apps and maps them to possible Finwise capabilities. It is not a requirements
document. A researched feature becomes a Finwise requirement only after it is
confirmed in the SRS and decision log.

The scan uses official product pages and help centers for YNAB, Monarch Money,
Copilot Money, Rocket Money, PocketGuard, Goodbudget, Spendee, Wallet by
BudgetBakers, Money Lover, and Splitwise. Availability may vary by platform,
country, subscription tier, or bank data provider.

## 2. Product positioning patterns

| Product | Primary product idea | Notable strengths relevant to Finwise |
| --- | --- | --- |
| YNAB | Give current money explicit jobs | Transaction approval/matching, reconciliation, category targets, debt planner, household sharing |
| Monarch Money | All-in-one household financial command center | Net worth, investments, customizable dashboards, household collaboration, rules, goals, category/flex budgeting |
| Copilot Money | Automated and polished personal-finance review | To-review inbox, learned categorization, recurring detection, investment/net-worth views, splits, AI assistant |
| Rocket Money | Find savings and reduce recurring costs | Subscription detection/cancellation, bill negotiation, budgeting, credit, automated savings, net worth |
| PocketGuard | Make safe-to-spend understandable | Leftover/safe-to-spend, debt payoff, bills, goals, rules, alerts, rollovers, receipts and file import/export |
| Goodbudget | Shared envelope budgeting | Household budget sync, envelope fills/rollover, big-expense planning, debt payoff |
| Spendee | Visual wallet and cash-flow tracker | Shared wallets, bank/e-wallet/crypto connections, scheduled transactions, import/export, AI receipt scan |
| Wallet by BudgetBakers | Broad personal-finance toolbox | Bank/manual tracking, planned payments, rules, labels, OCR, warranties, shopping lists, account-level group permissions |
| Money Lover | Accessible mobile expense tracking | Wallets, budgets, savings, events, recurring bills, debt/loan, multi-currency, CSV export |
| Splitwise | Shared-expense allocation and settlement | Equal/unequal splits, shares/percentages, member balances, recurring expenses, receipts, debt simplification |

## 3. Cross-product feature map

### 3.1 Accounts and financial overview

Common capabilities:

- manual cash, bank, credit, savings, loan, and investment accounts;
- bank connection with read-only transaction aggregation;
- current and historical balances;
- asset/liability classification and net-worth history;
- account grouping, hiding, archiving, and exclusion from day-to-day budget;
- manual balance adjustments and reconciliation;
- support for connected and unconnected/tracking accounts.

Ideas for Finwise:

1. Keep account balance, liquid money, budget remaining, and net worth separate.
2. Allow an account to be excluded from the spending plan while remaining in net
   worth, useful for investments, property, and long-term loans.
3. Add reconciliation checkpoints so users can trust balances after manual,
   bank, and file entry converge.
4. Consider resource-level account visibility in shared workspaces in addition
   to workspace-level role permissions.

### 3.2 Transaction capture and review

Common capabilities:

- quick manual entry;
- automatic bank import;
- CSV/file import and export;
- pending/to-review inbox;
- approve, reject, categorize, edit, ignore, and bulk actions;
- automatic/manual matching between hand-entered and imported records;
- cleared, uncleared, pending, reviewed, and reconciled states;
- search and compound filters;
- split transactions by amount, percentage, or equal parts;
- merchant normalization, notes, tags, attachments, and receipts;
- duplicate prevention and user-visible unmatch/repair actions.

Ideas for Finwise:

1. Make review/match/reconcile a core workflow, not a bank-sync afterthought.
2. Preserve original imported data while allowing a normalized merchant name,
   category, note, and tags on the internal transaction.
3. Design bulk actions for web and fast single-item review gestures for mobile.
4. Keep submission approval, imported-record review, and posted transactions as
   distinct states or objects even if they share one inbox UI.

### 3.3 Categorization, tags, and automation rules

Common capabilities:

- system and custom income/expense/transfer categories;
- category groups or hierarchy;
- user-defined tags/labels;
- rules matching merchant, original statement, amount, account, and category;
- actions such as rename merchant, categorize, tag, hide/exclude, split, or mark
  reviewed;
- learned or AI-assisted category suggestions;
- previewing a rule before applying it to history.

Ideas for Finwise:

1. Treat categories as reporting classification and tags as cross-cutting
   context such as a trip, campaign, tax purpose, or person.
2. Build a deterministic rules engine before machine-learning categorization.
3. Make rule order and scope explicit and auditable.
4. Offer “apply to this transaction”, “apply to future”, and “apply to matching
   history” as separate user choices.

### 3.4 Budgeting and spending guidance

Observed models:

- category budgeting;
- parent/group-level budgeting;
- envelope/zero-based budgeting;
- fixed, non-monthly, and flexible spending buckets;
- monthly, weekly, annual, or custom targets;
- rollover and refill behavior;
- pace indicators and projected overspending;
- safe-to-spend/leftover after bills, debt, savings, and goals;
- historical averages used to suggest an initial budget;
- moving planned amount between categories with history.

Ideas for Finwise:

1. Retain the confirmed soft-budget model and three rollover modes.
2. Support nested `by_children`, `shared_pool`, and `hybrid` planning as a
   potential differentiator.
3. Add budget pace: compare percent of period elapsed with percent consumed.
4. Later add “safe to spend” only after upcoming bills, scheduled income, debt,
   and goals have dependable data.
5. Preserve budget edits/money moves as history rather than silently rewriting
   prior plans.

### 3.5 Recurring transactions, bills, and subscriptions

These are related but distinct:

- **Scheduled transaction:** user declares a future income, expense, or transfer.
- **Recurring pattern:** the system recognizes or the user defines a repeating
  series.
- **Bill:** a due obligation with amount, due date, status, and reminders.
- **Subscription:** a recurring service charge that may change price and can be
  marked unwanted/cancelled.

Common capabilities:

- weekly/monthly/yearly/custom schedules;
- upcoming calendar and expected cash flow;
- notification before due date;
- skip, edit one occurrence, edit future occurrences, or end series;
- match a scheduled occurrence to a bank-imported transaction;
- detect subscriptions and price changes;
- low-balance and high-spend alerts.

Ideas for Finwise:

1. Do not represent recurring configuration as already-posted future money.
2. Generate or confirm occurrences idempotently and link them to their template.
3. Separate reminders from financial posting.
4. Subscription cancellation and bill negotiation are market-specific service
   businesses, not early Finwise scope.

### 3.6 Goals and sinking funds

Common capabilities:

- save-up goal with target amount and optional date;
- pay-down goal for debt;
- recurring contribution target;
- automatic required-per-period calculation;
- link goal progress to one or more accounts or transactions;
- progress bars, milestones, reminders, and joint goals;
- distinguish money available for spending from tracked long-term assets.

Ideas for Finwise:

1. Goal is not an account and not a budget category, even when linked to both.
2. Support manual progress first, then transaction/account-linked progress.
3. Keep expected contribution, actual contribution, and current goal value
   separate.
4. Shared workspace goals can accept contributions from multiple participants.

### 3.7 Debt and lending

Common capabilities:

- loan/debt balance;
- interest rate, minimum payment, due date, and scheduled payments;
- payoff-date projection;
- snowball/avalanche or alternative strategy comparison;
- extra-payment impact on time and interest;
- reminders and payment history;
- debt goal paired with a payment category/account transfer.

Finwise has an additional opportunity: track both money the workspace owes and
money others owe the workspace. The product must still separate schedule from
actual repayment and principal from interest/fees.

### 3.8 Investments, assets, and net worth

Common capabilities:

- holdings and current valuation;
- stocks, funds/ETFs, retirement accounts, crypto, property, and other assets;
- allocation and performance charts;
- manual assets/liabilities when no provider connection exists;
- current/historical net worth;
- automatic property or market-value estimates in some regions.

Ideas for Finwise:

1. Start with confirmed manual stocks, crypto, and gold.
2. Store quantity, trades, valuations, fees, and income separately.
3. Distinguish unrealized valuation change, realized gain/loss, and cash income.
4. Make price-source provenance and valuation timestamp visible when automatic
   prices are added.

### 3.9 Collaboration and group finance

Observed collaboration models:

1. shared household view of separate and joint accounts;
2. shared selected wallet/accounts with account-level access;
3. one shared household budget;
4. user-specific budgets over the same shared transactions;
5. shared-expense/debt settlement;
6. advisor/coach/accountant access;
7. participant tracking without requiring every person to operate the app.

Product lessons for Finwise:

- keep personal and group workspaces isolated;
- make workspace budgets shared domain data, not private per-user overlays;
- retain custom RBAC and consider per-account policies;
- support participant-to-membership linking;
- use submission/verification for controlled funds and direct posting for trusted
  household members;
- keep treasury, reimbursement, and Splitwise-style settlement as separate
  capabilities;
- consider time-limited viewer/advisor access later.

### 3.10 Reports, insights, and dashboards

Common capabilities:

- income versus expense and cash-flow trends;
- spending by category, merchant, account, tag, and period;
- budget planned/actual/remaining and pace;
- net-worth and investment-performance history;
- recurring/bill calendar;
- savings and debt progress;
- customizable dashboard widgets;
- monthly review and anomaly/large-transaction insights;
- group collection, sponsored activity, and pending reimbursement views.

Ideas for Finwise:

1. Let each user customize dashboard layout without changing shared financial
   truth.
2. Make every chart drill down to the transactions used in the calculation.
3. Display data freshness, excluded records, and whether values are actual,
   pending, projected, or manually valued.
4. Avoid an opaque “financial score” until its formula and actionability are
   defensible.

### 3.11 Data ownership, portability, and trust

Common capabilities:

- CSV import/export;
- receipt/image attachment and OCR;
- sync across mobile/web devices;
- offline entry followed by sync;
- read-only bank access;
- passcode/biometric lock and 2FA;
- archive/deactivate rather than erase useful history;
- premium limits on exports, connections, wallets, budgets, or collaboration.

Ideas for Finwise:

1. Export should be a trust feature, not only an upsell.
2. Define conflict/idempotency behavior before offline mobile entry is enabled.
3. Keep imported raw records and attachments protected by narrower permissions
   than confirmed financial transactions.
4. Provide workspace export and account deletion workflows compatible with audit
   and legal retention requirements.

### 3.12 AI and assistance

Current product directions include:

- learned categorization and merchant cleanup;
- proactive budget suggestions;
- conversational querying and chart generation;
- creating/editing categories, budgets, rules, and transactions through an
  assistant;
- receipt scanning/OCR;
- anomaly and recurring-charge detection.

Ideas for Finwise:

1. AI suggestions require explicit review before changing financial truth.
2. Deterministic calculations and authorization remain outside the model.
3. Every assistant mutation uses the same application use case, validation,
   permission check, and audit path as web/mobile.
4. OCR output enters a draft/review flow rather than posting directly.

## 4. Candidate Finwise feature tiers

This is a product proposal, not a committed roadmap.

### Foundation / likely MVP

- identity, personal/shared workspaces, participants, RBAC;
- cash/bank/savings accounts and opening balances;
- manual posted transactions and controlled group submissions;
- transaction splits, categories, search, filters, and basic transaction-line
  tags;
- import inbox with deduplication, matching, approval, and reconciliation;
- CSV import/export;
- soft monthly budgets with nested modes and three rollover behaviors;
- core dashboard, cash flow, budget, and group-fund reports;
- audit, void/correction, and data isolation.

### Expansion

- bank connections and automatic rules;
- receipt attachments and OCR-assisted drafts;
- goals and sinking funds;
- recurring templates, bills, recurring detection, and upcoming cash-flow
  calendar;
- complete loan schedules, interest, reminders, and payoff projections;
- manual stocks, crypto, gold, and net-worth history;
- group collection campaigns, reimbursement, and account-level policies;
- budget pace and suggested amounts from historical spending.

### Premium/differentiation candidates

- unlimited bank connections, workspaces, advanced reports, and automations;
- automatic investment prices and richer portfolio analysis;
- intelligent transaction/category/rule suggestions;
- safe-to-spend and proactive cash-flow warnings;
- advanced advisor/accountant access and shareable reports;
- recurring subscription detection and price-change alerts;
- configurable approval workflows and stronger maker-checker controls;
- custom report builder and scheduled exports;
- optional Splitwise-style member allocation as a separate module.

Avoid paywalling basic data export, account security, or correctness features.

## 5. Highest-value ideas Finwise had not yet specified

1. account reconciliation and immutable reconciliation checkpoints;
2. manual/imported transaction matching and unmatching;
3. deterministic transaction rules with preview;
4. merchant normalization while preserving original statements;
5. distinct scheduled, recurring, bill, and subscription models;
6. review states and bulk review UX;
7. transaction-line tags in addition to categories;
8. report drill-down and data-freshness indicators;
9. account-level visibility inside a shared workspace;
10. advisor/viewer access with expiry;
11. receipt/OCR drafts;
12. budget pace and historical budget suggestions;
13. safe-to-spend after dependable future obligations exist;
14. user-custom dashboard layout over shared data;
15. offline mobile conflict/idempotency design.

## 6. Product decisions after research

Resolved:

- Finwise leads with daily tracking plus personal/group treasury management.
- Basic reconciliation is MVP scope.
- Recurring templates and bill reminders are deferred beyond MVP.
- Authorization can restrict individual group accounts.

Still open:

1. Does goal progress link to accounts, transactions, manual contributions, or
   all three?
2. Which reports are essential for the daily and monthly habit loop?
3. Which capabilities are credible premium value without weakening user trust?

## 7. Official source index

- YNAB features: https://www.ynab.com/features
- YNAB transaction approval/matching:
  https://support.ynab.com/en_us/approving-and-matching-transactions-a-guide-ByYNZaQ1i
- YNAB reconciliation:
  https://support.ynab.com/en_us/reconciling-accounts-a-guide-BJFE3fHys
- YNAB loans:
  https://support.ynab.com/en_us/loan-accounts-a-guide-HkNSkPHJi
- Monarch tracking: https://www.monarchmoney.com/features/tracking
- Monarch collaboration: https://www.monarchmoney.com/features/collaboration
- Monarch budgets:
  https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch
- Monarch transaction rules:
  https://help.monarchmoney.com/hc/en-us/articles/360048393372-Transaction-rules
- Copilot overview: https://www.copilot.money/
- Copilot quick start:
  https://help.copilot.money/en/articles/11157550-quick-start-guide
- Copilot transactions:
  https://help.copilot.money/en/articles/9554412-transactions-tab-overview
- Rocket Money FAQ: https://www.rocketmoney.com/faq
- PocketGuard: https://pocketguard.com/
- PocketGuard Plus:
  https://pocketguard.com/help/pocketguard-plus-overview/
- Goodbudget: https://goodbudget.com/what-you-get/
- Spendee: https://www.spendee.com/
- Spendee shared wallets: https://help.spendee.com/article/224-shared-wallets
- Wallet overview:
  https://support.budgetbakers.com/hc/en-us/articles/12212428113810-What-is-the-Wallet-app
- Wallet group sharing:
  https://support.budgetbakers.com/hc/en-us/articles/7149394922002-Everything-about-Group-Sharing
- Money Lover: https://moneylover.me/
- Splitwise overview: https://kb.splitwise.com/getting-started/how-do-i-use-splitwise
- Splitwise debt simplification:
  https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts
