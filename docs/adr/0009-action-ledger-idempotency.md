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

## Verification update — Gate 4D

[CI PASS](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254) demonstrates local CRM upsert remains unique under duplicate dispatch and recovery from OS-killed worker; a distinct simulated external-uncertain outcome enters `needs_review` without retry. **No real provider reconciliation or remote side-effect exactly-once has been proven.** Keep this ADR proposed until connector semantics are implemented and reviewed.
