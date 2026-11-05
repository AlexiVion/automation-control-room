# Workflow Lab — reusable code, licenses and real capabilities

**Status (2026-11-04):** isolated local P0 branch. Do not merge or publish until owner UI acceptance and LICENSE provenance review. This file records what was actually reused and what was not.

## License decision: source reuse without copying prohibited code

| Reference | Licensing and permitted approach | Included now? |
| --- | --- | --- |
| [React Flow / xyflow](https://reactflow.dev/) | MIT. We install the pinned public npm library **@xyflow/react 12.12.1** and keep its license notice. Dragging, edges, handles, zoom, pan and minimap are provided by the library, not rebuilt. | **YES, npm dependency and node editor** |
| [Activepieces Community core](https://www.activepieces.com/docs/about/license) | Core is MIT, enterprise/cloud packages are commercially licensed. Permissible OSS portions can be reused with their copyright/license notices, but copying a large monorepo without a scoped compatibility review is counterproductive. | **NO Activepieces source copied** |
| [n8n](https://docs.n8n.io/sustainable-use-license/) | Source-available **Sustainable Use License** is commercially restrictive. A third-party editor/hosted automation builder is outside normal free-use scenarios; vendor licensing is required. Its architecture can be researched, but do not embed or rebrand its source in this portfolio. | **NO n8n source copied** |
| Make.com | Proprietary automation product; no general-purpose source license authorizing copying it into this repository. May be used only as a UI/feature benchmark. | **NO code copied** |
| Existing ACR Zod, PostgreSQL/Prisma, pg-boss | Already installed dependencies and authored ACR modules. Graph schema, guest sessions, CSRF, worker/DB boundaries are reused directly. | **YES** |

**Important:** the project's root LICENSE still contains unresolved Sim Studio attribution copied in a prior branch. Nothing in this PR resolves provenance; do not claim license clearance or remove attribution without evidence.

## What is actually implemented on this branch

1. A bounded graph interpreter driven by the **submitted graph**, not the legacy fixed lead IDs. Supports local trigger, condition (eq/neq), static template, one human approval, local CRM action and finish. AI and arbitrary HTTP are **forbidden**, not silently simulated.
2. A separate PostgreSQL LabWorkflow draft and immutable LabVersion records. Clients can create/update/publish multiple workflows with optimistic revision checks.
3. A worker queue for LabExecution using the exact published version and input. Waiting approval pauses a real execution. After approval, local LabRecord writes and execution state update occur in **one transaction**. Rejection yields no write.
4. E2E creation of two different user-authored flows; same input changes result after publishing V2. Old V1 remains addressable.
5. **Interactive React Flow Studio** at /lab: node palette, connect/disconnect, condition/approval/action configuration, draft saving, publishing, running and inspecting/contrasting versions.
6. Separate guest/CSRF scopes and local-only launch. No third-party calls, provider secrets, live AI, hosted SaaS, cloud data or commercial billing.

## Honest limitations

- The interpreter supports **trees without joins** and one approval node. The schema validates a bounded DAG, but not all theoretically supported node types are enabled.
- Visual node positions are currently local editor state, not persisted design coordinates. The graph structure and configurations **are** stored.
- Each guest can start at most **five** workflow runs, shared with the legacy demo quota. Only one run per workspace can be active; a pending approval can occupy the slot.
- Current LabExecution stores bounded trace JSON, not a full durable temporal replay engine. "Compare" shows real persisted traces of separate immutable versions, not an illusion of replay.
- Simulated/fixture AI classification from the legacy demo is not part of the lab runtime. No external CRM or HTTP connector is used.
- Approval waiting does not yet have an independent expiry processor. The guest workspace eventually expires; do not claim production-grade job recovery.
- Publish and worker E2E needs GitHub CI and Windows local acceptance before marking complete.

## Reproduce

From this branch, use the existing local Windows launcher \`scripts/windows-start-slice2.ps1\`, a **different Docker Compose -Project and -Port from any existing environment**, and open \`http://localhost:<port>/lab\`. The old fixed demo remains at \`/\` as a regression baseline, not the new studio.

The full product smoke now requires \`TWO_CUSTOM_WORKFLOWS_EXECUTED_PASS\` and the Chromium suite requires \`WORKFLOW_LAB_BROWSER_E2E_PASS\` on top of the legacy tests.

**No copying/translation of n8n or Make implementation into this repository was performed.** Reusing an MIT library is faster and safer than a proprietary code transplant.
