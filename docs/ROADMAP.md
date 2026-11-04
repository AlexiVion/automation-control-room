# Roadmap — Definition to Delivery
**Status:** architecture proposal, no gate signed off

## Phase 4 decision gates
- **4A Product** — [Detailed candidate PRD](product/PRD.md), [demo scenarios](product/DEMO_SCENARIOS.md) and [ADR 0014](adr/0014-anonymous-demo-sandbox-and-ai-modes.md) **written; owner review still pending**. Confirm guest isolation, fixture vs real LLM and numeric budgets.
- **4B Domain** — [Detailed candidate domain](architecture/DOMAIN_MODEL.md) and [execution semantics](architecture/EXECUTION_SEMANTICS.md) **written; owner review still pending**. Approve entity constraints, transitions, event sequence, immutable versions and ActionLedger.
- **4C Contracts** — [TypeScript Zod/graph validator](../packages/contracts/src/workflow.ts), [OpenAPI](contracts/openapi.yaml), [typed ports and API DTO](../packages/contracts/src/index.ts), [fixtures/tests](../packages/contracts/test), and [JSON Schema generator](../packages/contracts/scripts/generate-json-schema.ts) **prepared as candidates**; CI, tracked schema snapshot and owner review pending.
- **4D Reliability** — [PostgreSQL/Prisma 7/pg-boss 12 spike](../spikes/gate4d/README.md) **technical PASS: 9 real DB tests** (commit/rollback, dedup, atomic approval resume, SIGKILL recovery, local idempotency, uncertain remote state). [CI evidence](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254). ADR 0003 **proposed pending acceptance**; remote effect exactly-once never claimed.
- **4E Security** — threat model, SSRF and credential controls, guest sandbox tests.
- **4F UX/Operations** — 90-second demo, observability, Compose topology and acceptance gate.

## Gate review status (2026-11-04)

- **4A:** detailed specification is in draft PR #1; not approved/closed.
- **4B:** detailed domain and execution semantics proposed; not approved. Refer to [issue #3](https://github.com/AlexiVion/automation-control-room/issues/3).
- **4C:** executable Zod/OpenAPI contracts with 24 passing tests, tracked schema snapshot and npm lockfile; owner approval pending. Issue [#4](https://github.com/AlexiVion/automation-control-room/issues/4).
- **4D:** technical spike verified on PostgreSQL 17; 9 tests PASS, including SIGKILL/recovery; owner review pending. See [#5](https://github.com/AlexiVion/automation-control-room/issues/5).
- **4E–4F:** security threat verification, UX and production operational evidence still pending.
- **Phase 5:** no product API, workflow runtime, public web app or deployed service has been implemented. **Contract/spike CI exists**, but is not product-level CI.

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
