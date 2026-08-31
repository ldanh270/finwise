# Group collection progress walkthrough — 2026-08-31

## Scope

This slice adds a read-only collection progress projection for Group Treasury.
Members can see total obligations, verified paid amount, outstanding amount,
participant count, and fully paid participant count without treating pending
submissions as cash.

## Non-goals

- This does not add durable collection/report projection tables or receipt
  allocation across multiple obligations.
- It does not change obligation, submission, or Ledger posting semantics.
- No Group Treasury UI was added in this backend contract slice.

## Affected files and modules

- `backend/src/group/application/group.service.ts` — exact `bigint` progress
  aggregation and MoneyDto mapping.
- `backend/src/group/presentation/group.controller.ts` — progress endpoint.
- `backend/src/group/application/group.service.spec.ts` — initial and partial
  payment coverage.
- `contracts/openapi.json` — public endpoint and response schema.

## Business rules

- Workspace membership is enforced by the existing obligation store port.
- Only obligation payments already applied by contribution verification count as
  paid; submitted evidence remains pending.
- Outstanding is clamped at zero for defensive projection safety.
- All money values remain VND minor-unit strings; no floating-point arithmetic is
  used.

## Data flow

```text
GET collection progress
 -> workspace membership + collection scope
 -> obligation records (verified paid amounts)
 -> bigint aggregation
 -> typed progress response
```

## Public API and UI behavior

`GET /v1/workspaces/:workspaceId/group/collections/:collectionId/progress`
returns `collectionId`, `total`, `paid`, `outstanding`,
`participantCount`, and `completedParticipants`. A future web campaign screen
can render progress without inferring cash from pending submissions.

## Migration and security implications

No migration is added. A persistent adapter must preserve workspace and
collection composite scoping and should index obligations by collection. The
endpoint exposes only aggregate values already visible to a workspace member.

## Verification

- Backend Prettier: passed for changed TypeScript files.
- Backend ESLint: passed for changed TypeScript files.
- Backend TypeScript check: passed.
- Group service Jest suite: passed (4 tests).
- OpenAPI validation: passed.
- Repository `git diff --check`: passed.

## Known gaps and follow-up

1. Add durable collection/report projections and cursor pagination.
2. Add receipt allocation and multi-participant progress updates.
3. Add the web collection progress, reviewer, and overpayment-resolution UI.

## Commit message

`feat(group): expose collection progress projection`

The response is derived from verified obligation payments and keeps pending
submissions out of confirmed cash totals.
