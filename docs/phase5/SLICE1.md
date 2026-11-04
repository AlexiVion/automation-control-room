# Phase 5 — Slice 1: local, durable synthetic lead workflow

**Status: implementation candidate, not a public service.**

This slice is the first actual product implementation following the [Phase 4 baseline](../PHASE4_BASELINE.md). It intentionally implements a single **pre-published, immutable** canonical workflow using the validated Gate 4C graph. It is *not yet* a general workflow editor/interpreter.

## Run on Windows PowerShell with Docker Desktop

From the root of a checkout of branch `feat/phase5-slice1-live-demo-20261104`:

```powershell
docker compose -f ops/compose/product.yml up --build -d
docker compose -f ops/compose/product.yml --profile test run --rm smoke
Start-Process "http://localhost:3000"
```

When finished (retain the local test DB across routine restarts):

```powershell
docker compose -f ops/compose/product.yml down --remove-orphans
```

**Destructive local reset, only when expressly intended:**

```powershell
docker compose -f ops/compose/product.yml down -v --remove-orphans
```

The `-v` command destroys the dedicated local-demo PostgreSQL volume. It does not touch any ClickDialog database, but any ACR demo data in this Compose project is lost.

## Product services

- `web`: Next.js at **http://localhost:3000**; only service with a host port; bound to 127.0.0.1.
- `api`: Fastify at internal port 3100; never published to host.
- `worker`: independent process using pg-boss backed by PostgreSQL.
- `postgres`: PostgreSQL 17 with local-only test account and persistent volume (no host port).
- `migrate`: Prisma **versioned migration** run before API/worker/web startup.
- `smoke`: optional test-profile job with real HTTP requests to API and rendered Next.js route.

## What is real in this slice

- Local demo session is stored in PostgreSQL, cookie is opaque and HttpOnly; session hash/TTL and Origin+CSRF checks on mutations.
- One canonical graph version stored as immutable JSON with digest after Gate 4C structural+semantic validation.
- Demo intake atomically saves execution, first event, enqueues pg-boss job and reserves per-workspace quota. Duplicate receipt returns same execution.
- Worker executes deterministic fixture classification. High-priority lead waits for durable human approval; medium/low terminates without CRM side effect.
- Approval decision, execution state, audit event and continuation enqueue are one Prisma transaction.
- CRM upsert in PostgreSQL with workspace+externalKey uniqueness; optional single synthetic failure triggers a recorded safe retry.
- Read-only inspector, audit timeline, browser SSE with periodic resync fallback, guest-scoped CRM and approvals, mobile responsive screen.
- E2E smoke: happy path, duplicate intake, retry, branch, rejection, quota, session isolation and CSRF.

## What is NOT implemented yet

- Operator authentication, editable/publishable general DAG workflows and React Flow editor.
- Real LLM, model provider API calls or real signed inbound webhooks. The UI labels **deterministic fixture**.
- External HTTP connector, DNS/TLS/IP pinning, KMS, global guest quotas and distributed antiabuse. **No public deployment permitted.**
- Global job monitoring, advanced job recovery and load testing, Playwright browser QA, backup/restore.
- A user-facing browser verification screenshot must come from actual local browser/Playwright, not from code-only or HTTP tests.

## Security limitations

This Compose is **for a trusted developer machine only**. It intentionally includes a documented development CSRF fixture key, an insecure cookie for localhost HTTP, and developer database credentials in Compose; no secrets from ClickDialog or real customers. Never expose through reverse proxy or publish ports beyond local loopback. Follow [Gate 4E Release Blockers](../quality/RELEASE_GATES.md) before any public deployment.

## Proof and expected output

```text
PASS API + PostgreSQL ready
PASS Next.js web route rendered
PASS Local anonymous cookie session + CSRF
PASS Transactional intake + deduplicated receipt + durable approval
PASS Human approval → pg-boss worker → real PostgreSQL CRM upsert
PASS Simulated transient retry without duplicate CRM lead
PASS Medium priority goes to finish without approval or CRM write
PASS Rejection cancels execution with no new CRM write
PASS Atomic five-run guest quota
PASS Cross-workspace isolation + CSRF rejection
PRODUCT_SLICE1_E2E_PASS
```

If this output is missing or any command fails, Slice 1 is not yet validated. Do not claim the UI was visually QA'd based solely on smoke tests.
