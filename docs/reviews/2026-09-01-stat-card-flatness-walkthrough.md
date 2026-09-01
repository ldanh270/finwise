# Summary card flatness walkthrough — 2026-09-01

## Scope

Refine the dashboard and Group Treasury summary cards so their hierarchy comes
from spacing, typography, icon tiles, and quiet tinted surfaces instead of
outlined boxes and colored top rules.

## Non-goals

- No changes to card content, calculations, API contracts, or interaction.
- No redesign of the bordered data panels, forms, or authentication screens.

## Affected files/modules

- `frontend/app/globals.css`
  - Removes the summary-card border, shadow, and accent top rule.
  - Adds restrained per-metric surface tints while retaining accessible text
    and icon color contrast.

## Business rules and data flow

No business or data-flow behavior changes. Existing overview and Group Treasury
responses still map to the same metric components; only their presentation
surface changed.

## Public API and UI behavior

No public API changes. The dashboard and Group Treasury metric rows now render
as flat, softly tinted blocks with the existing icon tile as the visual accent.
Responsive grid behavior and keyboard semantics are unchanged.

## Migration/security implications

None. This is a CSS-only presentation change.

## Verification

- `pnpm format:check` — passed.
- `pnpm lint:frontend` — passed.
- `pnpm typecheck:frontend` — passed.
- `pnpm build:frontend` — passed.
- `git diff --check` — passed.

## Known gaps and follow-up

The remaining content panels intentionally keep their light boundary so dense
forms and lists remain grouped. A future visual QA pass can tune those panels
against final product screenshots if the design direction is accepted.
