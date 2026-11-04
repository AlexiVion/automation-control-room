# Phase 5 / Slice 2 — Real history, correct metrics, professional workflow canvas

**Status: CI PASS — local-only product verified end-to-end, Windows Slice 2 owner retest pending.** This builds on [Slice 1](SLICE1.md). No production or public deployment authorization.

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

## Final CI / visual QA evidence

- [GitHub Actions #41870067761](https://github.com/AlexiVion/automation-control-room/actions/runs/41870067761) — **SUCCESS**, source commit `d517c262a9d079eb1e3a5002fbf3c91413b654de`.
- 71 prior Phase 4 tests plus **4 history cursor** and **5 node state** unit tests; all passed.
- Prisma versioned product migration PASS and TypeScript checks for API, worker and Next.js PASS; Next production build PASS.
- Full database-backed HTTP E2E PASS twice (direct process and product Compose): workflow, idempotency, approval, rejected/medium branch, retries, 3-page durable history, signed cursor integrity, session isolation and CSRF.
- Chromium desktop + 390px mobile browser E2E PASS: graph fetched from server (7 nodes/6 edges), zoom/fit, waiting approval state, real approval→CRM, inspector `1 CRM attempt / 0 retries`, history after reload, CRM→run detail, isolated guest, no page errors.
- **Visual QA repair**: the initial CI screenshot had the minimap overlay the CRM node. Moved minimap into unused bottom-left canvas space, and added a **bounding-box regression assertion**. Latest Chromium check prints `unobstructed minimap` PASS.
- 5 actual screenshots (desktop pending/completed/history/CRM→audit and mobile isolated CRM) are published as the `slice2-browser-evidence` artifact of that CI run (7-day retention).

CI success does not establish that the user's *Windows* Docker Desktop has rebuilt this branch or that a user has approved the visual design. Review locally at `http://localhost:3300` with the versioned migration in place; no `down -v`.

Recommended safe launcher, **after checking out the Slice 2 branch** in the existing Windows repo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-start-slice2.ps1 -Port 3300
```

This single-image Docker build, four service tags, forward-only migrator, live HTTP smoke and cursor/canvas tests preserve the existing PostgreSQL volume. It prints `SLICE2_WINDOWS_PASS` only when all checks succeed.

Remaining advanced product work (redacted JSON export, event cursor replay, broader Playwright/a11y, editable workflow UI) is tracked separately in [Slice 3 #11](https://github.com/AlexiVion/automation-control-room/issues/11).

## Canvas readability closure — Phase 5 Slice 2 (November 4, 2026)

**Problem observed from Windows screenshots:** the desktop graph only occupied a narrow column beside the inspector and fitted at approximately **61% scale**. Labels and node-state text were difficult to read, despite functional execution and audit being correct. The product owner requested final UX polish and closure without compromising actual PostgreSQL data.

**Changes:**

- The published graph is now the **primary full-width studio surface**; the run inspector becomes a compact evidence strip directly beneath it. At CI's 1440px desktop viewport, the fit must be **at least 85%** (automatically measured), instead of accepting 61% with no readability gate.
- Canvas height increases for presentation. Node title, subtitle, state and type labels are enlarged, with status wording (not color alone).
- An **Enfocar** action opens an almost fullscreen modal inspection surface with the SAME published graph, zoom and pan, plus a live node audit on the right. `Escape` exits and returns keyboard focus to the initiating control; Tab stays within the modal. The standard inspector and timeline remain available after closing it.
- Mobile keeps the established vertical accessible node list. The focus toggle is not presented on small screens where the visual canvas is hidden.
- The footer explicitly labels the abbreviated, random **guest workspace ID**. This helps distinguish genuinely empty guest sessions from one that already contains a CRM record, without claiming any data crosses workspace boundaries.
- Existing restrictions continue: **read-only** graph (not editor), no real LLM, no external connectors, no public deployment, no deletion or reset of PostgreSQL data.

**Browser regression gates:** inspect real SVG published graph 7 nodes / 6 edges, desktop default fit >=85% and single-column studio, minimap/no-node-overlap, modal dimensions, selected CRM node audit, keyboard Escape/focus restoration, same-workspace identity after reload, different guest identity for isolated mobile browser, history/CRM navigation, owner E2E and all previous security/ledger tests.

**Acceptance boundary:** Passing CI and user Windows CLI confirms behavior but not approval to merge or deploy. The three requested Slice 2 features can be marked **functionally complete** after updated Chromium and Windows visual QA. Stacked draft PR #10 remains open awaiting explicit owner approval before merging.
