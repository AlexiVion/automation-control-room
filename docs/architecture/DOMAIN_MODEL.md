# Domain Model and Invariants
**Status:** proposed · **Gate:** 4B

## Entities
| Entity | Main responsibility |
|---|---|
| `Workspace` | Authorization/isolation scope; demo workspaces isolated |
| `Workflow` | Stable workflow identity and ownership |
| `WorkflowDraft` | Mutable graph under authoring |
| `WorkflowVersion` | Immutable published graph + digest and policy snapshot |
| `Execution` | One run of an immutable workflow version |
| `StepExecution` | One node attempt/result with timestamps and retry budget |
| `ExecutionEvent` | Append-only run transitions; monotonic sequence cursor |
| `ApprovalRequest` | Durable human review, expiry, one-time decision |
| `ActionLedger` | External side effects, operation key, attempts and uncertain outcomes |
| `ConnectorCredential` | Encrypted secret material and metadata; least-privilege reference |
| `WebhookReceipt` | Event deduplication and replay protection |
| `DemoCRMRecord` | Isolated fixture for the showcase |

## Hard invariants
- `Execution.workflowVersionId` is immutable; published graph cannot change under an active run.
- A unique `(workspaceId, sourceId, sourceEventId)` prevents duplicate webhook execution.
- Each execution event is append-only with unique `(executionId, sequence)`.
- Every state transition is atomic and guarded by expected version/state (optimistic CAS).
- Approval can be decided once by a permitted actor and expires/cancels explicitly.
- ActionLedger operation key is stable across worker retries. An ambiguous response becomes `needs_review`.
- Workspace and demo session scope are checked at **every** data access and effect boundary.

## Open items
Concrete SQL schema, foreign keys, retention/TTL, optimistic concurrency version columns, indexes, data minimization and PII encryption policy.
