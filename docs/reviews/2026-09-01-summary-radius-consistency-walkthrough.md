# Summary radius consistency walkthrough — 2026-09-01

## Scope

Align the dashboard and Group Treasury summary metric cards with the existing
top-level panel radius. The shared radius token is also reused by matching
loading placeholders so the loaded and loading states have the same silhouette.

## Non-goals

- No changes to metric content, layout, colors, API behavior, or interactions.
- No broad redesign of controls, nested list rows, or authentication surfaces.

## Affected files/modules

- `frontend/app/globals.css`
  - Adds the shared `--radius-panel` token at the design-system root.
  - Applies it to summary cards, top-level panels, and matching skeletons.

## Business rules and data flow

None. This is a presentation-only change; existing components and data flow are
unchanged.

## Public API and UI behavior

No public API changes. Summary cards now use the same 10px corner radius as the
main content panels, removing the previous 13px mismatch. Loading placeholders
use the same token to prevent a shape shift during fetches.

## Migration/security implications

None. No data, persistence, authorization, or security behavior changed.

## Verification

- `pnpm lint:frontend` — passed.
- `pnpm typecheck:frontend` — passed.
- `pnpm build:frontend` — passed.
- `git diff --check` — passed.

## Known gaps and follow-up

Other small nested surfaces intentionally retain their tighter radii because
they represent controls or list rows rather than top-level panels. Revisit them
only as part of a broader design-system token pass.
