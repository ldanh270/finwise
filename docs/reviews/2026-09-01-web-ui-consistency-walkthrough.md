# Web UI consistency walkthrough

Date: 2026-09-01  
Scope: dashboard typography, empty-state layout, Group Treasury summary cards,
and duplicate profile affordances

## Scope and non-goals

This slice aligns the web shell and the three screens represented in the
reported screenshots. It fixes the runtime font mismatch, restores the
structured Overview empty state, brings Group Treasury metrics onto the shared
stat-card layout, and keeps the interactive profile/sign-out card in the
sidebar as the single profile affordance.

It does not change financial calculations, API contracts, authentication,
authorization, navigation destinations, database schema, or mobile UI.

## Affected files and modules

- `frontend/app/globals.css` — uses the loaded Geist family for application UI,
  adds responsive empty-state primitives, and removes obsolete topbar-avatar
  styling.
- `frontend/src/features/dashboard/dashboard-page.tsx` — removes the
  non-functional duplicate topbar profile button; the sidebar user card keeps
  the existing sign-out action.
- `frontend/src/features/group/group-treasury-page.tsx` — maps summary metrics
  to the existing `.stat-card-top`, `.stat-amount`, and `.stat-helper` styles.
- `docs/implementation-plan/phases/07-WEB-MVP-RELEASE.md` — records this
  delivered hardening slice.

## Business rules

- The backend remains the source of truth for workspace data and permissions;
  this is presentation-only work.
- Profile actions must have one clear location. The retained sidebar card is
  the existing authenticated sign-out path; the removed topbar avatar had no
  menu or action behind it.
- Money values remain formatted by the existing VND formatter and are not
  converted through JavaScript floating-point arithmetic.
- Empty, loading, denied, and error states remain distinct; this change only
  makes the empty state readable and actionable.

## Data flow

```text
Bootstrap/overview/group report response
  -> feature component markup
  -> shared CSS primitives and Geist runtime font
  -> responsive browser layout
```

No request, mutation, cache, or projection flow changed. Group summary values
still come from the existing workspace-scoped group report response.

## Public API and UI behavior

No public API or OpenAPI contract changed.

- Overview: when the workspace has no accounts or transactions, the wallet
  illustration, copy, and two actions now render as a bounded card with a
  deliberate flex layout. The actions wrap and stack on narrow screens instead
  of overlapping.
- Group Treasury: each metric now has a block-level label, amount, and helper
  line, so values such as `Collected`, `0 ₫`, and `of 0 ₫ expected` cannot run
  together.
- Application shell: body text uses the Geist variable already loaded by the
  root layout. Editorial headings and brand marks keep their intentional
  Georgia treatment; controls and metadata inherit the same UI family.
- Profile: the sidebar user card remains the only profile identity/control
  surface. The topbar retains notifications but no longer shows a second,
  non-functional avatar.
- Mobile/web: the existing sidebar drawer and responsive grids remain intact;
  the new empty state uses a vertical action layout below 760px.

## Domain/schema and migration notes

No domain model, Prisma schema, migration, seed, or database data changed.
There is no rollout or rollback data step for this slice.

## Security implications

Removing the topbar avatar does not alter session storage or authorization. It
reduces an ambiguous, non-functional control while preserving the existing
server-backed sign-out action. No tokens, credentials, or financial payloads
are logged or exposed.

## Test matrix and verification

| Area | Result |
| --- | --- |
| Changed TypeScript formatting | Pass — Prettier check |
| Frontend lint | Pass — `pnpm --dir frontend lint` |
| Frontend typecheck | Pass — `pnpm --dir frontend typecheck` |
| Production build | Pass — `pnpm --dir frontend build` |
| Diff hygiene | Pass — `git diff --check` |
| Web route smoke | Pass — `GET http://localhost:3000/auth` returned `200` and rendered `Welcome back` |
| API health smoke | Pass — `GET http://localhost:3001/v1/health/live` returned `200` |
| Auth/bootstrap smoke | Pass — seeded demo login returned `200`; bearer bootstrap returned `200` with one workspace |
| Visual regression | Screenshot defects addressed in Overview, Group Treasury, shell/profile; browser-device matrix remains follow-up work |

## Exit criteria

- Shared UI copy no longer falls back to Arial while the app loads Geist.
- Overview empty-state content has a stable, responsive layout with no action
  overlap.
- Group Treasury summary cards use the same vertical rhythm as Overview cards.
- There is one profile affordance in the shell, with sign-out still available.
- Frontend lint, typecheck, build, and smoke checks pass.

## Known gaps and follow-up work

- Add screenshot-based visual regression coverage at desktop, tablet, and phone
  widths so future CSS changes cannot reintroduce overlap.
- Add a functional profile menu only if product later requires preferences or
  account settings; do not reintroduce a decorative duplicate avatar.
- Run keyboard/screen-reader checks against each data screen in the Phase 7
  pilot gate.
- The stylesheet still uses the repository's compact legacy formatting; the
  changed TypeScript files are formatter-clean without rewriting unrelated CSS.

## Suggested Conventional Commit

```text
fix(web): normalize dashboard UI typography and empty states

Use the loaded Geist family across application chrome, align Group Treasury
metrics with shared stat-card primitives, make the empty workspace responsive,
and remove the duplicate non-functional profile affordance.
```
