# ADR 0007 — Human approval as persistent state
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Human approval as persistent state.

## Why
Long-lived workflow pauses must survive process restart and authorize exactly one decision.

## Tradeoff
Approval expiry, cancellation and stale payload handling add complexity.

## Acceptance / reconsideration
Reevaluate after restart and double-approval integration tests.
