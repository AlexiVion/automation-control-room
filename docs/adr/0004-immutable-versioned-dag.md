# ADR 0004 — Published immutable workflow DAG
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Published immutable workflow DAG.

## Why
Pinned versions make paused/restarted executions reproducible and prevent mid-run graph mutation.

## Tradeoff
Cycles, parallel fanout, joins and complex subworkflows are deferred. Conditions choose exclusive branches; one runnable step per execution in MVP.

## Acceptance / reconsideration
Revisit only with explicit state-machine, graph validation, authorization and migration design.
