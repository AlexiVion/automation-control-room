# Product Requirements — ACR v1
**Status:** proposed · **Gate:** 4A

## Problem
AI-assisted automations are difficult to trust when users cannot inspect, approve, retry or audit effects. ACR makes the proposed workflow and its actual execution transparent.

## Target users
1. Technical evaluators: assess a working full-stack automation system in 90 seconds, then reproduce locally.
2. Developers/operators: create and execute a type-safe workflow with a small connector catalog.
3. Managed SaaS customers: a possible future audience, **not** a requirement for v1.

## Main user journeys
- Guest: open isolated demo, trigger sample lead, watch run, inject a safe failure, inspect audit.
- Operator: edit draft, validate, publish immutable version, receive signed webhook, approve an effect.
- Maintainer: install locally, run integration tests, interrupt/restart worker and confirm recovery.

## MVP requirements
- Three independently deployable processes (web, API, worker) and a reproducible local Compose deployment.
- Visual node editor and natural-language planner produce the **same** typed draft format.
- DAG with published immutable workflow versions; eight bounded node kinds: webhook trigger, AI classify, condition, template, approval, guarded HTTP, demo CRM upsert, finish.
- Persistent execution/step state, durable human approval, events, explicit uncertain effects, retries/cancelation between steps.
- Signed webhooks, deduplication, authorization, guest demo isolation, budget limits and secret redaction.
- Optional live LLM key for operators; demo with an explicitly labeled deterministic fixture.
- Real PostgreSQL integration tests, worker recovery tests and browser E2E tests.

## Explicit non-goals
No Mercado Pago, billing, app marketplace, arbitrary JavaScript/Python, unrestricted HTTP destinations, distributed HA, multi-tenant commercial plans, cyclic workflows or autonomous browser agents.

## Gate 4A decisions pending
Guest demo isolation/retention; exact editing scope; hard caps on node counts, AI requests, concurrency and execution duration.

## Acceptance
A first-time visitor can complete the end-to-end demonstration without secrets; code can be installed locally; test matrix passes against PostgreSQL. No component is declared complete based on mocked UI alone.
