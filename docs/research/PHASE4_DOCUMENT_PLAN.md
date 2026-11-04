# Automation Control Room — Plan documental de la Fase 4

**Estado:** Plan de trabajo propuesto; las especificaciones no están todavía aprobadas.  
**Documento rector:** [`automation-control-room-informe-arquitectura-v1.md`](./automation-control-room-informe-arquitectura-v1.md).

## Regla de trabajo

No abrir implementaciones funcionales importantes sin un contrato verificable y una decisión documentada. Un *spike* aislado, desechable y sin dependencia de producción está permitido para verificar incertidumbres técnicas concretas, por ejemplo transacción PostgreSQL/Prisma/pg-boss.

## Gate A — Producto

**Archivo:** `docs/product/PRD.md`.

Debe concretar usuarios, objetivo medible, escenario principal de webhook→IA→aprobación→CRM, recorrido de demo, onboarding con/sin cuenta, condiciones de v1, exclusiones, criterios de éxito y no objetivos. Debe incluir pantallas y acciones reales que podrá completar un evaluador técnico.

**Aceptación:** una persona externa puede explicar qué hace el MVP y qué no hará.

## Gate B — Dominio

**Archivos:** `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DOMAIN_MODEL.md` y `docs/architecture/EXECUTION_SEMANTICS.md`.

Incluir diagramas C4 (contexto, contenedores y componentes), dirección de dependencias, responsables de datos, ERD, índices, claves únicas, estados, transiciones, versionado, transacciones, competencia de workers, pausar/reanudar/cancelar, recuperación, idempotencia y estados de resultado incierto.

**Aceptación:** para cada evento hay un dueño del estado y un resultado definido ante concurrencia o caída del proceso.

## Gate C — Contratos

**Archivos:** `docs/contracts/WORKFLOW_SCHEMA.md`, `docs/contracts/openapi.yaml`, `docs/contracts/CONNECTOR_SDK.md`, `docs/contracts/AI_CONTRACT.md`.

Incluir schemas Zod discriminados para nodos y salidas; ejemplos correctos/incorrectos; autorizaciones; esquema de errores; claves de idempotencia; metadatos de efectos externos; límites de recursos, presupuesto LLM y control de datos enviados a modelos.

**Aceptación:** API y worker pueden implementarse usando solo los contratos, sin decisiones implícitas.

## Gate D — Fiabilidad y pruebas técnicas

**Archivos:** `docs/quality/ACCEPTANCE_TESTS.md`, `docs/adr/0003-pgboss-transactional-queue.md`, `docs/adr/0009-action-ledger-and-idempotency.md`.

Incluir pruebas de PostgreSQL real, compatibilidad Prisma v7+ / `@prisma/adapter-pg` / pg-boss, commit/rollback de creación de run+job, job at-least-once, dos approvals concurrentes, crash/restart durante side effect, `uncertain` y reconciliación.

**Aceptación:** cada garantía tiene una prueba que puede fallar y que ejecutará CI.

## Gate E — Seguridad

**Archivos:** `docs/security/THREAT_MODEL.md`, `docs/adr/0010-authz-and-secrets.md`.

Definir límites de confianza, permisos por workspace, claves de cifrado, redacción, webhook firmado, antirreplay, SSRF y egress, prompt injection, demo pública con cuotas, retención de datos y dependencias de terceros.

**Aceptación:** ninguna acción externa depende exclusivamente de un permiso concedido por el modelo de IA o por el frontend.

## Gate F — Entrega

**Archivos:** `docs/ux/UX_SPEC.md`, `docs/operations/DEPLOYMENT_RUNBOOK.md`, `docs/operations/OBSERVABILITY.md`, `docs/ROADMAP.md`.

Determinar pantallas, diseño de estado de ejecución, despliegue Docker Compose, separación respecto de ClickDialog, hosting de demo, entorno staging, backup/restore, métricas, logs y orden vertical de entregas.

**Aceptación:** un desarrollador puede levantar el entorno y ejecutar el recorrido principal con instrucciones explícitas; el proceso de despliegue y rollback está documentado.

## ADR obligatorios

Cada ADR contiene: título, estado (`proposed` / `accepted` / `superseded`), contexto, opciones comparadas, decisión, motivos, consecuencias, riesgos y criterio para revisarla.

| ID | Decisión |
|---|---|
| 0001 | Monolito modular, monorepo y procesos web/API/worker |
| 0002 | PostgreSQL como fuente de verdad |
| 0003 | pg-boss con transacción PostgreSQL/Prisma |
| 0004 | DAG versionado e inmutable |
| 0005 | Sin ejecución arbitraria de código de usuario |
| 0006 | Registry de conectores tipados |
| 0007 | Human approval durable y atómico |
| 0008 | Planner IA sin permiso de ejecución |
| 0009 | ActionLedger, reintentos e idempotencia |
| 0010 | Autorización, credenciales y seguridad |
| 0011 | SSE + ledger persistente + replay |
| 0012 | Licencia Apache-2.0 y procedencia de código |
| 0013 | Infraestructura independiente y opciones de hosting |

## Gates para iniciar Fase 5

- [ ] PRD y alcance de demo aprobados.
- [ ] Diagrama y contratos de dependencias aprobados.
- [ ] Schema v1 y matriz de transiciones definidos.
- [ ] Semántica de at-least-once y side effects documentada.
- [ ] Prueba de transacción Prisma/pg-boss decidida y, si hace falta, spike concluido.
- [ ] Threat model y límites de demo aprobados.
- [ ] OpenAPI, Connector SDK, AI Contract y criterios E2E trazables.
- [ ] ADRs relevantes aceptados y roadmap de vertical slices creado.

**Primer vertical slice:** webhook → persistencia duradera → job → worker → Demo CRM → auditoría/inspector. **Segundo:** clasificación IA → aprobación → reanudación. **Tercero:** editor visual + AI Planner con definición compartida.