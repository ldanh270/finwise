# Mobile bottom padding and spacing normalization walkthrough

Date: 2026-09-03  
Scope: Mobile scroll padding and bottom navigation layout spacing normalization

## Scope and non-goals

This slice resolves an issue where excessive, unbalanced empty whitespace accumulated at the bottom of mobile screens.

Specific fixes:
1. **Scroll content padding**: Reduced `paddingBottom: 110` in `ScrollScreen` (`components.tsx`) to `paddingBottom: 20`, balancing it evenly with `padding: 20` applied to the top and sides of the content area.
2. **Bottom navigation bar spacing**:
   - Replaced fixed `height: 72` and asymmetric `paddingTop: 6` with balanced `paddingTop: 8` and dynamic `paddingBottom: insets.bottom > 0 ? insets.bottom : 8`.
   - Switched root `SafeAreaView` to `react-native-safe-area-context` with `edges={["top", "left", "right"]}` so the white navigation bar surface extends to the bottom glass of the device, eliminating the disjointed background canvas gap below the navbar.

Non-goals:
- Did not change screen routes, query caching, or financial logic.

## Affected files and modules

- `mobile/src/ui/components.tsx`: Normalized `scroll` style to `padding: 20, gap: 16, paddingBottom: 20`.
- `mobile/src/ui/app-shell.tsx`:
  - Imported `SafeAreaView` and `useSafeAreaInsets` from `react-native-safe-area-context`.
  - Configured top/left/right safe edges on the root container.
  - Applied symmetrical 8px vertical padding to the nav bar (accounting for `insets.bottom` on gesture-enabled devices).

## UX/UI Improvements

- Content cards inside scroll screens no longer float above a 110px empty void when scrolled to the end.
- Navigation bar items (pill + label) are vertically centered within the tab bar rather than skewed toward the top border.
- The bottom bar integrates naturally with device gesture navigation and home indicators.

## Verification

- `pnpm --filter mobile format:check` — PASS.
- `pnpm --filter mobile typecheck` — PASS.
- `pnpm test:mobile` — 19 test suites, 61 unit tests, and native config tests PASS.
