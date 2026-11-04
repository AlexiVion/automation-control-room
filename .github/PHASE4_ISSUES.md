# Phase 4 — Architecture Definition

Architecture and implementation are tracked in **one repository**.

| Gate | GitHub Issue | Main documents |
|---|---|---|
| 4A — Product / MVP | [#2](https://github.com/AlexiVion/automation-control-room/issues/2) | [PRD](../docs/product/PRD.md) |
| 4B — Domain / execution | [#3](https://github.com/AlexiVion/automation-control-room/issues/3) | [Domain model](../docs/architecture/DOMAIN_MODEL.md), [semantics](../docs/architecture/EXECUTION_SEMANTICS.md) |
| 4C — Typed contracts | [#4](https://github.com/AlexiVion/automation-control-room/issues/4) | [Workflow](../docs/contracts/WORKFLOW_SCHEMA.md), [connectors](../docs/contracts/CONNECTOR_SDK.md), [AI](../docs/contracts/AI_CONTRACT.md) |
| 4D — Reliability spike | [#5](https://github.com/AlexiVion/automation-control-room/issues/5) | [Execution semantics](../docs/architecture/EXECUTION_SEMANTICS.md), [ADR 0003](../docs/adr/0003-postgres-queue-pg-boss.md) |
| 4E — Threat model | [#6](https://github.com/AlexiVion/automation-control-room/issues/6) | [Security](../docs/security/THREAT_MODEL.md) |
| 4F — UX, Ops, tests | [#7](https://github.com/AlexiVion/automation-control-room/issues/7) | [Acceptance matrix](../docs/quality/ACCEPTANCE_TESTS.md), [Roadmap](../docs/ROADMAP.md) |

## Review workflow

[Draft PR #1](https://github.com/AlexiVion/automation-control-room/pull/1) carries the proposed documentation. Keep the PR draft until decisions are reviewed; **do not** mark a gate complete because a document exists. Approve a gate when its decisions, executable contracts and required test evidence are recorded.

**Next action:** start #2 (Gate 4A) and confirm guest demo design, resource budgets and the exact UX scope.

## Evidencia técnica de cierre de definiciones (2026-11-04)

[CI #41843924596](https://github.com/AlexiVion/automation-control-room/actions/runs/41843924596) confirma **71 tests PASS + Docker Compose completo PASS**: contratos, seguridad, proyección UX, PostgreSQL/pg-boss y guest isolation. Esta evidencia no aprueba automáticamente los gates ni autoriza lanzamiento público.

[Baseline consolidada de Fase 4](../docs/PHASE4_BASELINE.md) · [Release Gates](../docs/quality/RELEASE_GATES.md). En particular, Gate 4F [#7](https://github.com/AlexiVion/automation-control-room/issues/7) requiere revisión formal; API/web/worker completos y Playwright quedan para Fase 5.
