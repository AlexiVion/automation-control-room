# Automation Control Room

**Status:** Phase 4 — architecture definition. No runnable application has been implemented yet.

Open-source, AI-assisted business workflow orchestration designed as an independent portfolio project.

## Vision

Build workflows visually or with a natural-language proposal, validate them, require human approvals for sensitive actions, execute with durable workers, and inspect every step and audit event.

## Architectural direction (proposed)

- TypeScript modular monolith with three deployable processes: **web**, **API**, **worker**.
- Next.js, React Flow, Fastify, Zod, PostgreSQL, Prisma, pg-boss.
- Own deterministic workflow engine and typed connector interfaces.
- AI proposes structured drafts; policy-controlled worker code executes effects.
- A signed-lead-webhook demo with AI classification, human approval, idempotent CRM upsert and execution history.

## Boundaries

Independent from ClickDialog infrastructure, customer information, private source and credentials. No payments or commercial multi-tenancy in the first version. Architecture decisions and executable contracts are subject to Phase 4 review.

## Development

Documentation will be prepared in a dedicated pull request. Implementation begins after agreeing on the Phase 4 contracts, acceptance criteria and security controls.

## License

Apache-2.0 for original project contributions (see LICENSE once added).
