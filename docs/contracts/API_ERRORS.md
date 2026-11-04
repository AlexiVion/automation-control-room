# API Error Taxonomy — Gate 4C

**Status:** proposed; server routes not yet implemented.

All failed JSON API responses use:
```json
{"error":{"code":"INVALID_GRAPH","message":"Workflow has a cycle","traceId":"req_...","retryable":false,"issues":[{"code":"CYCLE","path":"crm","message":"Workflow cycles are not allowed"}]}}
```

## Status mapping

| HTTP | Codes | Client action |
|---|---|---|
| 400 | SCHEMA_INVALID | Correct malformed JSON/header/unsupported content |
| 401 | UNAUTHENTICATED | Start session or authenticate; webhook sign correctly |
| 403 | FORBIDDEN, FORBIDDEN_CONNECTOR | Do not retry with the same grant |
| 404 | NOT_FOUND | Treat resource as unavailable in current workspace |
| 409 | CONFLICT, IDEMPOTENCY_CONFLICT, APPROVAL_EXPIRED | Fetch latest revision/state; do not submit effect again blindly |
| 422 | INVALID_GRAPH, INVALID_TRIGGER, DUPLICATE_ID, EDGE_MISSING_NODE, INVALID_DEGREE, INVALID_BRANCH, CYCLE, UNREACHABLE, DEPTH_EXCEEDED, LIMIT_EXCEEDED, MISSING_FINISH, APPROVAL_REQUIRED, UNSAFE_BINDING, INVALID_BINDING_SOURCE | Correct workflow and revalidate |
| 429 | RATE_LIMITED | Honor Retry-After; never exceed public demo budget |
| 500 | INTERNAL_ERROR | Correlate with traceId; never return secrets |
| 503 | TIMEOUT | Retry only when idempotency policy permits |

`PROVIDER_UNCERTAIN` and `NEEDS_REVIEW` are **run/step state outcomes**, not a generic retryable HTTP failure. The API must return the persisted run status and require explicit operator review instead of restarting effects.

Every mutating action enforces workspace authorization, expected revision or idempotency key where applicable, and structured validation at the server boundary. Diagnostic `issues` are scrubbed of user-provided secret content.

API DTO schemas: [api.ts](../../packages/contracts/src/api.ts). Shared RunStatus: [status.ts](../../packages/contracts/src/status.ts). They do not implement handlers or authorization.

References: `packages/contracts/src/errors.ts`, [OpenAPI](openapi.yaml), [execution semantics](../architecture/EXECUTION_SEMANTICS.md).
