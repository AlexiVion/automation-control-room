# Architectural References — Comparative Research
**Status:** research map, not a code audit of every file. Source projects evolve; pin SHAs before copying any technical detail into an ADR.

| Project | Focus and repo |
|---|---|
| Sim | [simstudioai/sim](https://github.com/simstudioai/sim): visual workflow authoring and AI nodes |
| Activepieces | [activepieces/activepieces](https://github.com/activepieces/activepieces): API, engine, sandbox, worker boundaries |
| Windmill | [windmill-labs/windmill](https://github.com/windmill-labs/windmill): code-first jobs, PostgreSQL queue, sandboxing |
| Trigger.dev | [triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev): durable runs and observability |
| Kestra | [kestra-io/kestra](https://github.com/kestra-io/kestra): scheduler/executor/worker patterns |
| Langflow | [langflow-ai/langflow](https://github.com/langflow-ai/langflow): graph/AI module separation |
| Flowise | [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise): agent flow modular editor (verify current repo state) |
| Automatisch | [automatisch/automatisch](https://github.com/automatisch/automatisch): connector platform |
| n8n | [n8n-io/n8n](https://github.com/n8n-io/n8n): orchestration editor and execution patterns, fair-code license |

## Reuse policy
We study concepts and interfaces; **no forks and no copied project engines**. Direct reuse is allowed only after file-level license, dependency and provenance review, with required notices and compliance. Open source, source-available and commercial components are not equivalent.

## Evidence required for deeper audits
Commit SHA; path or permalink; call-trace from HTTP ingress through DB, queue, worker and connector; schema and index proof; recovery test; license file; confidence/limitations. This document does **not** claim that every execution path was verified.
