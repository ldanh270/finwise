# Mobile Onboarding, Accounts, Currency, and Navigation Design

## Goal

Make the first-run mobile experience start with workspace setup, require an
initial account, and provide a fast money-entry flow with workspace budgets,
per-account currencies, local theme/language settings, and a five-item bottom
navigation that matches the current Finwise visual language.

The attached screenshots are visual references only. The active product rules
come from this specification and the user's request; the UI keeps Finwise's
existing teal canvas, rounded cards, typography, spacing, and state panels.

## Scope and delivery slices

This work is divided into three independently testable vertical slices:

1. **Onboarding and account foundation** — empty-workspace onboarding, atomic
   workspace creation with an initial account, default workspace budgets,
   account icon/currency/opening amount, and multi-currency read models.
2. **Fast money entry and navigation** — five-item bottom navigation, central
   plus action, amount-first transaction form, budget selection, and manual
   cross-currency transfers.
3. **Other/settings** — workspace-scoped budget entry, theme selection,
   Vietnamese/English dictionaries, and persisted local preferences.

Bank-provider linking and automatic exchange-rate fetching are not part of this
slice. The API will leave room for a provider adapter later; the first usable
currency conversion flow is explicit manual input so the app never silently
uses an unverified rate.

## Business rules

### Workspace onboarding

- A newly authenticated user with no active workspace is shown onboarding,
  rather than receiving an implicit `Personal` workspace.
- Creating a workspace requires one initial account in the same application
  operation. Partial setup is not a successful response.
- The initial workspace contains these active budget buckets:
  `Food`, `Shopping`, `Education`, `Transport`, `Housing`, `Health`, `Bills`,
  and `Other`.
- Existing users with an active workspace skip onboarding. Existing historical
  data is not rewritten by the new flow.
- Workspace budgets belong to the workspace, never to an account.

### Accounts

- An account has a name, icon key, account kind, currency code, visibility
  policy, and status.
- Supported MVP currencies are `VND`, `USD`, `EUR`, `GBP`, `JPY`, `KRW`,
  `CNY`, `SGD`, `THB`, and `AUD`. The list is a typed allow-list shared by
  backend and clients.
- Currency metadata owns display symbol/code and minor-unit scale. Financial
  values remain integer minor-unit strings or `bigint`; JavaScript floating
  point is never used for calculations.
- Account opening amount is optional for additional accounts and required as a
  field in the initial-account form. A non-zero opening amount creates the
  existing auditable opening-balance journal.
- Workspace summary totals are grouped by currency. The app never adds VND,
  USD, or another currency into a misleading single total.

### Transactions and transfers

- The central `+` action opens a transaction form with amount as the first
  field and a compact type control for expense, income, and transfer.
- Expense and income use the selected account's currency. Expense records may
  select one workspace budget; transfers never select a budget.
- A same-currency transfer uses one amount for both accounts.
- A cross-currency transfer requires either the destination received amount or
  a manually entered exchange rate. If both are supplied, the received amount
  is authoritative and the rate is display/audit metadata.
- A transfer stores source and destination entry currencies and amounts while
  keeping one atomic account movement. No exchange rate is fetched implicitly.
- Cross-currency expense/income can be recorded, but budget actuals remain
  limited to transactions in the workspace reporting currency until a future
  explicit conversion allocation flow is added. The UI labels this limitation
  instead of presenting a false budget total.

### Preferences and language

- Settings support `system`, `light`, and `dark` themes.
- Settings support English and Vietnamese for the new navigation, onboarding,
  account, transaction, and settings copy. Existing feature copy falls back to
  English until translated.
- Preferences are device-local and do not affect server authorization or
  financial records.

## Architecture and data flow

```text
auth session -> bootstrap -> empty/ready workspace gate
                         -> create-workspace setup command
                            -> workspace + owner + initial account + opening journal
                            -> seeded workspace budgets

account currency -> amount form -> typed transaction command
                                  -> server-owned journal + grouped balances

workspace budgets -> Other/Budget screen -> workspace budget APIs

local preference store -> theme/language context -> UI labels and palette
```

The backend keeps business rules in the core application/store boundary and
maps provider-neutral domain records to HTTP responses. The current
transitional runtime snapshot remains the persistence path for this slice; no
bank SDK or external rate service is introduced.

## API and contract changes

- Add a typed `CurrencyCode` union and currency metadata response shape.
- Change workspace and account currency response fields from the VND-only
  literal to `CurrencyCode`.
- Add `iconKey` to account responses and account-create input.
- Extend workspace creation to accept:

  ```text
  {
    name,
    kind,
    defaultCurrency,
    initialAccount: {
      name,
      iconKey,
      kind,
      currency,
      openingBalanceMinorUnits
    }
  }
  ```

- Seed default budgets during workspace creation and return the created
  workspace, initial account, and budgets.
- Extend account creation with `currency`, `iconKey`, and optional opening
  amount. The server keeps account creation and its opening journal atomic.
- Extend transfer creation with optional destination amount and manual rate
  fields, and expose per-entry currency in transaction responses.
- Update OpenAPI and the shared API client before mobile UI consumers.

## Mobile UI behavior

- The authenticated route renders an onboarding setup screen when bootstrap
  has no workspaces; it renders the current app shell when a workspace exists.
- Onboarding is a short two-step form: workspace name, then initial account
  details. Currency and icon use visible sample pickers.
- Account screen shows grouped currency sections, account icons, and a clear
  add-account action with name/icon/kind/currency/opening amount.
- Home shows currency-grouped balances and a primary quick-add affordance.
- Bottom navigation contains exactly `Home`, `Account`, central `+`, `Report`,
  and `Other`. Budget and settings are reached from Other.
- Other contains entry points for Budgets, Settings, and future utilities.
- Loading, empty, error, retry, stale/offline, and permission states remain
  explicit for every data-driven screen.

## Error handling and security

- Workspace setup validates names, currencies, account kind, icon key, and
  non-negative opening amounts at the HTTP boundary and again in the core.
- Currency mismatches, missing cross-currency conversion input, archived
  records, and unauthorized workspace/account access return typed Finwise
  errors.
- Workspace setup must not leave an owner without the required initial account
  or seed budgets if a later operation fails.
- Tokens stay in SecureStore and never enter route params, local preference
  values, logs, or transaction drafts.
- Confirmed balances remain server-owned; mobile cache/outbox is workflow
  state only.

## Testing requirements

- Domain/application tests cover empty bootstrap, atomic workspace setup,
  default budget seeding, account icon/currency validation, grouped currency
  balances, same-currency transfers, and cross-currency transfer validation.
- API/e2e tests cover workspace setup payloads, authorization, typed currency
  responses, and idempotent opening/transfer commands.
- Mobile tests cover onboarding gate, five-item navigation, central plus route,
  amount-first form payloads, account/currency picker state, and persisted
  theme/language preferences.
- Run backend/mobile tests, e2e, typecheck, lint, formatter, OpenAPI checks,
  and production build before completion.

## Non-goals and follow-up

- No automatic bank linking or bank-provider sync is added here.
- No external exchange-rate fetch is added here. A future adapter can provide
  cached rates with source/timestamp/audit metadata.
- No redesign of group, wealth, ingestion, or web-specific screens beyond
  shared contract compatibility.
- Budget actual conversion for non-reporting currencies requires a separate
  explicit allocation/FX design.
