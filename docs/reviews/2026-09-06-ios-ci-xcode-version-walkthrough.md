# iOS CI Xcode version fix walkthrough — 2026-09-06

## Scope and non-goals

This slice fixes the native iOS CI failure where CocoaPods rejected the
generated Podfile because React Native 0.81.5 detected Xcode 15.4. It does not
change the Expo, React Native, CocoaPods, or application dependency versions,
and it does not alter runtime iOS behavior.

## Affected files

- `.github/workflows/ci.yml` — selects the macOS 15 GitHub-hosted runner for
  the iOS native job and logs the selected Xcode version before installation.

## Root cause and data flow

```text
macos-14 runner -> Xcode 15.4 -> React Native 0.81.5 Podfile guard -> pod install fails
macos-15 runner -> Xcode >= 16.1 -> generated Podfile can continue to CocoaPods
```

React Native 0.81.5 requires Xcode 16.1 or newer. The previous `macos-14`
runner selected Xcode 15.4, so the generated Podfile failed before dependency
resolution. The fix changes only the CI runner image and adds an early version
diagnostic.

## Public API and UI behavior

No public API, application UI, or persistence behavior changed.

## Migration and security implications

No database or app migration is required. The workflow continues using frozen
pnpm dependencies, generated Expo native projects, CocoaPods, and an unsigned
iOS Simulator build. No secrets or credentials are added.

## Verification

- `npm --prefix frontend exec -- prettier --check .github/workflows/ci.yml` —
  pass.
- `git diff --check` — pass.
- Existing repository typecheck, tests, e2e, lint, format, contract, backend,
  frontend, and Expo JavaScript export gates were already rerun before this
  workflow-only change and passed.

The actual `pod install` and `xcodebuild` steps require the GitHub macOS runner
and must be confirmed by the next CI run; they cannot execute on this Windows
workspace.

## Known gaps and follow-up

If the macOS 15 image ever changes its selected Xcode version, the new log step
will expose that immediately; pin the image/toolchain further only if that
runner no longer provides Xcode 16.1 or newer.

## Commit message

```text
fix(ci): use Xcode-compatible macOS runner for iOS build

Move the native iOS job to macos-15 for React Native 0.81.5 and log the
selected Xcode version before CocoaPods runs.
```
