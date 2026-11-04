# ADR 0015 — Strict typed contracts, Zod v4 and OpenAPI 3.1

**Status:** proposed · **Date:** 2026-11-04 · **Gate:** 4C

## Context

Frontend, API, deterministic engine and workers need a common wire format. Graph validity, runtime authorization and the response of the LLM represent different trust levels.

## Decision proposal

- A versioned `WorkflowDraftSchema` in TypeScript/Zod v4 is the canonical **structural** format; unknown keys are rejected.
- A separate pure `validateWorkflowGraph()` checks topology, predecessor-only bindings, approvals and server-scoped destination policy.
- Generated JSON Schema documents the structural contract; an OpenAPI 3.1 YAML file documents HTTP envelopes, authentication requirements and status codes.
- Port interfaces separate engine, connectors and AI model adapters; they provide no implicit DB/network access.
- Example fixtures and Vitest tests are part of the architecture; schema output is generated, reviewed, versioned and checked against the canonical Zod source.
- One contract verification workflow for PRs, not a constellation of CI jobs.

## Alternatives considered

1. JSON Schema only: cannot adequately express graph reachability, effect authorization and side-effect semantics.
2. Hand-written duplicated TypeScript and JSON schemas: high drift risk.
3. AI outputs as direct executable commands: unacceptable privilege boundary.

## Consequences

Strong compile-time and runtime contract checks, fewer implicit assumptions; still requires careful version migrations and a real API/worker implementation. OpenAPI alone cannot prove semantic validation or HMAC security.

## Acceptance

Run typecheck and contract tests against pinned dependencies. Commit generated JSON Schema + lockfile, verify OpenAPI parse/$refs and record evidence. No gate marked accepted until code checks pass and owner reviews semantic constraints.

Source: [Workflow v1](../contracts/WORKFLOW_SCHEMA.md), [OpenAPI](../contracts/openapi.yaml), [Gate 4C](https://github.com/AlexiVion/automation-control-room/issues/4).
