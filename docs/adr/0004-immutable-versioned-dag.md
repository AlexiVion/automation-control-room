# ADR 0004 — Published immutable workflow DAG
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Published immutable workflow DAG.

## Why
Pinned versions make paused/restarted executions reproducible and prevent mid-run graph mutation.

## Tradeoff
Cycles and complex subworkflows are deferred.

## Acceptance / reconsideration
Revisit only with explicit state-machine and migration design.
