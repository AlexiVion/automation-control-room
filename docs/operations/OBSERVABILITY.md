# Observability and audit contract

**Status:** proposed · **Gate:** 4F

## Source of truth

Append-only `ExecutionEvent` rows in PostgreSQL, uniquely ordered by `(executionId, sequence)`, are the canonical history. SSE and UI timelines are **views over persisted events**, not independent state.

## SSE replay

- Authenticated `GET /executions/{id}/events` with authorization by workspace.
- Cursor / `Last-Event-ID` resumes events with `sequence > cursor`.
- Heartbeats do not create domain events.
- Terminal state is still available via read API after reconnect.
- Client deduplicates replayed events by `executionId+sequence`.

## Metrics

Track intake accepted/rejected/duplicate, queue age, run/step duration, failures and retries, worker lease/restarts, approvals pending/expired, external-effect uncertainty, SSE lag, and provider usage/latency.

## Logging safety

Correlate requests, executions, steps and actions with IDs. Structured logs must redact secrets, sensitive lead data and raw provider responses by default. Traces and metrics never replace the audited ledger.

## Release criteria

Test SSE disconnect/reconnect, gap-free replay, unauthorized subscriptions, burst behavior and event retention cleanup against a real database.
