# Mobile bottom-navigation overflow walkthrough

Date: 2026-09-03

## Scope and non-goals

This slice fixes the mobile bottom navigation being clipped at the right edge
on the Overview screen. The seven existing navigation destinations, labels,
icons, active state, and router destinations are unchanged.

Non-goals: redesigning navigation, changing route ownership, changing mobile
business rules, or modifying the unrelated in-progress auth changes in the
worktree.

## Affected files and modules

- `mobile/src/ui/app-shell.tsx`: renders the bottom navigation as a fixed-width
  row whose items share the available viewport width.
- `mobile/src/ui/bottom-navigation-layout.ts`: keeps the responsive layout
  contract in a framework-neutral module that can be tested without native
  runtime setup.
- `mobile/src/ui/bottom-navigation-layout.spec.ts`: regression proof for the
  full-width content row and flexible navigation items.

## Root cause and business rules

The navigation had seven items with `minWidth: 62`. On a 428dp viewport, the
minimum item total was 434dp, so the horizontal `ScrollView` content extended
past the viewport and the final Inbox item was partially clipped. This was a
presentation defect only; no financial, authorization, or persistence rule
changed.

The navigation now uses one equal-width item per destination. The row is always
100% of its parent and each item has `flex: 1` with `minWidth: 0`, so the full
set fits the available width without changing navigation behavior.

## Data flow and public behavior

The existing flow remains:

```text
active route -> AppShell -> bottom navigation Pressable -> expo-router replace
```

All seven tabs remain keyboard/screen-reader addressable `Pressable` controls,
retain their selected accessibility state, and still route Overview to
`/(app)` and other sections to `/(app)/<section>`.

## Migration and security implications

No database, API, migration, storage, authentication, authorization, or secret
handling changes. No native project files are modified.

## Verification

- `pnpm test -- bottom-navigation-layout.spec.ts --runInBand` — PASS.
- `pnpm test -- --runInBand` — 19 suites, 61 tests PASS.
- `pnpm typecheck` — PASS.
- `pnpm format:check` — PASS.
- `pnpm run export:android -- --no-bytecode` — PASS; Android bundle generated
  from 1,102 modules. `--no-bytecode` was required because the default export
  could not execute the local Windows `hermesc.exe` (`permission denied`).
- `pnpm run export:ios -- --no-bytecode` — PASS; iOS bundle generated from
  1,106 modules.
- `git diff --check` — PASS.

## Known gaps

The attached-device screenshot was not re-captured in this Windows session.
Physical iOS/Android visual verification remains a device/runtime gate. The
default Hermes bytecode export remains blocked by the local executable
permission issue; the JavaScript bundles export successfully without bytecode.

## Follow-up

Verify the bottom navigation on the supported narrowest iOS and Android device
profiles, including large accessibility text settings, before release.
