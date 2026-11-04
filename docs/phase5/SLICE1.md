# Phase 5 — Slice 1: local, durable synthetic lead workflow

**Status: implementation candidate — GitHub CI PASS (real product Compose + HTTP smoke). Local Windows browser QA still pending; NOT a public service.**

This slice is the first actual product implementation following the [Phase 4 baseline](../PHASE4_BASELINE.md). It intentionally implements a single **pre-published, immutable** canonical workflow using the validated Gate 4C graph. It is *not yet* a general workflow editor/interpreter.

## Run on Windows PowerShell with Docker Desktop

From the root of a checkout of branch `feat/phase5-slice1-live-demo-20261104`. On **Windows Docker Desktop**, build the shared Dockerfile just **once**, tag it for all processes, and start with `--no-build`; this avoids four concurrent BuildKit image exports in the same Windows temp directory:

```powershell
$project = "acrphase5local"
$compose = "ops/compose/product.yml"
docker build -f ops/compose/Dockerfile.product -t acrphase5local-image:dev .
if ($LASTEXITCODE -ne 0) { throw "PRODUCT_IMAGE_BUILD_FAILED" }
foreach ($service in @("migrate","api","worker","web")) {
    docker image tag acrphase5local-image:dev "${project}-${service}:latest"
    if ($LASTEXITCODE -ne 0) { throw "IMAGE_TAG_FAILED: $service" }
}
docker compose -p $project -f $compose up -d --no-build --wait --wait-timeout 180 web worker
if ($LASTEXITCODE -ne 0) { throw "PRODUCT_START_FAILED" }
docker compose -p $project -f $compose exec -T `
    -e ACR_API_BASE=http://api:3100 `
    -e ACR_WEB_BASE=http://web:3000 `
    -e ACR_ORIGIN=http://localhost:3000 `
    api npm run test:product
if ($LASTEXITCODE -ne 0) { throw "PRODUCT_E2E_FAILED" }
Start-Process "http://localhost:3000"
```

If a previous `docker compose up --build` attempt already showed `naming to docker.io/library/acrphase5local-{service}:latest` for **migrate, api, worker, web** but ended in a Windows temp file rename lock, do **not** rebuild: skip directly to the `docker compose ... up -d --no-build` command above and run the same `exec ... test:product` smoke. Check the named images with `docker image inspect acrphase5local-web:latest acrphase5local-api:latest acrphase5local-worker:latest acrphase5local-migrate:latest`.

The Windows lock signature seen on 2026-11-04 was `rename ...compose-build-metadataFile...: The process cannot access the file because it is being used by another process`. This is a **Docker Desktop/Windows build finalization failure**, not a Next.js/API application exception. Multiple service image exports amplify file operations; using one explicit `docker build` avoids the Compose multi-service export stage. If `docker build` itself is still blocked, inspect Windows Defender/AV file handles and Docker Desktop, **without** disabling security protections or deleting volumes indiscriminately.

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

## Verified CI evidence — 2026-11-04

- **[GitHub Actions #41853419992](https://github.com/AlexiVion/automation-control-room/actions/runs/41853419992): PASS** on commit `c162758c2d1fe5e36b24fff8362be66414ece325`.
- Existing **71 Phase 4 tests PASS** and the Phase 4 one-command Compose verification PASS.
- Prisma 7 product client generated; **versioned production-style migration deployed to an empty isolated PostgreSQL test database**.
- TypeScript strict checking PASS for API, worker, Next.js UI; **Next.js production build PASS**.
- **Real HTTP E2E PASS**: Fastify, worker, local PostgreSQL, Next.js HTML and same-origin rewrite/cookie propagation, double intake idempotency, approval + CRM commit, simulated retry, conditional false branch, rejection, quota, workspace isolation, CSRF denial.
- **Full product Compose PASS**: Docker build, Postgres + migrator + API + independent worker + Next web startup, plus a separate `smoke` container verifying the workflow through the Compose network.
- The published web endpoint is localhost-only. **No browser screenshot, Playwright UI interaction evidence or Windows Docker Desktop runtime verification has been produced yet**; run the commands above locally.

Known operator requirements: Docker Desktop with Linux containers and free localhost TCP port 3000. Product DB volume persists across normal `down`. Do not run `down -v` unintentionally.

The UI is a read-only workflow inspector by design in Slice 1. React Flow editable/publishable workflow canvas, real HMAC inbound webhooks and external AI/connectors remain intentionally out of scope.
