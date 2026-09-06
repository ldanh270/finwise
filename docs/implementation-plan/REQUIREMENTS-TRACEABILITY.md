# Finwise requirements traceability

This matrix maps every requirement identifier currently present in `SRS.md` to
the delivery phase, public surface, and proof expected at that phase. “Slice
proof” identifies the first vertical-slice test; later rows remain planned until
their phase is implemented.

| Requirement IDs | Phase | API / surface | Test evidence |
| --- | --- | --- | --- |
| FR-WS-001, FR-WS-002, FR-WS-003, FR-WS-004, FR-WS-005 | 02 | `/v1/session/bootstrap`, workspace resources | bootstrap and cross-workspace authorization |
| FR-ACC-001, FR-ACC-003, FR-ACC-005 | 03 | account resources, opening-balance command | account creation, exact balance and projection rebuild |
| FR-ACC-002, FR-ACC-004 | 09 | wealth and bank-beta resources | provider/wealth contract tests |
| FR-TXN-001, FR-TXN-002, FR-TXN-003, FR-TXN-004, FR-TXN-005 | 03 | transaction post/list/detail/void | balanced journal, atomic transfer, tenant isolation and audit tests |
| FR-TXN-006 | 04 | classification lines on transaction commands | split-sum and single-account-delta tests |
| FR-TXN-007 | 06 | reconciliation sessions/checkpoints | checkpoint and adjustment rebuild tests |
| FR-BUD-001, FR-BUD-002, FR-BUD-003, FR-BUD-004, FR-BUD-005, FR-BUD-006 | 04 | budget bucket, budget period and report resources | budget mode, rollover, late-correction and filtered-report tests |
| FR-TAG-001, FR-TAG-002 | 04 | tag and classification-line resources | tag lifecycle and report-filter tests |
| FR-AUTHZ-001, FR-AUTHZ-002, FR-AUTHZ-003, FR-AUTHZ-003A, FR-AUTHZ-004, FR-AUTHZ-005, FR-AUTHZ-006, FR-AUTHZ-007, FR-AUTHZ-008, FR-AUTHZ-009 | 02 | role, membership, account-scope and access-preview resources | allow-union, owner precedence, scope and `401`/`403` API tests |
| FR-IMP-001 | 03 | manual transaction commands | manual income/expense/transfer e2e |
| FR-IMP-002, FR-IMP-004, FR-IMP-005, FR-IMP-006, FR-IMP-007 | 06 | import inbox and confirmation resources | duplicate, delegation, terminal-action and bulk-confirm tests |
| FR-IMP-003 | 09 | provider-neutral bank adapter | sandbox consent, sync retry and normalized-record tests |
| FR-CUR-001 | 01–03 | `MoneyDto` and VND ledger contract | Money parsing/serialization tests |
| FR-CLIENT-001 | 07–08 | generated `/v1` client used by web/mobile | web/mobile contract and isolation tests |
| FR-LOAN-001, FR-LOAN-002 | 09 | lending contract and schedule resources | expected-vs-actual allocation tests |
| FR-INV-001, FR-INV-002, FR-WEALTH-001 | 09 | portfolio, trade, holding and valuation resources | quantity/cost-basis and no-fake-cash tests |
| FR-GRP-001, FR-GRP-002, FR-GRP-003, FR-GRP-004, FR-GRP-005, FR-GRP-006 | 05 | Group Treasury participant/collection/claim resources | partial payment, approval, sponsorship and no-double-count e2e |
| FR-GOAL-001, FR-GOAL-002, FR-GOAL-003 | 04 | savings-goal resources | progress-method and non-reserved-money tests |
| NFR-SEC-001 | 02, 06, 07 | trusted workspace scope, redacted logs | tenant leakage, aggregate inference and secret-scan tests |
| NFR-SEC-002 | 06, 09 | object storage and provider-token ports | encryption, retention and token-redaction tests |
| NFR-DATA-001 | 01, 03 | `Money`, `MoneyDto` | bigint/overflow/no-float tests |
| NFR-DATA-002 | 03, 05, 06 | unit-of-work and ledger posting ports | rollback/atomic transfer/confirm tests |
| NFR-DATA-003 | 03, 04, 06 | projection and rebuild endpoints/jobs | cached-vs-rebuilt balance and report tests |
| NFR-AUDIT-001 | 03, 05, 06, 07 | audit explorer and source links | immutable journal, reversal and audit retention tests |
| NFR-IDEMP-001 | 01, 03, 06, 08, 09 | `Idempotency-Key`, `clientCommandId` | replay, retry and duplicate prevention tests |
| NFR-UX-001 | 07, 08 | web/mobile data-state components | loading/empty/error/retry/denied/partial UI tests |
| NFR-CONSISTENCY-001 | 01, 07, 08 | generated client and server-owned rules | OpenAPI compatibility and cross-client e2e |

The first implemented slice currently proves the foundation subset of
`FR-CUR-001`, `FR-IMP-001`, selected `FR-ACC`/`FR-TXN` behavior, and the
idempotent/reversal portions of `NFR-DATA-*`, `NFR-AUDIT-001`, and
`NFR-IDEMP-001`. It does not mark later phase rows complete.
