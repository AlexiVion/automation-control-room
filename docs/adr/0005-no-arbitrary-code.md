# ADR 0005 — No user-provided executable code in MVP
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
No user-provided executable code in MVP.

## Why
Typed built-in nodes avoid untrusted code execution and sandbox complexity for a public demo.

## Tradeoff
Less flexibility than Windmill or n8n.

## Acceptance / reconsideration
Revisit after threat model, isolation and runtime sandbox budget.
