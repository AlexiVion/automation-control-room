# ADR 0002 — PostgreSQL as authoritative domain and event store
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
PostgreSQL as authoritative domain and event store.

## Why
Transactions and durable records support versioning, audit and safe restart.

## Tradeoff
Database load and maintenance remain central operational concerns.

## Acceptance / reconsideration
Reevaluate with measured load and data-retention requirements.
