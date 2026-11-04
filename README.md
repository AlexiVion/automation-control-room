# Automation Control Room

> **Status: Phase 4 — architecture definition. This repository has no runnable application yet.**

Open-source, AI-assisted business workflow orchestration. Build workflows visually or from natural language, approve sensitive actions, run them through independent workers, and inspect persistent execution events.

## Start here
- [Product requirements](docs/product/PRD.md)
- [Architecture blueprint](docs/architecture/ARCHITECTURE.md)
- [Domain model](docs/architecture/DOMAIN_MODEL.md)
- [Execution semantics](docs/architecture/EXECUTION_SEMANTICS.md)
- [Workflow schema](docs/contracts/WORKFLOW_SCHEMA.md)
- [AI contract](docs/contracts/AI_CONTRACT.md)
- [Executable contract package](packages/contracts/README.md)
- [OpenAPI 3.1](docs/contracts/openapi.yaml)
- [API error taxonomy](docs/contracts/API_ERRORS.md)
- [Connector contract](docs/contracts/CONNECTOR_SDK.md)
- [Threat model](docs/security/THREAT_MODEL.md)
- [Acceptance tests](docs/quality/ACCEPTANCE_TESTS.md)
- [Architecture decision records](docs/adr/README.md)
- [Phase 4 roadmap](docs/ROADMAP.md)
- [Full architecture research report (Spanish)](docs/research/ARCHITECTURE_RESEARCH_20261103.md)
- [Phase 4 documentation plan (Spanish)](docs/research/PHASE4_DOCUMENT_PLAN.md)
- [Reference repositories](docs/research/REFERENCE_REPOS.md)
- [Phase 4 gate issues](.github/PHASE4_ISSUES.md)
- [Gate 4D PostgreSQL + Prisma/pg-boss reliability spike](spikes/gate4d/README.md)
- [Gate 4E security primitives](packages/security/README.md)
- [Gate 4E isolated guest persistence tests](spikes/gate4e/README.md)
- [Security controls and remaining blockers](docs/security/SECURITY_CONTROLS.md)
- [Contributing](CONTRIBUTING.md)

## Architectural direction (proposed)
TypeScript modular monolith with three processes: Next.js web, Fastify API, and independent worker. PostgreSQL is the source of truth, pg-boss is the proposed queue (pending a transactional compatibility spike), and a custom deterministic workflow engine executes typed nodes. React Flow presents the graph; an LLM may propose schema-validated drafts but cannot execute arbitrary actions.

## Demo vertical slice
Signed lead webhook → typed AI classification (or clearly labeled fixture) → human approval → idempotent demo CRM upsert → events, failure injection, recovery and execution inspector.

## Project boundary
Independent of ClickDialog: no shared source, clients, credentials, database, infrastructure, billing or production services. No commercial SaaS or unrestricted outbound HTTP in MVP.

## Governance
All specifications, contracts and ADRs are **proposed**, not approved. The contract code is not an API or worker. The Phase 4 gate must be completed before production implementation. The repository is not yet a finished product.

## License
Apache License 2.0 for original work; consult [LICENSE](LICENSE). Dependencies and borrowed code require independent license review.
