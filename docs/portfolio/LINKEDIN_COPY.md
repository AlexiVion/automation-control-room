# LinkedIn materials — draft for owner review

**Do not post yet.** The default GitHub branch has not been updated and the visual assets have not been selected. Use only after the [publication gate](PUBLICATION_GATE.md) is satisfied. No claims of public hosting, live LLM calls, external connectors or customers.

## Recommended post — English (professional/international)

I built **Automation Control Room**, an open-source full-stack project exploring how to make business automations **reliable and auditable**.

Rather than stopping at a workflow diagram, I implemented a local end-to-end flow with:

- **Next.js + React** for a visual workflow inspector and persistent execution history.
- **Fastify + PostgreSQL + Prisma + pg-boss** for durable background execution, human approval and idempotent writes.
- **Docker Compose, Vitest and Chromium E2E** to verify the actual behavior—including retries, session isolation and restoring a saved run.

The demo runs with synthetic data and deterministic classification, so there are no paid AI API keys or customer credentials involved. It is **an engineering portfolio project, not a hosted SaaS product**.

Code, architecture and setup: https://github.com/AlexiVion/automation-control-room

## Alternate short post — Spanish

Construí **Automation Control Room**, un proyecto open source de desarrollo full-stack para explorar cómo ejecutar y auditar automatizaciones de manera confiable.

Integra **Next.js y React** con una **API Fastify**, un worker independiente, **PostgreSQL/Prisma y pg-boss**. Incluye aprobaciones humanas, operaciones idempotentes, historial persistido y pruebas de extremo a extremo con Docker y Chromium.

La demo utiliza datos sintéticos y clasificación determinista: no es un SaaS comercial ni pretende mostrar integraciones o IA real que todavía no existen.

Código y arquitectura: https://github.com/AlexiVion/automation-control-room

## LinkedIn Projects entry

**Name:** Automation Control Room — Full-Stack Workflow Orchestration

**Description (English):** Open-source engineering demo of durable background workflows using Next.js, Fastify, TypeScript, PostgreSQL, Prisma and pg-boss. Built human approvals, idempotent synthetic CRM updates, event audit trails, scoped execution history and browser-tested workflow visualization. Local Docker Compose demo; not a commercial SaaS.

**Skills to tag:** TypeScript, React, Next.js, Node.js, API Development, PostgreSQL, Docker, Automation, Software Architecture, Integration Testing.

**Media:** 1 actual completed-canvas screenshot, 1 history screenshot, 1 CRM screenshot; optional 75–90 s walkthrough. The URL should point to the **published default branch** once approved.

## Reviewer checklist

- Does every claimed behavior match the verified demo?
- Is the linked README on the default branch, not an isolated draft?
- Are all screenshots real, readable and free of private data?
- Are synthetic classification and local-only hosting explicit?
- Does the post emphasize full-stack/API/automation skills rather than marketing a SaaS?
