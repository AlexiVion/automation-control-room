# ADR 0001 — Modular monolith: web, API and worker
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Modular monolith: web, API and worker.

## Why
One repository offers aligned types and straightforward CI while separate processes prevent long jobs from blocking HTTP.

## Tradeoff
Avoid microservice network complexity; deployment isolation is limited to process boundaries.

## Acceptance / reconsideration
Reevaluate if ownership, scaling or security domains demand independently deployed services.
