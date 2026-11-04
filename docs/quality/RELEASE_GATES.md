# Gate 4F — Aprobación de arquitectura y criterios de release

> **Propuesta, no aprobada.** Las fases 4A–4F definen la arquitectura; la fase 5 construirá web, API, worker y validación de producto. Un CI de componentes PASS no equivale a una demo pública funcional.

## Evidencia: dos niveles distintos

| Elemento | Disponible hoy | Falta para release |
|---|---|---|
| Contratos Zod/OpenAPI | 24 pruebas CI PASS Gate 4C | Integrar handlers reales |
| PostgreSQL + pg-boss | 9 pruebas CI PASS Gate 4D | Engine real, migraciones de producción |
| Seguridad | 27 unitarias + 4 DB PASS Gate 4E | Auth API, egress TLS, KMS, cuotas globales |
| UX veracidad de eventos | Proyector y tests Gate 4F candidato | SSE, UI Next.js, Playwright |
| Wireframes y demo | Documentos UX y guion de 90 s | Evaluación visual, pruebas con usuario |
| Compose de validación | Archivo propuesto + sintaxis por verificar | Ejecutar comando completo en clean clone |
| Stack web/API/worker | **No existe** | Implementar y validar Docker Compose real |
| Backups/restore | Runbook de diseño | Simulacro de restauración comprobado |
| Producto público | **No desplegado** | Checklist completo de producción |

## Gate 4F — revisión documental y técnica

- [ ] Validar flujo [UX_SPEC](../ux/UX_SPEC.md), [wireframes](../ux/WIREFRAMES.md) y [guion demo](../ux/DEMO_ACCEPTANCE_SCRIPT.md).
- [ ] Revisar contrato de estado UI y cursor SSE, sin falsificar completados.
- [ ] CI único incluye pruebas UX, contratos, seguridad y PostgreSQL; resultados registrados.
- [ ] Docker Compose pasa `config --quiet` en CI y el comando completo se ejecuta antes de afirmar reproducibilidad.
- [ ] Runbook incluye health/readiness, rollback, backup/restore, límites de red, métricas, incidentes.
- [ ] Bloqueadores de release trazados en Issues; ADR 0017/0018 aprobados o pendientes expresamente.

## No se autoriza una demo pública sin TODO esto

- [ ] Frontend, Fastify API y worker independientes conectados a PostgreSQL real.
- [ ] Autenticación operador y cookies demo, CSRF, HMAC, scope en cada endpoint y SSE.
- [ ] Cuotas por sesión **y globales**, protección antiabuso, cleanup operando.
- [ ] Workflows publicados inmutables, aprobación durable, ActionLedger y CRM idempotente.
- [ ] API historial SSE con replay y resync de gaps.
- [ ] HTTP externo **deshabilitado** hasta pinning IP/TLS/SNI y egress firewall o test de denegación guest.
- [ ] LLM real solo operador con límites de gasto; fixture claramente rotulada en demo.
- [ ] Playwright E2E: feliz, reintento, rechazo, rama medium/low, refresh, cursor gap, 401/409/422/429 y aislamiento entre dos invitados.
- [ ] Compose del producto arranca desde checkout limpio, seed/migraciones y healthchecks reales.
- [ ] Backup/restore rehearsal PASS en DB aislada y conciliación de efectos inciertos.
- [ ] Teclado/foco/lector de pantalla, contrastes objetivo WCAG 2.2 AA y vista móvil comprobados.
- [ ] Logs sin secretos, dependencias y configuración revisadas, evidencia CI fechada.

## Slices recomendados de Fase 5

1. Scaffolding web/API/worker + migraciones y Compose reales.
2. Ingress autenticado → Execution/Job en DB → worker y fixture IA.
3. Engine secuencial, approval durable, ActionLedger y CRM ficticio.
4. Inspector solo lectura con SSE persistido, auth y resync.
5. Editor visual/validación/publicación inmutable.
6. AI Planner real solo operador y políticas de red/secrets.
7. Hardening, Playwright, recuperación/backup y primer despliegue seguro.

**Decisión siguiente:** revisar los ADR 0001–0018 y los bloqueadores. No abrir comercialización, facturación ni marketplace antes del MVP verificable.
