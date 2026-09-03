# Mobile navigation UI/UX enhancement walkthrough

Date: 2026-09-03  
Scope: Mobile bottom navigation icon sizing, active pill indicator, and tab transition freeze fix

## Scope and non-goals

This slice addresses two UX/UI improvements on the mobile app:
1. **Icon visibility & sizing**: Enlarged navigation glyphs (from 20px to 22px/26px line height), upgraded icons to bolder and clearer representations, and introduced an active pill indicator (`#e4f3f0` rounded container) for the active tab.
2. **Tab transition sliding**: Fixed the issue where switching between tabs triggered a native horizontal slide animation that animated the entire screen including the bottom navigation bar and top bar.

Non-goals:
- Did not change routing URLs, authorization checks, or business logic.
- Creation modal (`transaction/new`) retains its vertical slide modal presentation.

## Affected files and modules

- `mobile/app/(app)/_layout.tsx`: Configured `animation: "none"` on the authenticated layout stack so tab switching is instantaneous without sliding the stationary shell. Preserved `slide_from_bottom` modal animation for `transaction/new`.
- `mobile/src/ui/app-shell.tsx`:
  - Enlarged navigation icon typography and updated glyphs (`⊞` Overview, `▣` Accounts, `⇄` Transactions, `◔` Budgets, `▤` Reports, `◎` Group, `✉` Inbox, `⚙` Settings).
  - Added `navIconPill` container with `colors.tealSoft` active background.
  - Added `navLabelActive` with `colors.teal` and font weight 700.

## User experience improvements

- **Standard Mobile Tab Behavior**: Switching between tabs feels instant and native. The bottom bar and top header stay fixed in place without sliding across the screen.
- **Touch Targets & Visual Polish**: Navigation items now follow standard mobile touch guidelines (touch target height ~60dp with 32dp pill), clearer iconography, and immediate visual feedback on the active tab.

## Verification

- `pnpm --filter mobile format:check` — PASS.
- `pnpm --filter mobile typecheck` — PASS.
- `pnpm test:mobile` — 19 test suites, 61 unit tests, and native config tests PASS.
