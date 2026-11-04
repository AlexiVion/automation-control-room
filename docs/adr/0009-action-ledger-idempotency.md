# ADR 0009 — ActionLedger for external effects
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
ActionLedger for external effects.

## Why
Stable operation keys and explicit ambiguous outcomes make at-least-once workers safe for retries where providers support idempotency.

## Tradeoff
Exactly-once provider side effects cannot be promised universally.

## Acceptance / reconsideration
Confirm connector-specific reconciliation semantics.
