# Phase 5 / Slice 2 — Real history, correct metrics, professional workflow canvas

**Scope:** improvement of the verified local-only product from [Slice 1](SLICE1.md). This file describes intended behavior; use CI and local browser evidence to determine what actually passes.

## Durable, workspace-scoped execution history

`GET /v1/demo/runs?limit=5&status=completed&cursor=...` reads from PostgreSQL, not React memory. It returns `items`, `total` and `nextCursor`, ordered by `createdAt DESC,id DESC` for stable keyset pagination. HMAC-signed cursors are bound to the workspace and status filter, so they cannot silently switch scope or filters. Status filtering is server-side. Free-text search filters the rows currently loaded in the browser (not all DB records), clearly identified as such in UX.

The Activity screen now lists executions with status/date/lead/retries and allows loading older pages and selecting any saved run. Detail and timeline are loaded through authenticated, workspace-scoped `GET /v1/demo/runs/:id`. URL `?view=activity&run=<uuid>` preserves the selected execution through refresh without storing any auth token in URL. The CRM links each upsert record back to its run. `GET /v1/demo/workflow` supplies the immutable canonical graph and SHA-256 digest from the database.

## Honest metrics and existing data

Previously `DemoExecution.attempts` counted a classification + the CRM attempt, falsely reporting **2** for a clean run. New definition: CRM write attempts only (normal approved run **1**, one synthetic failure/retry **2**, skipped CRM **0**). Versioned SQL migration `202611040002_correct_crm_attempts` subtracts one old classification increment on existing records without deleting volumes. `retryCount` comes from persisted `step.retry_scheduled` events. Terminal duration is calculated from DB timestamps. Inspector displays **Intentos CRM** and **Reintentos** separately.

## Professional read-only canvas

SVG wires use the published graph's `nodes` and `edges`; both condition branches are labelled Sí/No. The canvas supports zoom, fit, drag-to-pan, minimap, an accessible selected-node inspector, semantic statuses and responsive mobile step list. State labels are projected only from persisted events. Requested approval is **waiting**, not completed; rejected/skipped/retrying are distinct. No fake graph editing, provider calls, or public deployment.

## Verification

```bash
npm run test:history
npm run test:canvas
docker compose -f ops/compose/product.yml up --build -d web worker
docker compose -f ops/compose/product.yml --profile test run --rm smoke
```

The full smoke must prove: normal/retried/skipped CRM metrics, 3-page list of 5 runs, status filters, cursor signature/filter checks, cross-workspace denial, persisted approvals, idempotency and CSRF. The existing GitHub Actions job additionally runs Chromium against the real product Compose on alternate localhost port 33000. Browser test script `scripts/browser-slice2.mjs` captures desktop/mobile screenshots, inspects the canvas, completes an approval, reloads Activity, and navigates from CRM to its run. It uses a separate browser context to check isolation.

**Remaining outside Slice 2:** editable/publishable React Flow general workflow editor, operator auth, third-party connectors, real LLM, production security and hosting. The project remains local-only and [PR #8](https://github.com/AlexiVion/automation-control-room/pull/8) is still a draft; the Slice 2 branch is stacked on top.

## Windows installation without data loss

After fetching and checking out `feat/phase5-slice2-ux-history-20261104` on the existing local checkout, reuse the known working single-image Docker build process. Set `$env:ACR_WEB_PORT="3300"` before Compose. Run the forward-only product migrations via the `migrate` service during `up`. Do not run `down -v` (it destroys the local product DB).
