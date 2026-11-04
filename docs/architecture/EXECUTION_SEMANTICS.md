# Execution Semantics
**Status:** proposed · **Gates:** 4B, 4D

## Execution states
`queued` → `running` → `waiting_approval` / `retrying` / `completed` / `failed` / `needs_review` / `cancelled`. Transitions are guarded by persisted current state; terminal states are not silently reopened.

## Scheduling
Only published acyclic graphs run. Trigger fires once; ready nodes have satisfied predecessor dependencies. `condition` selects declared edges; unreachable/skipped nodes are recorded deterministically. Node budgets and timeouts are enforced by worker.

## Persistence and queue consistency
Webhook intake must atomically persist `WebhookReceipt`, `Execution`, initial `ExecutionEvent`, and enqueue command. Proposed: pg-boss with the exact same PostgreSQL transaction/connection via validated integration adapter. **No guarantee is claimed until a real rollback/commit spike verifies it.** Fallback: transactionally written outbox + independent dispatcher.

## Worker delivery
Queue delivers at least once. Worker claims with lease/heartbeat and idempotent transition guards. Worker crash before commit permits safe retry. Worker crash after external effect but before receipt creates an **uncertain effect** unless reconciled. Exactly-once effects are not promised for general HTTP APIs.

## External side effects
Before calling a write connector: authorize, validate destination, calculate stable operation key, persist action intent. Connector uses provider-supported idempotency key when available. On timeout/ambiguous response, reconcile by provider lookup or enter `needs_review`; do **not** automatically duplicate.

## Human approvals
Persist a one-time approval with expected execution state, approver authorization, expiry and payload digest. Approval/rejection and continuation enqueue must be atomic; duplicate clicks do not resume twice.

## Cancellation and retries
Cancel between steps, not a guarantee of undoing an in-flight provider operation. Retry policies depend on error class and idempotency; exponential backoff with jitter and capped attempts; poison jobs route to recorded failure/review.

## Tests required
Commit+enqueue, rollback+no job, duplicate webhook, double approval, crash before/after external effect, timeout, connector ambiguity, event replay after reconnect, cancellation boundary, workspace isolation.
