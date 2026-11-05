# Portfolio-first direction — Automation Control Room

**Decision:** 2026-11-04 · **Owner intent:** publish an authentic engineering project on GitHub and showcase it on LinkedIn. **ACR is not a commercial product at this stage.** Preserve the option to turn it into one later without committing to that roadmap now.

## Positioning

- **Primary audience:** engineers, technical recruiters, hiring managers and teams seeking a full-stack developer with backend/API integration, automation, reliability and applied-AI architecture skills.
- **What the project proves now:** Next.js + Fastify + PostgreSQL + independent worker integration; stateful workflow execution; review/approval; durable events; real database writes; retry/idempotency semantics; isolation; Docker-based reproducible verification; browser-level UI QA.
- **What it does NOT prove yet:** a general editable workflow builder, production operator identity, live external providers, an actual LLM call, unrestricted agent tooling, public multi-tenant hosting, commercial customers or revenue.
- **Suggested description:** *“Open-source full-stack workflow orchestration demo: durable background execution, human approvals, PostgreSQL audit trails and an interactive React inspector. Built with Next.js, Fastify, TypeScript, Prisma and pg-boss; reproducible in Docker.”*
- **Publishing language:** English README and technical summary for international reach; LinkedIn post may be in Spanish, French or English depending on audience. Do not describe an unimplemented AI model as running in the demo.

## Definition of done: LinkedIn/portfolio edition (the present goal)

- [x] Functional local scenario from synthetic input to independent worker and PostgreSQL-backed CRM.
- [x] Reliable audited history, corrected attempts/retries and inspectable professional read-only canvas.
- [x] Test evidence in CI, full real Compose integration and owner-run Windows validation; preserve receipts/links.
- [x] README accurately leads with what works today and how to reproduce it, not obsolete architecture-only wording.
- [ ] Commit curated screenshots (with no personal data), short guided walkthrough/video and an architecture overview suitable for a public repository.
- [ ] Test installation from a **fresh clean clone** in a disposable environment; document exact verified steps on Windows and ideally Linux.
- [ ] Prepare a concise LinkedIn project entry with the GitHub link, stack, three concrete engineering achievements, and a clear demo limitation.
- [ ] Final licensing, docs/link, sensitive-file/secret and dependency review before wider sharing.
- [ ] Decide when/how to merge draft architecture and implementation PRs into a clear public default branch; merging requires separate owner approval.

**Portfolio acceptance:** an unfamiliar reviewer understands the project in 30 seconds, sees real evidence, and can reproduce a full end-to-end synthetic run from the documented commands. A hosted demo is desirable **only if its public security gates are complete**; it is not a prerequisite for sharing a code-first project on LinkedIn.

## Product-readiness without building a product

Keep engineering seams clean, but do not build commercial features solely to appear product-ready:

1. **Contracts and published versions:** keep typed DAG validation, semantic versioning, explicit event and action states. Current demo has a published fixed graph; a general draft editor/publisher is a later extension.
2. **Boundaries:** web, API and worker independent; DB events authoritative; deterministic domain logic testable without providers; provider/connector APIs separate from business rules.
3. **Security seams:** guest isolation, authorization, approvals, secret reference interface and explicitly denied egress; do not enable external HTTP before safe socket/TLS pinning and network ACLs.
4. **Observability:** event IDs, run history, metrics and testable failure modes; advanced replay and action evidence remain backlog items.
5. **Cost and portability:** synthetic local fixtures require no paid LLM. Future providers should remain optional adapters; Docker installation and sample data must stay independent of ClickDialog.

**Explicitly deferred until an independent product decision:** pricing, payments, billing, sales pipeline, CRM client onboarding, managed SaaS control plane, hundreds of connectors, marketplace, unrestricted agents, shared ClickDialog infrastructure and enterprise uptime guarantees.

## Next engineering priorities (portfolio weighted)

**P0 — Presentation & reproducibility:** clean README, screenshots, 60–90-second truthful demo, installation from clean clone, linkable CI evidence, architecture explanation and LinkedIn-ready project page.

**P1 — Credibility & operations:** advanced inspector/error context, more browser accessibility/security coverage, sensible SSE reconnection tests, observability and backup/recovery exercises. Only take on changes that materially improve the public demonstration or reliability.

**P2 — Optional generalization:** visual editing, draft/publish immutable graph versions, configurable node catalog and operator auth. They make a potential future product feasible, but are **not prerequisites** for the portfolio edition.

**P3 — Product exploration if explicitly chosen later:** real connector integrations, LLM planner, hosted multi-user mode, operating costs/support and commercial model. Require a separate go/no-go decision and security review. Never relabel the portfolio demo as a shipped SaaS.

## Language of truth

Always distinguish: **implemented / verified / proposed / deferred**. A CI PASS on a local fixture proves that workflow, not production readiness. A public GitHub codebase does not mean the app itself is hosted. Do not claim real AI, external integrations, editable general graph or paying customers until supported by evidence.

## Governance

Architecture work and features are in stacked draft PRs. Do not merge or deploy without the owner's explicit approval. The present strategic decision **supersedes any implication** in historical PRD/roadmap language that all proposed MVP or commercial scope must be built before showcasing ACR on LinkedIn. Historical specifications remain as research and future options, not immediate commitments.
