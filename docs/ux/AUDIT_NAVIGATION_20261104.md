# Automation Control Room — UX / navigation / technical experience audit

**Date:** 2026-11-04 · **Surface:** Phase 5 / Slice 2 local synthetic demo · **Audience:** portfolio reviewers, engineering interviewers, developers running the demo.

> **Evidence classification:** This is a code/flow/accessibility-risk audit grounded in the current Next.js, Fastify, worker, CSS, contracts and Playwright source plus prior verified CI. The Browser extension could not be accessed in this Chat session (`Browser access requires the originating browser context`). **No fresh interactive visual screenshot capture has been performed here.** Updated Chromium QA runs in GitHub Actions provide behavioral regression evidence after PR creation, not a substitute for a manual WCAG or multi-browser audit. Product Design's complete screenshot-led interactive audit requires Work mode.

## What we inspected

1. **Arrival / initial session:** startup, create/reuse guest cookie, first meaningful UI, deterministic fixture disclosure.
2. **Primary demo journey:** choose lead, start, condition, wait for human decision, approve/reject, worker completion.
3. **Visual feedback:** published graph, node selection, mini-map, focus mode, inspector and event timeline.
4. **Navigation:** sidebar, URL state, reload/deep link, browser Back/Forward, keyboard and mobile labels.
5. **Activity/history:** server status filter, signed cursor pagination, client text-filter scope, selected run after refresh.
6. **CRM:** confirmed writes, cross-screen navigation and empty-state CTA.
7. **Recovery:** idle session expiry, stale execution links, error messaging, retries and quota.
8. **Technical trust:** auth and workspace scoping, authoritative backend events, no synthetic achievements portrayed as real third-party calls.
9. **Portfolio messaging:** GitHub link points to executable source; avoid treating this local-only demo as a commercial product.

## Findings and corrections

| Priority | Finding in previous version | User cost / reproduction | Correction in this branch |
|---|---|---|---|
| P0 | Internal sidebar changes only used `history.replaceState`; browser Back did not restore previous screen | Visit Demo → History → CRM → Back; URL and content could disagree | Explicit `pushState` on intended navigation and `popstate` restoration of screen + selected run; existing reloadable deep links retained |
| P0 | Approval card appeared **after** the 620px canvas and inspector | For priority-high lead, the actionable approval CTA was below the primary visual | Move persisted approval card immediately after summary metrics and **before** canvas; no change to approval API or authorization |
| P1 | Mobile sidebar hid all nav text at <=930px via `font-size:0` | On ~390px screens user had to guess icon meanings | 3 labelled, semantic mobile navigation targets, each with a visible short name |
| P1 | No obvious in-app recovery from an expired guest session | Idle >30 min led to repeated 401 errors and "reload page" advice, with stale content | Explicit **Iniciar nueva sesión demo** control; suspend polling until user opts into a new isolated workspace |
| P1 | Deep link to an expired/foreign execution returned an error and kept stale selection | A bookmarked run ID cannot authorize cross-workspace lookup | Clear unowned run from URL and selection; show a scoped notice; no data from other workspace is exposed |
| P1 | "Buscar por lead o ID" sounded global, while only loaded rows were searched | False negatives when older cursor pages weren't loaded | Label "Filtrar filas cargadas", visible count/scope, clear control and accurate no-results explanation |
| P2 | Initial `/v1/demo/me` failures of *any* type fell back to creating another session | Server/network 500 could be disguised as "new guest" | Only a genuine 401 `SESSION_REQUIRED` triggers session creation; 500/network error remains visible |
| P2 | No skip navigation target or `aria-current` | Harder keyboard navigation and ambiguous active sidebar state | Focusable skip link, main landmark and semantic current-view label |
| P2 | Sidebar GitHub link pointed to `main`, where verified app isn't merged | Portfolio reviewer sees a README saying there is no executable app | Temporarily link directly to executable Slice 2 branch until approved merge |

## Confirmed strengths to preserve

- Frontend is observing a **real PostgreSQL**-backed execution and event stream, not animating fake completion.
- Human approval is server-authorized and digest-bound; rejection does not silently write to CRM.
- Idempotent CRM upsert and correct attempts/retries are tested against the real database.
- UI distinguishes deterministic fixture classification and synthetic CRM from a live LLM/provider integration.
- The published read-only canvas has 7 nodes/6 edges, labelled branches and a focusable inspector; no claims of general drag-and-drop editing.
- Workspaces use opaque cookie isolation; quotas, expiry and CSRF are verified by product smoke.
- Existing CI exercises Chromium desktop and 390px mobile with real API and worker.

## Accessibility and visual design — known limits

These are **risks or future checks**, not new claims of WCAG compliance:

- Verify text, disabled controls, muted labels and state badges against **WCAG 2.2 AA** contrast thresholds using actual rendered CSS.
- Test keyboard-only focus order and Escape behavior for the full-screen canvas modal; its focus trap already has a targeted Chromium test, not a full screen-reader audit.
- Test **320, 390, 768, 1024, 1180 and 1440px** viewports, mobile zoom, very long strings and translated text. The current CI covers a subset.
- SSE uses a persisted sequence and periodic HTTP refresh; full gap/replay/resync and degraded-network behavior remain follow-up.
- Browser-scoped search is intentionally transparent, but server-wide free-text search remains future work if history volumes exceed demo quotas.
- The app has no general workflow editor, production operator authentication, signed external webhook endpoint, live LLM or third-party connector.
- Hosted production requires a separate security gate; Docker's fixed dev key and localhost cookies are **not production-safe**.

## Recommended portfolio user journey

1. Start on **Demo**, with the short three-step instruction below the lead selection.
2. Select a high-priority synthetic lead and start the run.
3. See the pending human approval without scrolling past a large graph.
4. Approve or reject, and inspect changes in node status and events.
5. Open **Historial**, search among loaded rows or change the server status filter, then reload the selected run.
6. Open **CRM ficticio**, verify the confirmed database write and return to its originating run.
7. Navigate Back/Forward or open a saved `?view=activity&run=<uuid>` link.
8. For an expired session, use the explicit renewal control and observe a **new isolated workspace**.

## Test gates for this change

**Automated Chromium test additions:**
- Approval card placed physically above the graph, button visible.
- Browser History Back/Forward preserves content and URL state.
- History search clearly labelled local-to-loaded-rows and clearable.
- Mobile nav text visible; no horizontal overflow.
- Expired guest error offers an explicit safe renewal with new workspace ID.
- Foreign/old run link is dropped and produces a helpful notice.
- Original graph, approval→CRM, history reload, isolated guest and focus-mode coverage remains unchanged.

**Release classification:** changes are for a **draft UX improvement PR**, not a production release. The product stays synthetic/local-only and independent of ClickDialog. Final visual review in Work/browser and owner Windows follow-up remain recommended before merging.

## Strategic presentation lens

**Sales plugin applicability:** because ACR is explicitly a *LinkedIn engineering portfolio case*, not a paying-customer offer, CRM pipeline, commercial funnel and pricing/sales features are irrelevant to this UX sprint. The useful persuasion criterion is recruiter comprehension: make the live execution and its evidence clear quickly, link to the executable branch and preserve truthful limitations. Do not add commercial CTA or invented testimonials.

**Future product option:** the existing separation of app, API, worker, contracts, events and permissions is useful product-ready structure. Do not turn this improvement into a multi-tenant SaaS, marketplace or agent studio.
