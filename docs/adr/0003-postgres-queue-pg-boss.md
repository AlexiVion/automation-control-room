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
