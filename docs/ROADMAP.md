# Roadmap — Definition to Delivery
**Status:** architecture proposal, no gate signed off

## Phase 4 decision gates
- **4A Product** — [Detailed candidate PRD](product/PRD.md), [demo scenarios](product/DEMO_SCENARIOS.md) and [ADR 0014](adr/0014-anonymous-demo-sandbox-and-ai-modes.md) **written; owner review still pending**. Confirm guest isolation, fixture vs real LLM and numeric budgets.
- **4B Domain** — approve entities, transitions, immutable version and ActionLedger invariants.
- **4C Contracts** — concrete Zod/JSON Schema, REST/OpenAPI, connector & planner APIs.
- **4D Reliability** — PostgreSQL-backed transactional queue spike, crash/retry tests, outbox fallback criteria.
- **4E Security** — threat model, SSRF and credential controls, guest sandbox tests.
- **4F UX/Operations** — 90-second demo, observability, Compose topology and acceptance gate.

## Gate review status (2026-11-04)

- **4A:** detailed specification is in draft PR #1; not approved/closed.
- **4B–4F:** documents exist as drafts; contract verification and executable evidence are pending.
- **Phase 5:** no application runtime or CI has been implemented.

## Phase 5 vertical slices (not yet started)
1. Repository code scaffolding + pinned dependencies + Compose + CI.
2. Domain, persistence, webhook ingress, job handoff and worker.
3. Deterministic engine, approval persistence, CRM fixture, ActionLedger.
4. Read-only execution inspector with event replay.
5. Visual editor + validation + immutable publishing.
6. AI proposal adapter + explicit demo fixture mode.
7. Failure/recovery E2E, docs, release security review and deployment.

## Deferred
Payment systems, commercial multi-tenant SaaS, extensive integrations, arbitrary user code, plugin marketplace, automatic infrastructure scaling.
