# ADR 0008 — LLM proposes, deterministic engine executes
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
LLM proposes, deterministic engine executes.

## Why
Untrusted model output never grants permissions or invokes arbitrary side effects.

## Tradeoff
Plan generation requires strict validation and operator review.

## Acceptance / reconsideration
Reject any direct model-to-effect bypass.
