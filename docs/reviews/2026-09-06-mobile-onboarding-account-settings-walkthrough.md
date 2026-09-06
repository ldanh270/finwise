# Mobile onboarding, account settings, and currency walkthrough

Date: 2026-09-06

## Scope

This slice adds first-run workspace/account setup, workspace default budgets,
account icons and currencies, manual cross-currency transfers, an amount-first
mobile add flow, the five-item mobile navigation, and local theme/language
preferences.

Non-goals are bank-provider linking, automatic exchange-rate fetching, a
multi-currency consolidated net-worth total, and a native-device Expo Go sign-
off. Cross-currency transfers deliberately use a user-supplied destination
amount or rate.

## Affected modules

- Backend core domain/application/store: typed currencies, atomic setup,
  account metadata/opening journals, currency-aware entries, and FX transfer
  validation/conversion.
- `packages/api-client` and `contracts/openapi.json`: currency, account icon,
  setup, grouped balances, and transfer response/request shapes.
- Mobile preferences, onboarding, account creation, transaction entry, shell,
  Other menu, settings, and amount formatting.
- Phase 8 implementation-plan documentation.

## Business rules and data flow

1. Bootstrap no longer invents a `Personal` workspace for a first-time user.
2. `POST /v1/workspaces` validates the workspace and required initial account,
   then creates owner membership, account, optional opening journal, and the
   default Food/Shopping/Education/Transport/Housing/Health/Bills/Other
   budgets through one store operation.
3. Account amounts are positive integer minor-unit strings. Account currency is
   validated against the supported MVP currency list and must match every
   journal entry posted to that account.
4. Same-currency transfers use one amount. Cross-currency transfers preserve
   both entry currencies and either use the explicit destination amount or
   convert with an exact decimal-string rate using bigint arithmetic.
5. Overview returns grouped account balances. The primary overview totals are
   only for one reporting currency and do not silently add unlike currencies.
6. Mobile preferences are persisted in the existing SQLite JSON key/value
   adapter, partitioned by authenticated user. Tokens remain in SecureStore.
7. Mobile offline drafts remain limited to income/expense; transfers require a
   server response.

## Public API and UI behavior

- `WorkspaceSetupResponse` returns the created workspace, initial account, and
  seeded budgets.
- `Account`/`AccountSummary` expose `currency` and `iconKey`.
- `Transaction` entries expose currency; transfer responses expose source and
  destination money plus an optional exchange rate.
- First entry renders a workspace setup screen with workspace/account names,
  sample account icons, currency, and initial cash amount.
- Account creation includes name, icon, kind, currency, and opening amount.
- The shell is Home, Account, Add, Report, Other. Other links to budgets,
  transaction history, and settings.
- Settings provides System/Light/Dark and English/Tiếng Việt selectors. The
  shell background and navigation labels react immediately; persisted values
  are restored for the user.

## Migration and security implications

The current backend runtime store gains fields without a destructive data
migration. Existing omitted account currency/icon inputs default to the
workspace currency and `cash`. Existing journal drafts infer entry currency
from the account. The setup rollback removes all records created by a failed
setup operation. Currency/rate inputs are validated at the application boundary
and the store rechecks account/entry currency invariants.

## Verification

- Backend unit tests: 18 suites, 67 tests passed.
- Backend e2e: 4 tests passed.
- Mobile typecheck passed.
- Mobile Jest: 20 suites, 62 tests passed.
- Backend and mobile Prettier checks passed.
- OpenAPI contract check passed.
- `git diff --check` passed.

## Known gaps and follow-up

- No bank-link provider integration was added; the existing bank account type
  remains manual.
- Native device/Expo Go smoke testing still depends on a reachable API and the
  local network environment.
- Reports and budget aggregates retain the existing MVP reporting-currency
  projection and should gain explicit per-currency report dimensions before a
  production multi-currency release.
