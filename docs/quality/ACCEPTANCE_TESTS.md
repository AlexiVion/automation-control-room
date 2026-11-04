# Acceptance and Test Matrix
**Status:** proposed · **Gate:** 4F

## Test hierarchy
TypeScript typecheck/lint; unit tests for schema/engine/policy; PostgreSQL integration tests for transitions and queue; API contract tests; Playwright browser E2E; security and failure-injection cases. Never count mocked UI alone as proof of an effect.

## Required cases
| ID | Acceptance evidence |
|---|---|
| AT-01 | Clean-clone Compose boot with migrations and fixture |
| AT-02 | Invalid DAG is rejected with actionable error |
| AT-03 | Published workflow version is immutable |
| AT-04 | Signed webhook accepted once; duplicate deduplicated |
| AT-05 | Invalid signature and stale replay rejected |
| AT-06 | Execution+enqueue commit together |
| AT-07 | DB transaction rollback leaves neither run nor job |
| AT-08 | Classification returns schema-valid output/fixture labeled |
| AT-09 | Sensitive write waits durably for approval |
| AT-10 | Approval cannot be decided twice or cross-workspace |
| AT-11 | Worker interrupted/restarted resumes safely |
| AT-12 | Connector retries only when verified safe |
| AT-13 | Ambiguous external effect becomes needs_review |
| AT-14 | CRM upsert is idempotent on repeated job |
| AT-15 | SSE resumes from persisted event cursor |
| AT-16 | Restricted HTTP node rejects internal targets and redirects |
| AT-17 | Guest isolation and budgets prevent cross-visitor interference |
| AT-18 | E2E demo shows real persisted run and final CRM record |

## Release gate
Evidence includes command, pinned dependency versions, test environment and result. CI should remain lean: one primary workflow for all critical checks, not redundant concurrent jobs.
