# Product experience reframe — Automation Control Room
**Date:** 2026-11-04 · **Status:** UX acceptance rejected by owner; proposal for redesign, not approved implementation

## Evidence and decision

The full synthetic local product, fresh Windows clone, browser tests and Postgres E2E passed at `3ebaf02222182c85a969094506fe9a300d5a67a1`. The owner then visually reviewed the actual History, CRM and 7-node canvas screens and explicitly rejected the experience: it looks bad, gives no clear reason to exist, and does not explain what to do. **Engineering PASS != experience PASS.**

**Do not merge PR #15 to `main`, publish the showcase to LinkedIn, or reuse the current screenshots as approved marketing assets.** Keep functional backend and test evidence intact, but reopen the experience-design release gate.

## Root-cause audit grounded in current UI

1. **No explicit job to be done.** `Tu automatización, paso a paso` and `Cada decisión, evento y escritura se puede inspeccionar` describe architecture, not a user problem. A newcomer cannot answer *why use this?*
2. **Technical primitives are introduced before the outcome.** The main page begins with `Lead de demostración` and options `lead_demo_001 · high`, a retry checkbox and `Iniciar automatización`. It asks a novice to understand jargon and choose technical parameters.
3. **The main stage is a diagnostics console.** A large read-only node graph, inspector, `Timeline`, event sequence numbers and persistence metrics dominate. There is no one-line result from the user's perspective.
4. **Navigation is internal architecture instead of tasks.** `Demo interactiva`, `Historial`, `CRM ficticio`. The first two screens show raw IDs, attempts, retries and full event logs; these are useful engineering proofs but not the initial story.
5. **The CRM is a proof-of-write table, not a meaningful business outcome.** The one visible record contains `lead_demo_001`, `automation`, `high`. A viewer does not know who contacted whom, what was requested, why it mattered, or what action happened.
6. **A working approval mechanism is not explained as a safety boundary.** The important idea — the system does *not* write to CRM before a human authorizes it — is buried behind the graph.
7. **The visual grammar is a developer prototype.** Small pale secondary text, arbitrary whitespace after one-row tables, dense micro-labels, generic cards and many equal-weight status badges. There is no deliberate narrative hierarchy or payoff.
8. **`LOCAL · SLICE 2` and `Fase 5 / Slice 2` are implementation metadata**, not product-facing language. They undermine first-impression credibility.
9. **Trust requirements still matter.** The frontend cannot claim real AI classification, actual external CRM or third-party webhooks: inputs and classification are synthetic/deterministic; the worker, approval, persistence and local CRM are real.

## Single understandable demonstration narrative

**Scenario:** A potential client sends a website inquiry about automating their business. The system receives it, classifies its urgency using a clearly labelled *simulated rule*, pauses before recording an important lead, asks for human approval, then creates a *synthetic CRM* record and keeps the full audit trail.

**Core promise for a technical portfolio:** *See how a business automation can handle an incoming inquiry, require a human decision before taking action, and keep verifiable history.*

This is one complete, understandable use case; **not** an offer for a live SaaS, a real CRM integration, a workflow editor, or a live AI agent.

## Proposed new first visit / story arc

### 1. Outcome-led welcome

- Headline: **`Una consulta entra. Vos aprobás. La automatización sigue.`**
- Subhead: **`Probá cómo un sistema recibe una solicitud, evalúa su prioridad y espera tu decisión antes de guardar un registro. Cada paso queda trazado.`**
- Primary action: **`Probar con una consulta de ejemplo`**.
- Small unambiguous disclosure near CTA: **`Demo local · datos ficticios · clasificación simulada`**.
- Before the CTA, show *actual inquiry copy* from fixture text rather than raw `lead_demo_001` codes.

### 2. Guided journey — user's decision is central

- Step 1: **Consulta recibida** — display full synthetic inquiry.
- Step 2: **Prioridad detectada** — plain-language result (simulated deterministic classification).
- Step 3: **Tu aprobación** — prominent, unmissable decision card: *`¿Guardamos esta consulta en el CRM de prueba?`* with `Aprobar` and `Rechazar`.
- Step 4: **Resultado verificado** — clear `Registro guardado` / `Acción rechazada; no se modificó el CRM`. Show execution proof only after the outcome.

### 3. Secondary navigation after experience

- `Inicio`: use case, guided action and outcome.
- `Actividad`: chronological list using the inquiry subject and status instead of UUID first.
- `Registros guardados`: friendly card with synthetic lead context and a link to evidence.
- `Vista técnica`: opt-in canvas, event stream, node inspector, raw IDs, retry/attempt counters, signing/security details.

The technical graph remains a **working and accurate advanced view**, not a giant first-visit hero. Real history/approval/CRM persistence is unchanged.

## Visual direction, not yet final

Aim for a purposeful product-demo visual system: strong display typography and hierarchy; smaller controlled side navigation; generous but balanced spacing; one dominant CTA; a coherent 2-column story view with the synthetic inquiry on the left and a real-time decision/result on the right; readable action states; restrained accent palette; polished empty states and mobile story sequence.

Do **not** make it look like a generic SaaS dashboard by simply changing gradients, random card shadows, icons or colors. The product must show *cause → human decision → real persisted effect* before displaying operational telemetry.

## Acceptance gates / precise tests

- [ ] A nontechnical visitor can say **what it does**, **why it matters** and **how to try it** from the first screen in 10–15 seconds.
- [ ] First screen uses human-readable inquiry text; no raw fixture IDs/UUIDs or `slice` terminology above the fold.
- [ ] Main CTA guides from selecting a real synthetic scenario to an observed result with no required prior knowledge.
- [ ] Human approval is clearly contrasted with automatic processing; rejection yields a truthful *no-write* outcome.
- [ ] Successful approval shows a readable confirmation in the main experience; the existing PostgreSQL CRM, history and event assertions remain intact.
- [ ] `Vista técnica` reveals the existing 7-node canvas, persisted events and metrics without breaking the current API/worker.
- [ ] Mobile usability, keyboard navigation and Back/Forward functionality remain working.
- [ ] No unsupported product claims (live AI, customer CRM, external connectors, public hosting).
- [ ] Screenshots and GitHub first impression are re-curated **only after owner visually approves the new experience**.
- [ ] Updated browser E2E proves the complete guided journey in addition to existing reliability and security tests.
- [ ] No merge/publish without final owner decision; licensing provenance issue is a separate open gate.

## Scope / non-goals

Use the existing Next.js app and valid interfaces. **Keep** Fastify, real Postgres, pg-boss, fixture scenarios, durable approvals, retries, isolation, existing migrations and integration tests. Do not build commercial auth, Stripe, live AI, third-party connectors, editor, or public hosting.

**Implementation order after design agreement:** testable product narrative → information architecture + visual target → React UI redesign with preserved API contracts → browser checks + owner visual approval → re-curated media and README → licensing/merge review. The existing screenshots and CI remain evidence of functionality, not experience sign-off.
