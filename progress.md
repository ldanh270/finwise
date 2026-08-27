# Progress log

## 2026-08-27

- Selected Flutter/Dart as the mobile implementation for a shared iOS and
  Android codebase; removed Expo from the target architecture.
- Confirmed that Next.js web and both Flutter mobile builds call one shared
  NestJS business API.
- Added detailed technical and Flutter mobile architecture documents, including
  OpenAPI-generated clients, authentication boundaries, offline scope, local
  storage, environments, build/release requirements, testing, and Expo source
  migration.
- Updated the decision log and implementation-plan index with the confirmed
  platform decisions.
- Started a planning-with-files audit to verify that no confirmed requirement
  remains only in the conversation.
- Replaced stale Expo-only instructions in `mobile/AGENTS.md` with the confirmed
  Flutter migration and architecture boundaries.
- Audited requirements, domain, decision, and architecture document headings
  and searched for stale active Expo guidance.
- Verified `git diff --check` passes and every relative Markdown link under
  `docs/` resolves.
- Completed the Flutter/shared-backend planning phase. Confirmed decisions are
  persisted; remaining Proposed/Open items remain visible for future sessions.

## 2026-08-26

- Reopened product discovery with the product owner.
- Confirmed personal and shared workspace isolation, soft budgets, custom
  permission-based roles, VND-only MVP, and private bank-import review by the
  connection custodian.
- Marked the existing Prisma schema as an unapproved draft pending domain and
  ledger redesign.
- Created living SRS, RDS, decision log, and implementation planning index under
  `docs/`.
- Recorded savings, lending, investment valuation, cross-workspace movement,
  and group reimbursement as proposals/open questions rather than silently
  committing them to the database design.

## 2026-08-25

- Reviewed the existing repository structure.
- Reviewed the current Finwise DBML from the conversation context.
- Created the planning files required for a multi-step implementation plan.
- Created the documentation structure under `docs/implementation-plan/`.
- No application source code or existing files were modified.
- Added separate Markdown plans for database, backend, frontend, bank sync,
  security, and QA.
- During verification, an untracked `frontend/` application directory was
  found. It was not created, edited, or deleted by this task.
- Confirmed `frontend/AGENTS.md` contains Next.js-generated guidance and kept
  that block unchanged.
- Added root `AGENTS.md` with shared SOLID, Clean Code, Clean/Hexagonal
  Architecture, design-pattern, financial-domain, testing, and delivery rules.
