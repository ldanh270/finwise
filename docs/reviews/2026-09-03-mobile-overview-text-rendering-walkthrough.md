# Mobile overview text string rendering fix walkthrough

Date: 2026-09-03  
Scope: Mobile overview route JSX text node fix

## Scope and non-goals

This slice resolves a runtime error on the mobile overview screen (`mobile/app/(app)/index.tsx`) where React Fabric threw:
`ERROR Text strings must be rendered within a <Text> component.`

The change removes a stray whitespace text expression (`{" "}`) placed directly inside a `<View>` container next to `<Header>`. It does not change layout styling, data fetching, or component semantics.

## Affected files and modules

- `mobile/app/(app)/index.tsx` — removed stray `{" "}` child inside the activity header's `<View>`.

## Business rules and component behavior

- In React Native / Fabric, strings (including whitespace literals or `{" "}`) cannot be direct children of a `View` (`RCTView`). All textual content must be wrapped in a `<Text>` component.
- The recent transactions header card keeps its flex row layout with `justifyContent: "space-between"` without relying on inline text spacing.

## Verification

1. **AST Check**: Verified across all TSX files in `mobile` that no string literals or non-empty JSX text nodes exist directly under non-Text elements.
2. **Formatting**: `pnpm --filter mobile format:check` passed.
3. **Typecheck**: `pnpm --filter mobile typecheck` passed without diagnostics.
4. **Unit / Integration Tests**: `pnpm test:mobile` (Jest suite of 19 suites, 61 tests, and network security policy node tests) passed cleanly.
