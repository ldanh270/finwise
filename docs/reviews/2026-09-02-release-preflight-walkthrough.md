# Release preflight walkthrough

Date: 2026-09-02  
Phase: 7/8/10 — web pilot, mobile release, and operations gates  
Status: Implemented as an executable configuration gate

## Scope and non-goals

This slice adds a deterministic `pnpm release:preflight` command for the
production environment. It fails closed when development authentication,
insecure endpoints, malformed JWT key material, unsafe TTLs, invalid origins,
or incomplete Expo/EAS identifiers are present. It does not provision cloud
credentials, sign an iOS/Android binary, send SMTP mail, or replace a physical
device test.

## Affected files and modules

- `scripts/release-preflight.mjs` — environment, cryptographic, URL, TTL, and
  mobile configuration checks.
- `scripts/release-preflight.test.mjs` — valid production and fail-closed
  scenarios using an ephemeral RSA pair.
- `package.json` — `release:preflight` and test script.
- Phase 7, 8, and 10 implementation plans — release boundary updates.

## Business rules and data flow

The command reads environment values without printing them, validates the
database protocol, verifies that the JWT private/public DER keys parse and can
sign/verify a probe payload, requires HTTPS for production web/mobile URLs and
origins, bounds access/refresh TTLs, and checks the checked-in app/EAS profiles.

```text
production env + checked-in Expo config
  -> validation + RSA pair verification
  -> READY or BLOCKED with safe error names only
```

## Public API and UI behavior

No runtime API changed. CI/deploy operators run `pnpm release:preflight` before
building or promoting a release. The command exits non-zero with a concise
JSON report when a gate is blocked; no client UI is involved.

## Migration and security implications

No migration. The check prevents accidental dev auth and cleartext production
traffic, and it verifies key-pair integrity without logging key bytes. Secrets
must still be supplied through the deployment secret manager.

## Verification

- `pnpm test:release-preflight`: passed (2 tests).
- Full typecheck/build gates remain green from the preceding Reports and
  persistence commits.
- `git diff --check`: passed.

## Known gaps and follow-up

1. Run the gate with real staging/production secrets in CI, not committed
   fixtures.
2. Configure SMTP, EAS project/credentials, iOS signing, backup/restore, and
   device matrix evidence in the deployment environment.
3. Add provider/bank and normalized Prisma repository checks when those
   external dependencies are selected.

## Commit message

```text
chore(release): add production preflight checks

Fail closed on unsafe auth, JWT, URL, TTL, and Expo/EAS release configuration
before a production build is promoted.
```
