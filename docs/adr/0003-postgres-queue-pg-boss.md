# ADR 0003 — pg-boss queue, subject to compatibility spike
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
pg-boss queue, subject to compatibility spike.

## Why
A PostgreSQL-backed queue may reduce operational services and allow atomic job publication with domain writes.

## Tradeoff
Exact Prisma and pg-boss versions/adapters must prove shared transaction; otherwise use outbox.

## Acceptance / reconsideration
Do not accept until real PostgreSQL commit/rollback and worker crash tests pass.

## Gate 4D validation plan

Proof repository: [`spikes/gate4d`](../../spikes/gate4d/README.md). Pin Prisma 7.10.1, adapter-pg 7.10.1, pg-boss 12.38.0 and PostgreSQL 17. Verify that `boss.send(..., { db: fromPrisma(tx) })` participates in the same transaction and rolls back. This ADR remains **proposed** until CI is green, code is reviewed, and additional crash/recovery and approval re-enqueue invariants are evaluated. If the direct adapter cannot provide atomicity under tested versions, revert to a transactional outbox rather than committing an unsafe two-step write.
