# Budget-as-Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active Category domain with Budget buckets that also receive transaction allocations and monthly limits.

**Architecture:** Keep the existing ledger and immutable allocation-line boundary. Rename the bucket identity from category to budget, move monthly plan routes to `budget-periods`, and let quick-add pass an optional `budgetId` so the server creates a full-amount allocation with the journal operation.

**Tech Stack:** NestJS + TypeScript, in-memory transitional core store with runtime snapshots, shared TypeScript API client, Next.js/React web, Expo/React Native mobile, Jest.

**Spec:** `docs/superpowers/specs/2026-09-05-budget-as-classification-design.md`

## Global Constraints

- Amounts remain exact VND minor-unit strings/bigints; never use floating-point arithmetic.
- Budget allocation lines remain immutable and must sum exactly to the transaction amount.
- Transfers, opening balances, and account balances remain independent of budget allocation.
- Historical budget records and allocation lines are archived/preserved, never hard-deleted.
- No new dependency; keep the existing HTTP/client and test conventions.
- Update the active implementation-plan and add a dated walkthrough under `docs/reviews/`.

### Task 1: Rename the core budget bucket and allocation contracts

**Files:**
- Modify: `backend/src/core/domain/ledger.types.ts`
- Modify: `backend/src/core/application/core.ports.ts`
- Modify: `backend/src/core/domain/budget-allocation.ts`
- Modify: `backend/src/core/domain/report.ts`
- Test: `backend/src/core/domain/budget-allocation.spec.ts`
- Test: `backend/src/core/domain/report.spec.ts`

- [x] **Step 1: Write failing domain assertions** for budget IDs, budget report rows, and allocation actuals.
- [x] **Step 2: Run the focused domain tests and confirm the new assertions fail because the old category contracts remain.**
- [x] **Step 3: Rename records, drafts, constraint fields, and report fields from category to budget.**
- [x] **Step 4: Run the focused domain tests and confirm they pass.**

### Task 2: Migrate the core service/store and HTTP routes

**Files:**
- Modify: `backend/src/core/infrastructure/in-memory-finwise.store.ts`
- Modify: `backend/src/core/application/core.service.ts`
- Modify: `backend/src/core/presentation/core.controller.ts`
- Modify: `backend/src/core/application/core.service.spec.ts`
- Modify: `backend/test/app.e2e-spec.ts`

- [x] **Step 1: Add failing service tests** for budget bucket CRUD and quick-add `budgetId` allocation.
- [x] **Step 2: Run the focused backend tests and confirm they fail on missing budget routes/payloads.**
- [x] **Step 3: Implement budget bucket storage/authorization, `/budgets` routes, `/budget-periods` routes, and budget-aware journal creation.**
- [x] **Step 4: Run core unit and e2e tests and confirm they pass.**

### Task 3: Update shared API clients and schemas

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Modify: `frontend/src/lib/api/contracts.ts`
- Modify: `frontend/src/lib/api/client.ts`
- Modify: `mobile/src/validation/forms.ts`
- Modify: `mobile/src/sync/outbox.ts`
- Modify: `mobile/src/sync/online-sync.ts`
- Modify: `contracts/openapi.json`
- Test: `mobile/src/api-client.spec.ts`
- Test: `mobile/src/sync/outbox.spec.ts`

- [x] **Step 1: Add/update client tests** for `budgetId` transaction payloads and the renamed budget responses.
- [x] **Step 2: Run the focused client tests and confirm the updated contract assertions pass.**
- [x] **Step 3: Rename public DTOs/routes and propagate optional `budgetId` through online and offline manual transaction commands.**
- [x] **Step 4: Run client tests and typecheck the shared package.**

### Task 4: Update web and mobile UX

**Files:**
- Modify: `frontend/src/features/budget/budget-page.tsx`
- Modify: `frontend/src/features/budget/budget-service.ts`
- Modify: `frontend/src/features/ledger/ledger-action-panel.tsx`
- Modify: `frontend/src/features/ledger/ledger-service.ts`
- Modify: `frontend/src/features/dashboard/dashboard-page.tsx`
- Modify: `frontend/src/features/reports/reports-page.tsx`
- Modify: `mobile/app/(app)/budgets.tsx`
- Modify: `mobile/app/(app)/transaction/new.tsx`
- Modify: `mobile/app/(app)/transactions.tsx`
- Modify: `mobile/app/(app)/reports.tsx`
- Modify: `mobile/src/features/ledger/ledger-service.ts`
- Modify: `mobile/src/features/planning/budget-service.ts`

- [x] **Step 1: Update UI/service contract coverage** for loading budgets and sending the selected budget on quick-add.
- [x] **Step 2: Run the focused tests and typechecks against the updated contract.**
- [x] **Step 3: Replace category labels/selectors with budget labels/selectors and add optional budget selection to expense/income quick-add.**
- [x] **Step 4: Run web/mobile tests and formatting checks.**

### Task 5: Update active documentation and verify the migration

**Files:**
- Modify: `docs/implementation-plan/phases/04-CLASSIFICATION-BUDGETING-REPORTING.md`
- Modify: `docs/domain/04-classification-budgeting-goals.md`
- Modify: `docs/requirements/RDS.md`
- Modify: `docs/requirements/SRS.md`
- Create: `docs/reviews/2026-09-05-budget-as-classification-walkthrough.md`

- [x] **Step 1: Update active business rules and API/data-flow documentation.**
- [x] **Step 2: Add the walkthrough with scope, non-goals, changed behavior, security/migration implications, verification, gaps, and follow-ups.**
- [x] **Step 3: Run formatter, lint, tests, typechecks, builds, and inspect the final diff.**
