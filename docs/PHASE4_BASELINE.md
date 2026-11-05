# Automation Control Room — Estado consolidado de Fase 4

> **Baseline candidata · 2026-11-04 · NO aprobada ni desplegada.**  
> Fuente: [PR #1](https://github.com/AlexiVion/automation-control-room/pull/1), [Roadmap](ROADMAP.md), [CI completo](https://github.com/AlexiVion/automation-control-room/actions/runs/41843924596).

## Alcance

Sistema open source de automatización empresarial con demo de 90 segundos, editor visual, propuesta de workflows por lenguaje natural en modo operador, API Fastify, workers durables, PostgreSQL como fuente de verdad, aprobaciones humanas, seguridad por workspace y auditoría de ejecuciones.

**Independiente de ClickDialog.** No se ha implementado todavía el producto web/API/worker: existen documentación, contratos TypeScript, pruebas unitarias, prototipos de persistencia y un Compose para ejecutar **verificaciones**.

## Arquitectura candidata establecida

| Capa | Elección propuesta | Fundamento |
|---|---|---|
| Frontend | Next.js + React + React Flow | Editor visual y visor de ejecución en web |
| API | TypeScript + Fastify + Zod/OpenAPI 3.1 | Validación estricta y separación HTTP/dominio |
| Worker | Proceso TypeScript independiente | Reintentos y pausas sin depender de peticiones HTTP |
| Persistencia | PostgreSQL 17 + Prisma 7.10.1 | Ejecuciones, approvals y auditoría durables |
| Queue | pg-boss 12.38.0 en PostgreSQL | Atomic enqueue/rollback probado con fromPrisma(tx) |
| Motor | DAG secuencial versionado, sin scripts arbitrarios | Determinismo y seguridad para MVP |
| IA | Propuestas Zod, guardrails de servidor | El modelo nunca publica ni ejecuta efectos |
| Demo | Workspaces efímeros y fixtures sintéticas | Sin cuentas, sin costo IA para invitados |
| Efectos | Aprobación, ActionLedger, idempotencia y needs_review | Resultados ambiguos no se reintentan a ciegas |
| Desarrollo | Un CI + Docker Compose de validación | Reproducibilidad sin infraestructura comercial |

## Matriz de gates

| Gate | Definición / entregables | Evidencia técnica | Estado formal |
|---|---|---|---|
| 4A Producto | [PRD](product/PRD.md), [escenarios](product/DEMO_SCENARIOS.md), ADR 0014 | Alcance escrito | Revisión del propietario pendiente |
| 4B Dominio | [Domain Model](architecture/DOMAIN_MODEL.md), [Execution Semantics](architecture/EXECUTION_SEMANTICS.md) | Modelo especificado | Revisión del propietario pendiente |
| 4C Contratos | [Zod & ports](../packages/contracts/src/index.ts), [OpenAPI](contracts/openapi.yaml) | **24 tests PASS** | Evidencia PASS; aceptación pendiente |
| 4D Fiabilidad | [Spike](../spikes/gate4d/README.md), ADR 0003 | **9 PostgreSQL tests PASS** | Evidencia PASS; aceptación pendiente |
| 4E Seguridad | [Controles](security/SECURITY_CONTROLS.md), [Evidencia](security/SECURITY_EVIDENCE.md) | **27 unit + 4 PostgreSQL PASS** | Componentes PASS; seguridad de app pendiente |
| 4F UX/Ops | [UX spec](ux/UX_SPEC.md), [wireframes](ux/WIREFRAMES.md), [guion](ux/DEMO_ACCEPTANCE_SCRIPT.md), [runbook](operations/DEPLOYMENT_RUNBOOK.md) | **7 UX tests PASS + Compose end-to-end PASS** | Evidencia PASS; producto UI pendiente |

## Evidencia reproducible

[GitHub Actions #41843924596](https://github.com/AlexiVion/automation-control-room/actions/runs/41843924596) — CI **PASS**, 71 tests en total: 24 contratos + 27 seguridad + 7 UX projection + 9 PostgreSQL fiabilidad + 4 PostgreSQL guest-scoping. Además, `docker compose config --quiet` y **comando Docker Compose completo** PASS, repitiendo las pruebas dentro del contenedor Node contra un PostgreSQL efímero independiente.

Ejecutar desde la raíz del repo:

```powershell
docker compose -f ops/compose/validation.yml up --abort-on-container-exit --exit-code-from verifier
docker compose -f ops/compose/validation.yml down -v --remove-orphans
```

**Qué no prueba esto:** navegador Next.js, API Fastify integrada, worker de producto, SSE real, backup/restore productivo ni seguridad de un sitio público. El Compose ejecuta una **batería de pruebas**, no un producto terminado.

## Decisiones y bloqueos por resolver

1. **4A:** aceptar presets de demo, límites, cuotas y modos de IA del PRD.
2. **4B:** aprobar estados/transiciones/ACL, modelado final e índices/migraciones de producto.
3. **4C:** complementar OpenAPI con listado de approvals y recuperación paginada de eventos, auth operador definitivo y contratos de condición/skipped.
4. **4D:** conservar `needs_review` para efecto HTTP incierto; no prometer exactly-once remoto.
5. **4E:** antes de lanzar, middleware Fastify real, scope en SSE/approval, antiabuso global, gestión de claves, HTTP con TLS/IP pinning + firewall o HTTP deshabilitado.
6. **4F:** crear pantallas Next.js reales, Playwright E2E, validar mobile/accessibility, Compose web/API/worker, simulacro backup/restore.

## Siguiente paso recomendado

Aprobar **baseline de arquitectura propuesta** en el PR con la lista de bloqueos registrada; después ejecutar **Fase 5 — vertical slice 1**: monorepo real apps/web + apps/api + apps/worker, migraciones y Compose del producto, /health autenticación básica y primer flujo sintético persistido (sin simular éxito). Evitar seguir ampliando la investigación de los nueve repositorios o crear un marketplace antes del flujo E2E.

**No** fusionar un PR de arquitectura como si liberara el producto. La aceptación formal de gates y ADR debe quedar explícita antes de marcar la fase como cerrada.
