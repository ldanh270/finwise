# Mobile Onboarding, Accounts, Currency, and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-run workspace/account setup, per-account currency and icons, default workspace budgets, amount-first transaction entry, five-item mobile navigation, and local theme/language settings.

**Architecture:** Extend the existing core domain and application ports with a typed currency model, atomic workspace setup command, account metadata, and explicit cross-currency transfer amounts. Keep confirmed balances and transaction truth in the backend runtime store, expose the changes through the shared API client/OpenAPI contract, and keep mobile route files thin by placing preferences, translation, validation, and API orchestration under `mobile/src`.

**Tech Stack:** NestJS + TypeScript, in-memory core store with runtime snapshots, shared TypeScript API client, Expo Router/React Native, TanStack Query, SecureStore/SQLite adapters already in the repository, Jest, Prettier, ESLint, OpenAPI JSON.

**Spec:** `docs/superpowers/specs/2026-09-06-mobile-onboarding-account-settings-design.md`

## Global Constraints

- Supported MVP currencies are exactly `VND`, `USD`, `EUR`, `GBP`, `JPY`, `KRW`, `CNY`, `SGD`, `THB`, and `AUD`.
- Amounts remain integer minor-unit strings/`bigint`; never use JavaScript floating-point arithmetic for financial calculations.
- Workspace setup creates the workspace owner, required initial account, opening journal when non-zero, and default budgets as one successful application operation.
- Budgets belong to the workspace and are not attached to accounts; transfers do not receive budgets.
- Cross-currency transfers require a destination amount or manual exchange rate; no automatic external exchange-rate fetch is added.
- Confirmed balances remain server-owned; mobile cache and outbox are workflow state only.
- Expo Router route files compose screens; API calls, business rules, preference persistence, and translation helpers remain under `mobile/src`.
- Tokens remain in SecureStore and never enter route params, preferences, logs, or transaction drafts.
- Preserve existing account visibility authorization, idempotency keys, audit records, and archived-record rules.
- Add focused tests before production code for each new behavior and run the affected test after every RED/GREEN cycle.
- Update the Phase 8 implementation plan and add a dated walkthrough under `docs/reviews/` before completion.

---

### Task 1: Add the typed currency and account metadata foundation

**Files:**
- Create: `backend/src/core/domain/currency.ts`
- Test: `backend/src/core/domain/currency.spec.ts`
- Modify: `backend/src/core/domain/ledger.types.ts`
- Modify: `backend/src/shared/domain/money.ts`
- Test: `backend/src/core/domain/report.spec.ts`

**Interfaces:**
- Produces `CurrencyCode`, `CURRENCY_CODES`, `CurrencyMetadata`, `currencyMetadata(code)`, and `isCurrencyCode(value)` for backend/application consumers.
- Produces `AccountRecord.iconKey` and `AccountRecord.currency: CurrencyCode`.
- Produces `WorkspaceRecord.defaultCurrency: CurrencyCode`.

- [ ] **Step 1: Write failing currency tests.**

```ts
it('accepts only the supported MVP currency codes', () => {
  expect(isCurrencyCode('USD')).toBe(true);
  expect(isCurrencyCode('VND')).toBe(true);
  expect(isCurrencyCode('BTC')).toBe(false);
});

it('returns display metadata and minor-unit scale', () => {
  expect(currencyMetadata('VND')).toMatchObject({ code: 'VND', scale: 0 });
  expect(currencyMetadata('USD')).toMatchObject({ code: 'USD', scale: 2 });
  expect(currencyMetadata('JPY')).toMatchObject({ code: 'JPY', scale: 0 });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the currency module does not exist.**

Run: `npm --prefix backend test -- --runInBand src/core/domain/currency.spec.ts`

Expected: FAIL with the missing module or missing export error.

- [ ] **Step 3: Implement the smallest typed currency module and update domain records.**

Use a literal union and immutable metadata map. Keep `MVP_CURRENCY` as the
existing default constant only where legacy call sites still need it, but make
new workspace/account fields use `CurrencyCode`. Add `iconKey` as a string
validated at the application boundary in a later task.

- [ ] **Step 4: Run the focused currency/domain tests and confirm they pass.**

Run: `npm --prefix backend test -- --runInBand src/core/domain/currency.spec.ts src/core/domain/report.spec.ts`

- [ ] **Step 5: Refactor only after green and inspect the diff for floating-point calculations or accidental currency widening.**

### Task 2: Implement atomic workspace setup and seeded defaults

**Files:**
- Modify: `backend/src/core/application/core.ports.ts`
- Modify: `backend/src/core/application/core.service.ts`
- Modify: `backend/src/core/infrastructure/in-memory-finwise.store.ts`
- Modify: `backend/src/core/presentation/core.controller.ts`
- Test: `backend/src/core/application/core.service.spec.ts`
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Produces `InitialAccountSetupInput` and `WorkspaceSetupInput` at the application boundary.
- Produces `CoreStorePort.createWorkspaceSetup(actor, input)` returning `{ workspace, account, budgets }`.
- Produces `CoreService.createWorkspace(actor, body)` accepting `defaultCurrency` and `initialAccount`.
- Keeps `POST /v1/workspaces` as the setup endpoint and returns the created workspace, initial account, and seeded budgets.

- [ ] **Step 1: Write failing application tests for empty bootstrap and atomic setup.**

```ts
it('does not create an implicit workspace for a first-time user', () => {
  const result = store.bootstrap(firstTimeActor);
  expect(result.workspaces).toEqual([]);
  expect(result.suggestedWorkspaceId).toBe('');
});

it('creates the owner, initial account, opening balance, and default budgets together', () => {
  const result = service.createWorkspace(actor, {
    name: 'Ducan Home',
    kind: 'personal',
    defaultCurrency: 'VND',
    initialAccount: {
      name: 'Cash',
      iconKey: 'cash',
      kind: 'cash',
      currency: 'VND',
      openingBalanceMinorUnits: '450000',
    },
  });

  expect(result.account.balanceMinorUnits).toBe('450000');
  expect(result.budgets.map((budget) => budget.name)).toEqual([
    'Food', 'Shopping', 'Education', 'Transport',
    'Housing', 'Health', 'Bills', 'Other',
  ]);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail on implicit workspace creation and the missing setup payload.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts`

Expected: FAIL with the old bootstrap/setup behavior.

- [ ] **Step 3: Implement validation and atomic setup in the application/store boundary.**

Validate workspace/account names, allowed kinds, icon keys, currencies, and
non-negative opening amounts. Create workspace, owner role, account, opening
journal, and default budgets through one store operation. If any step fails,
restore the maps touched by the operation before rethrowing the typed error.
Change first-time bootstrap to return an empty workspace list while retaining
existing active workspaces for legacy users.

- [ ] **Step 4: Add the e2e request/response assertion for setup and empty bootstrap.**

Assert the response exposes currency/icon metadata and all default budgets, and
assert a first-time authenticated user receives `workspaces: []` rather than a
server-created `Personal` workspace.

- [ ] **Step 5: Run focused backend tests and the e2e suite.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts`

Run: `npm --prefix backend run test:e2e -- --runInBand`

### Task 3: Add per-account currency, icon, and opening-balance creation

**Files:**
- Modify: `backend/src/core/application/core.ports.ts`
- Modify: `backend/src/core/application/core.service.ts`
- Modify: `backend/src/core/infrastructure/in-memory-finwise.store.ts`
- Modify: `backend/src/core/domain/ledger.types.ts`
- Test: `backend/src/core/application/core.service.spec.ts`
- Create: `backend/src/core/infrastructure/in-memory-finwise.store.spec.ts`

**Interfaces:**
- Extends `CoreStorePort.createAccount` with `currency`, `iconKey`, and `openingBalanceMinorUnits`.
- Extends `AccountResponse` with `currency: CurrencyCode` and `iconKey`.
- Keeps `postOpeningBalance` as the auditable journal primitive used by setup and account creation.

- [ ] **Step 1: Add a focused store test for a USD account with an opening amount and a stable icon key.**

```ts
it('creates a currency-specific account and posts its opening amount', () => {
  const account = core.createAccount(actor, workspaceId, {
    name: 'USD wallet',
    kind: 'cash',
    currency: 'USD',
    iconKey: 'wallet',
    openingBalanceMinorUnits: '12500',
  });

  expect(account.currency).toBe('USD');
  expect(account.iconKey).toBe('wallet');
  expect(core.getAccount(actor, workspaceId, account.id).balanceMinorUnits).toBe(12500n);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because account creation is VND-only and has no icon/opening input.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts src/core/infrastructure/in-memory-finwise.store.spec.ts`

- [ ] **Step 3: Implement account metadata and atomic opening-balance creation.**

Keep the old call shape compatible for existing tests by defaulting omitted
currency to the workspace currency and omitted icon to `cash`. Create the
account and opening journal as one operation, with rollback on journal failure.
Do not make account creation alter any other workspace account.

- [ ] **Step 4: Add grouped-currency overview projection tests.**

Assert that VND and USD balances are returned in separate groups and are not
added into one `Money` value.

- [ ] **Step 5: Run the focused backend suite and typecheck.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts src/core/infrastructure/in-memory-finwise.store.spec.ts`

Run: `npm --prefix backend run typecheck`

### Task 4: Extend transaction contracts for account currencies and manual FX transfers

**Files:**
- Modify: `backend/src/core/application/core.ports.ts`
- Modify: `backend/src/core/application/core.service.ts`
- Modify: `backend/src/core/infrastructure/in-memory-finwise.store.ts`
- Modify: `backend/src/core/domain/ledger.types.ts`
- Test: `backend/src/core/application/core.service.spec.ts`
- Test: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Extends journal entries with `currency: CurrencyCode`.
- Extends transaction creation input with optional `destinationAmountMinorUnits` and `exchangeRate` for transfers.
- Exposes source/destination amounts and currencies in transfer responses without changing expense/income behavior.

- [ ] **Step 1: Write failing tests for same-currency and cross-currency transfers.**

```ts
it('uses one amount for a same-currency transfer', () => {
  const result = service.createTransaction(actor, workspaceId, {
    kind: 'transfer',
    accountId: vnd.id,
    destinationAccountId: vndSavings.id,
    amount: { currency: 'VND', minorUnits: '100000' },
    effectiveDate: '2026-09-06',
  }, 'same-currency-transfer');

  expect(result.transfer.destinationAmount.minorUnits).toBe('100000');
});

it('requires a destination amount or manual rate for a cross-currency transfer', () => {
  expect(() => service.createTransaction(actor, workspaceId, {
    kind: 'transfer',
    accountId: vnd.id,
    destinationAccountId: usd.id,
    amount: { currency: 'VND', minorUnits: '20000000' },
    effectiveDate: '2026-09-06',
  }, 'missing-fx')).toThrow('destination amount or exchange rate');
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail because journal entries are VND-only and transfer input has no FX fields.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts`

- [ ] **Step 3: Implement integer-safe manual FX conversion.**

Represent a manual rate as a validated decimal string converted to a bounded
rational/scaled integer before multiplication. If destination amount is
provided, use it as authoritative. Require a positive result and preserve
source/destination currencies on both journal entries. Reject budget IDs on
transfers and reject an amount currency that differs from the source account.

- [ ] **Step 4: Add e2e assertions for transfer response currencies and validation errors.**

- [ ] **Step 5: Run the focused backend tests, e2e, and typecheck.**

Run: `npm --prefix backend test -- --runInBand src/core/application/core.service.spec.ts`

Run: `npm --prefix backend run test:e2e -- --runInBand`

Run: `npm --prefix backend run typecheck`

### Task 5: Update shared API client and OpenAPI contracts

**Files:**
- Modify: `packages/api-client/src/index.ts`
- Test: `mobile/src/api-client.spec.ts`
- Modify: `frontend/src/lib/api/contracts.ts`
- Modify: `frontend/src/lib/api/client.ts`
- Modify: `contracts/openapi.json`

**Interfaces:**
- Produces shared `CurrencyCode`, `CurrencyMetadata`, `WorkspaceSetupInput`, `AccountCreateInput`, `AccountSummary`, `WorkspaceSetupResponse`, and transfer input/output types.
- Produces `ApiClient.createWorkspace(input)`, expanded `createAccount`, and expanded `createTransaction` methods.

- [ ] **Step 1: Add failing client tests for setup, account currency/icon, and transfer payload serialization.**

```ts
it('serializes workspace setup and cross-currency transfer fields', async () => {
  await api.createWorkspace({
    name: 'Home',
    kind: 'personal',
    defaultCurrency: 'VND',
    initialAccount: {
      name: 'Cash', iconKey: 'cash', kind: 'cash',
      currency: 'VND', openingBalanceMinorUnits: '450000',
    },
  });
  await api.createTransaction('workspace-1', {
    kind: 'transfer', accountId: 'vnd', destinationAccountId: 'usd',
    amount: { currency: 'VND', minorUnits: '20000000' },
    destinationAmount: { currency: 'USD', minorUnits: '100000' },
    effectiveDate: '2026-09-06',
  }, 'client-transfer');

  expect(requests[0].body).toContain('initialAccount');
  expect(requests[1].body).toContain('destinationAmount');
});
```

- [ ] **Step 2: Run the focused client test and confirm the new methods/types are missing.**

Run: `pnpm --filter mobile test -- api-client.spec.ts --runInBand`

- [ ] **Step 3: Update shared types, clients, frontend contracts, and OpenAPI schemas/routes.**

Keep response DTOs explicit; do not use `unknown[]` for the new currency,
account, setup, or transfer shapes. Keep endpoint paths unchanged where
possible so existing web consumers remain compatible.

- [ ] **Step 4: Run client tests, contract validation, and package typechecks.**

Run: `pnpm --filter mobile test -- api-client.spec.ts --runInBand`

Run: `npm run contracts:check`

Run: `pnpm typecheck:api-client`

### Task 6: Add mobile preference, theme, and translation services

**Files:**
- Create: `mobile/src/preferences/preferences.ts`
- Test: `mobile/src/preferences/preferences.spec.ts`
- Create: `mobile/src/i18n/i18n.ts`
- Test: `mobile/src/i18n/i18n.spec.ts`
- Create: `mobile/src/ui/theme.ts`
- Modify: `mobile/src/app/providers.tsx`
- Modify: `mobile/src/ui/components.tsx`

**Interfaces:**
- Produces `ThemePreference = "system" | "light" | "dark"` and `Language = "en" | "vi"`.
- Produces `PreferencesStore.read()`, `PreferencesStore.write(preferences)`, and `translate(language, key)`.
- Produces a `usePreferences()` context exposing preferences and setters.

- [ ] **Step 1: Write failing tests for defaults, persistence, fallback translation, and palette selection.**

```ts
it('defaults to system theme and English', async () => {
  const store = new PreferencesStore(memoryStorage);
  await expect(store.read()).resolves.toEqual({ theme: 'system', language: 'en' });
});

it('falls back to English when a Vietnamese key is not translated', () => {
  expect(translate('vi', 'settings.title')).toBe('Cài đặt');
  expect(translate('vi', 'legacy.untranslated')).toBe(
    translate('en', 'legacy.untranslated'),
  );
});
```

- [ ] **Step 2: Run the focused mobile tests and confirm they fail because the services do not exist.**

Run: `pnpm --filter mobile test -- preferences.spec.ts i18n.spec.ts --runInBand`

- [ ] **Step 3: Implement the services using the existing SQLite JSON storage adapter and a small typed dictionary.**

Resolve the system palette through `useColorScheme`; preserve the current teal
brand colors in light mode and add a readable dark palette. Keep preference
storage separate from workspace/account cache.

- [ ] **Step 4: Run focused tests and verify existing component imports still typecheck.**

Run: `pnpm --filter mobile test -- preferences.spec.ts i18n.spec.ts --runInBand`

Run: `pnpm --filter mobile typecheck`

### Task 7: Implement onboarding and account screens

**Files:**
- Create: `mobile/src/features/onboarding/onboarding-screen.tsx`
- Create: `mobile/src/features/onboarding/onboarding-service.ts`
- Test: `mobile/src/features/onboarding/onboarding-service.spec.ts`
- Modify: `mobile/app/(app)/_layout.tsx`
- Modify: `mobile/app/(app)/accounts.tsx`
- Modify: `mobile/src/features/ledger/ledger-service.ts`
- Modify: `mobile/src/app/providers.tsx`
- Test: `mobile/src/app/workspace-bootstrap.spec.ts`

**Interfaces:**
- Produces `submitWorkspaceSetup(api, input)` that calls the shared setup endpoint and returns the created workspace/account/budgets.
- Produces account form validation for name, icon key, currency, kind, and opening amount.
- Keeps route files responsible for composition and puts request logic in feature services.

- [ ] **Step 1: Write failing mobile tests for empty bootstrap onboarding and account form payloads.**

```ts
it('routes an authenticated empty bootstrap to onboarding', () => {
  expect(getWorkspaceBootstrapStatus({ workspaces: [], suggestedWorkspaceId: '' }, false)).toBe('empty');
});

it('builds an initial account setup with the selected currency and icon', () => {
  expect(buildWorkspaceSetupInput({
    workspaceName: 'Home', accountName: 'Cash', iconKey: 'cash',
    currency: 'VND', openingAmount: '450000',
  })).toMatchObject({
    defaultCurrency: 'VND',
    initialAccount: { iconKey: 'cash', currency: 'VND', openingBalanceMinorUnits: '450000' },
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail on the missing setup builder/service or old bootstrap gate.**

Run: `pnpm --filter mobile test -- workspace-bootstrap.spec.ts onboarding-service.spec.ts --runInBand`

- [ ] **Step 3: Implement onboarding gate and setup form.**

Authenticated empty bootstrap must render a two-step setup form with sample
icons and currencies, loading/error/retry states, and a successful workspace
selection followed by query invalidation. Do not put tokens or workspace setup
payloads in route params.

- [ ] **Step 4: Update accounts to show icon/currency, group balances by currency, and create accounts with opening amount.**

Use the existing `WorkspaceCache` only for server-authorized snapshots. Add
account form states for loading, empty, error, stale, and permission denied.

- [ ] **Step 5: Run focused mobile tests and typecheck.**

Run: `pnpm --filter mobile test -- workspace-bootstrap.spec.ts onboarding-service.spec.ts --runInBand`

Run: `pnpm --filter mobile typecheck`

### Task 8: Replace the bottom navigation and implement the amount-first plus flow

**Files:**
- Modify: `mobile/src/ui/app-shell.tsx`
- Modify: `mobile/src/ui/bottom-navigation-layout.ts`
- Test: `mobile/src/ui/bottom-navigation-layout.spec.ts`
- Modify: `mobile/app/(app)/transaction/new.tsx`
- Modify: `mobile/src/features/ledger/ledger-service.ts`
- Modify: `mobile/src/validation/forms.ts`
- Test: `mobile/src/features/ledger/transaction-detail.spec.ts`
- Modify: `mobile/app/(app)/other.tsx`
- Modify: `mobile/app/(app)/budgets.tsx`

**Interfaces:**
- Produces exactly five bottom actions: `overview`, `accounts`, central `create`, `reports`, and `other`.
- Produces `buildTransactionInput` with amount-first expense/income/budget fields and transfer FX fields.
- Keeps budgets reachable from Other and workspace-scoped.

- [ ] **Step 1: Write failing navigation and payload tests.**

```ts
it('keeps only home, account, plus, report, and other actions', () => {
  expect(bottomNavigationSections()).toEqual([
    'overview', 'accounts', 'create', 'reports', 'other',
  ]);
});

it('builds a budgeted expense from the selected account currency', () => {
  expect(buildTransactionInput({
    kind: 'expense', accountId: 'cash', currency: 'VND', amount: '125000',
    budgetId: 'food', description: 'Lunch', effectiveDate: '2026-09-06',
  })).toMatchObject({
    amount: { currency: 'VND', minorUnits: '125000' }, budgetId: 'food',
  });
});
```

- [ ] **Step 2: Run focused tests and confirm they fail because the old seven-section navigation and form shape remain.**

Run: `pnpm --filter mobile test -- bottom-navigation-layout.spec.ts transaction-detail.spec.ts --runInBand`

- [ ] **Step 3: Implement five-item navigation and central plus routing.**

Keep the current rounded teal navigation styling, remove direct Group/Inbox/
Budgets actions from the bottom bar, and make the center plus navigate to
`/(app)/transaction/new` with modal presentation.

- [ ] **Step 4: Implement amount-first transaction form and manual cross-currency transfer UI.**

Default the first visible account and currency, show budget only for
expense/income, show destination amount/rate only when source and destination
currencies differ, and invalidate overview/accounts/transactions/reports after
success. Preserve offline restrictions: only manual income/expense drafts may
enter the outbox; transfers remain online-only.

- [ ] **Step 5: Add Other route with links to Budgets and Settings, then verify the budget screen stays workspace-scoped.**

- [ ] **Step 6: Run focused tests, mobile typecheck, and formatter.**

Run: `pnpm --filter mobile test -- bottom-navigation-layout.spec.ts transaction-detail.spec.ts --runInBand`

Run: `pnpm --filter mobile typecheck`

Run: `pnpm --filter mobile format:check`

### Task 9: Add settings UI and apply preferences to the shell

**Files:**
- Modify: `mobile/app/(app)/settings.tsx`
- Modify: `mobile/src/ui/app-shell.tsx`
- Modify: `mobile/src/ui/components.tsx`
- Test: `mobile/src/preferences/preferences.spec.ts`

**Interfaces:**
- Settings renders theme and language controls backed by `usePreferences()`.
- App shell reads translated labels and active palette without changing auth or workspace scope.

- [ ] **Step 1: Add failing preference integration assertions for persisted theme/language changes.**

```ts
it('persists the selected language and theme through the preference context', async () => {
  const store = new PreferencesStore(memoryStorage);
  await store.write({ theme: 'dark', language: 'vi' });
  await expect(store.read()).resolves.toEqual({ theme: 'dark', language: 'vi' });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails before settings controls/context wiring exists.**

Run: `pnpm --filter mobile test -- preferences.spec.ts --runInBand`

- [ ] **Step 3: Implement settings controls and apply palette/dictionary values to the app shell and new screens.**

Use accessible buttons/selectors, show current values, and preserve existing
security/offline draft controls. Do not translate backend error codes by
parsing arbitrary message text; map stable local UI labels only.

- [ ] **Step 4: Run the focused settings tests and mobile typecheck/format checks.**

Run: `pnpm --filter mobile test -- preferences.spec.ts --runInBand`

Run: `pnpm --filter mobile typecheck`

Run: `pnpm --filter mobile format:check`

### Task 10: Update documentation, walkthrough, and run all verification gates

**Files:**
- Modify: `docs/implementation-plan/phases/08-REACT-NATIVE-MOBILE.md`
- Modify: `docs/implementation-plan/phases/03-LEDGER-ACCOUNTS-TRANSACTIONS.md`
- Modify: `docs/implementation-plan/phases/04-CLASSIFICATION-BUDGETING-REPORTING.md`
- Modify: `contracts/openapi.json` if final generated examples changed during implementation
- Create: `docs/reviews/2026-09-06-mobile-onboarding-account-settings-walkthrough.md`

- [ ] **Step 1: Write the walkthrough after the implementation is green.**

Document scope/non-goals, affected modules, business rules, data flow, public
API and UI behavior, migration/security implications, verification results,
known gaps, and concrete follow-up work. State clearly that bank linking and
automatic FX fetch remain outside the slice.

- [ ] **Step 2: Update active phase plans and requirements traceability.**

Record onboarding, account currency/icon, five-item navigation, manual FX, and
local preferences as delivered behavior; do not mark automatic bank linking or
external FX provider work as delivered.

- [ ] **Step 3: Run the complete verification suite.**

Run: `npm test`

Run: `npm run test:e2e -- --runInBand`

Run: `npm run test:mobile`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run format:check`

Run: `npm run contracts:check`

Run: `npm run build`

Run: `git diff --check`

- [ ] **Step 4: Review the final diff for secrets, generated artifacts, accidental unrelated edits, and clean worktree state.**

- [ ] **Step 5: Commit the implementation and walkthrough with a Conventional Commit message.**

```bash
git add AGENTS.md backend contracts docs frontend mobile packages
git commit -m "feat: add mobile workspace setup and multi-currency accounts"
```
