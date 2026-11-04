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

## Verification update — Gate 4D

[CI PASS](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254) shows a **single-winner conditional approval**, a single atomic decision+Execution transition+event+resume queue command, and full rollback of those changes if an exception occurs. This validates the persistence primitive only. Authorization, expiry-vs-approval race, real workflow pause/resume and UI acceptance remain to be implemented. ADR status remains proposed.
