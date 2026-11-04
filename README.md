# Automation Control Room

**A full-stack engineering portfolio project — working local demo, not a commercial product.**

Automation Control Room is an open-source technical project exploring durable business workflow orchestration: how to intake an event, make a deterministic decision, request human approval, execute an idempotent action in a background worker, and inspect the resulting persistent audit trail.

> **Status (November 2026):** Phase 5 / Slice 2 implemented and verified locally on Windows Docker Desktop and in GitHub Actions. This is a **local synthetic-data demonstration** with a **published, read-only workflow** — not a workflow builder, hosted SaaS, production service, or live AI agent. The implementation is on a **draft, unmerged branch**; the default branch may not contain it yet.

**[View Slice 2 code](https://github.com/AlexiVion/automation-control-room/tree/feat/phase5-slice2-ux-history-20261104)** · **[Verified CI run](https://github.com/AlexiVion/automation-control-room/actions/runs/41877978061)** · **[Architecture and acceptance details](docs/phase5/SLICE2.md)** · **[Portfolio-first direction](docs/PORTFOLIO_FIRST.md)**

## Portfolio walkthrough

The shortest way to understand this repository is to follow one **real local run**:

```text
Synthetic lead → deterministic classification → conditional routing
               → human approval → independent worker
               → synthetic CRM write → persistent history & audit
```

The repository includes a [75–90 second recording storyboard](docs/portfolio/DEMO_STORYBOARD.md), an [architecture diagram with technical boundaries](docs/portfolio/ARCHITECTURE_AT_A_GLANCE.md), and the [GitHub/LinkedIn publication checklist](docs/portfolio/PUBLICATION_GATE.md). **Screenshots and video are still being curated**; no hosted demo is being claimed.

## What you can demonstrate today

- **Real execution lifecycle:** choose a synthetic lead → classify with an explicitly labelled deterministic fixture → evaluate a condition → approve/reject a proposed CRM write → let an independent worker complete the run.
- **Durable evidence:** PostgreSQL-backed execution events, approved/rejected decisions, execution history, a synthetic CRM record and linked audit trail. Refresh a page and inspect the same saved run.
- **Reliability and correctness:** transactional enqueue, durable worker processing, scoped session authorization, idempotent local CRM upsert, controlled retry, rejection, quota and cross-session isolation.
- **Workflow visualization:** zoomable/pannable read-only canvas generated from a published graph, both decision branches, minimap, focused inspection mode and event-derived states.
- **Verifiable metrics:** normal approved CRM write = 1 CRM attempt / 0 retries; the controlled transient-failure case = 2 attempts / 1 retry.

**This is not yet:** an editable general workflow engine, a third-party integration platform, an authenticated operator console, an LLM-powered planner or a public deployment. Those are possible engineering extensions, not features being advertised here.

## Architecture

```text
Next.js + React UI
       |
       | same-origin API proxy / guest cookie
       v
Fastify API --- session scope / approval / event history
       |
       v
PostgreSQL 17 <---> pg-boss queue
       ^
       |
Independent worker ---> deterministic workflow steps ---> synthetic demo CRM
```

**Technology:** TypeScript, Next.js, React, Fastify, PostgreSQL 17, Prisma 7, pg-boss, Zod, Docker Compose, Vitest and Chromium browser E2E testing.

The web UI does **not** execute the work itself. PostgreSQL is the source of truth for decisions and progress; the queue and browser event stream are delivery mechanisms. The synthetic demo is deliberately isolated from external credentials and paid AI services.

## Run locally (Windows / Docker Desktop)

**Prerequisites:** Git, Docker Desktop with the **Linux engine** running, and PowerShell. The demo stays bound to localhost.

```powershell
git clone https://github.com/AlexiVion/automation-control-room.git
cd automation-control-room
git switch feat/phase5-slice2-ux-history-20261104
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-start-slice2.ps1 -Port 3300
```

Open **http://localhost:3300**. The script builds one shared image, tags the processes, starts Postgres/API/worker/web, applies versioned migrations and runs HTTP + unit smoke checks. On an existing checkout it preserves the PostgreSQL volume; **do not use `docker compose down -v` unless you intend to delete local demo data**.

Expected local markers: `PRODUCT_SLICE1_E2E_PASS` and `SLICE2_WINDOWS_PASS`.

For project test matrices, Compose details, guest-data limitations and QA evidence, see [Slice 1](docs/phase5/SLICE1.md), [Slice 2](docs/phase5/SLICE2.md) and the [portfolio publication gate](docs/portfolio/PUBLICATION_GATE.md). The [Phase 4 release gates](docs/quality/RELEASE_GATES.md) are historical and do not describe the current runnable demo. The previously recorded [full CI run](https://github.com/AlexiVion/automation-control-room/actions/runs/41877978061) also exercised real product Compose and a Chromium desktop/mobile journey.

## Roadmap: portfolio first, product-ready by design

The **current deliverable** is a high-quality, reproducible engineering case study suitable for GitHub and LinkedIn. Near-term work prioritizes a clear README, real screenshots or a 60–90-second walkthrough, a reproducible local install, architecture explanations, reliable CI and honest documentation of technical trade-offs.

We are deliberately keeping a future product path open through typed contracts, immutable published versions, isolated workspaces, durable execution semantics and connector interfaces. A **general editor, operator authentication, guarded external connectors, optional LLM integration, advanced operations and public-release security** require separate implementation and acceptance. Commercial plans, billing, multitenant SaaS and a plugin marketplace are **not current goals**.

See [portfolio scope and decision gates](docs/PORTFOLIO_FIRST.md) and the [follow-up engineering backlog](https://github.com/AlexiVion/automation-control-room/issues/11).

## Engineering references

- [Product requirements / proposed future scope](docs/product/PRD.md) — a design proposal, **not a list of implemented features**.
- [Architecture blueprint](docs/architecture/ARCHITECTURE.md) · [Domain and state machine](docs/architecture/DOMAIN_MODEL.md) · [Execution semantics](docs/architecture/EXECUTION_SEMANTICS.md)
- [Executable Zod contracts](packages/contracts/README.md) · [OpenAPI 3.1](docs/contracts/openapi.yaml) · [Connector SDK proposal](docs/contracts/CONNECTOR_SDK.md)
- [Threat model](docs/security/THREAT_MODEL.md) · [Security controls and known gaps](docs/security/SECURITY_CONTROLS.md)
- [Phase 4 baseline](docs/PHASE4_BASELINE.md) · [UX acceptance script](docs/ux/DEMO_ACCEPTANCE_SCRIPT.md) · [Portfolio readiness audit](docs/portfolio/READINESS_AUDIT_20261104.md)
- [Operational runbook](docs/operations/DEPLOYMENT_RUNBOOK.md) · [Contributing](CONTRIBUTING.md)

**Project boundary:** independent of ClickDialog; no shared customer data, infrastructure, credentials or billing systems. The repository includes an [Apache-2.0 LICENSE](LICENSE). Copyright attribution and third-party dependency/asset provenance remain under [publication review](docs/portfolio/READINESS_AUDIT_20261104.md); no claim of completed license compliance is made.
