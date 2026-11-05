# ADR 0003 — PostgreSQL-backed queue via pg-boss and Prisma

**Status:** proposed — **technical evidence PASS**, owner review pending  
**Evidence date:** 2026-11-04 · **Gate:** 4D

## Decision candidate

Adopt **PostgreSQL 17 + Prisma 7.10.1 + @prisma/adapter-pg 7.10.1 + pg-boss 12.38.0** to persist business state and queue commands atomically. Use `boss.send(queue,data,{db:fromPrisma(tx)})` within the same Prisma interactive transaction.

This is a **technical preference verified by an isolated spike**, not proof of a finished workflow engine or a production deployment.

## Evidence

[GitHub Actions — 33 total tests PASS](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254), including **9 real PostgreSQL reliability tests** in [Gate 4D spike](../../spikes/gate4d/README.md):

- Execution, initial event and job committed atomically.
- Rollback removes execution, event and queued job.
- Concurrent same-source intake creates one run and one job.
- Competing approval decisions produce only one winner.
- Approval decision + execution transition + event + resume job commit as a unit.
- Rolling back approval-resume transaction leaves pending approval and no orphan continuation.
- Jobs persist without a running consumer and are processed by an independent worker.
- After **SIGKILL** of a worker that claimed a job, pg-boss monitoring retries it; the replacement worker performs a single idempotent *local CRM* upsert.
- An ambiguous simulated external outcome persists `needs_review` and is never automatically replayed.

## Why

- Fewer operational components than a second Redis-based queue for MVP.
- Shared PostgreSQL transaction avoids the dual-write gap between business state and job creation.
- pg-boss supports at-least-once delivery, workers, expiry, retries and monitoring.

Official adapter contract: https://pgboss.io/api/adapters

## Alternatives

- **Separate Redis/BullMQ:** viable later but creates a two-store atomicity problem and another service to operate.
- **Transactional outbox in PostgreSQL:** reliable fallback if a supported version or deployment configuration cannot share the same physical transaction with pg-boss.
- **Direct Prisma + send() outside transaction:** rejected; can lose a job after a committed business write.

## Remaining limitations

- No generic exactly-once guarantee for remote HTTP effects.
- SIGKILL test interrupted the worker **after claim but before an external side effect**.
- The spike does not test killing a worker between a *remote HTTP success* and its acknowledgment.
- pg-boss job completion and Prisma business writes were not committed under a single **transactional worker**; this can be explored in Phase 5 depending on step design.
- Postgres permissions, backups, load/latency, long-run monitoring, deployment and incident drills remain future tasks.
- Prisma 7 driver-adapter/transaction regressions should be tracked with version pins and compatibility CI when upgrading.

## Approval / reconsideration

Accept this ADR only after review of the tested failure boundaries and remaining risks. Revisit for supported version drift, unreliable pool configuration, sustained queue load or requirements for additional orchestration patterns. **The tested enqueue path does not require the outbox fallback, but keep it as a documented escape hatch.**
