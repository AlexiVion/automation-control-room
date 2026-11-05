# ADR 0011 — Append-only events with SSE replay
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Append-only events with SSE replay.

## Why
State resides in PostgreSQL; SSE is a stream of persisted events, so reconnects can replay from a cursor.

## Tradeoff
Polling/SSE operational tuning required.

## Acceptance / reconsideration
Reevaluate for high-scale fanout.
