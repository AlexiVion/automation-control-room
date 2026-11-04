# Automation Control Room — Observability & Audit Contract v0.3

> **Gate 4F, propuesta.** No hay todavía API, SSE real, worker del producto ni dashboard operativo.

## Estado y auditoría

PostgreSQL `ExecutionEvent` es la fuente autoritativa append-only con `UNIQUE(executionId, sequence)`. El campo `Execution.lastEventSeq` aumenta en la misma transacción que la transición de estado. SSE solo distribuye eventos persistidos; la UI jamás inventa un cambio de estado basándose en una animación.

### Vocabulario propuesto de eventos

| Tipo candidato | Evidencia | Campos permitidos (sin secretos) |
|---|---|---|
| execution.queued | Ingreso, ejecución y job durables | executionId, versionId |
| step.started | Paso reclamado por worker | nodeId, attemptNo |
| step.succeeded | Resultado persistido | nodeId, durationMs, outputDigest |
| step.skipped | Rama no elegida | nodeId, branchLabel |
| approval.requested | Aprobación en DB | approvalId, expiresAt, payloadDigest |
| approval.approved / rejected | Decisión única | approvalId, actorRef anonimizado |
| step.retry_scheduled | Retry seguro programado | nodeId, nextRetryAt |
| effect.uncertain | Resultado externo no confirmado | operationKeyHash, errorCode |
| execution.completed / failed / cancelled | Estado final guardado | status, sanitized reason |

**Brecha de Gate 4C:** DTO actual permite `eventType` como string; versionar enumeración y schema definitivo al construir API/worker. Nunca presentar un evento candidato como ya emitido por una implementación inexistente.

## SSE: replay y resync

1. UI obtiene snapshot de `GET /executions/:id` autenticado y scoped.
2. Se conecta a `GET /executions/:id/events` enviando `Last-Event-ID`; el servidor envía eventos persistidos con secuencia mayor, ordenados.
3. Se ignoran duplicados; ante `sequence > last+1`, se detiene proyección y se solicita historial persistido. Si el cursor está fuera de retención, leer nuevo snapshot e informar historia incompleta, sin fabricarla.
4. Cuando cae el stream, mostrar «Sincronizando» y realizar backoff; nunca cambiar estado a completed por recibir HTTP 202.
5. Cada suscripción SSE verifica workspace y expiración de sesión; reconexiones también se autentican.
6. Heartbeats no generan eventos del dominio.

[Proyector TypeScript y pruebas unitarias](../../packages/ux-contracts/README.md) cubre deduplicación, gaps y veracidad del snapshot, **no** un stream web real.

**Brecha pendiente:** endpoint de historial paginado para re-sincronización; OpenAPI Gate 4C define SSE pero no todavía un GET paginado independiente.

## Métricas candidatas

| Nombre propuesto | Tipo | Objetivo |
|---|---|---|
| acr_webhook_ingress_total{outcome} | Counter | accepted, rejected, duplicate |
| acr_execution_active | Gauge | Respetar presupuesto de concurrencia |
| acr_queue_oldest_age_seconds | Gauge | Detectar backlog |
| acr_execution_duration_seconds | Histogram | p95 por medir en ejecución real |
| acr_step_failure_total{error_code} | Counter | Códigos tipados |
| acr_approval_pending | Gauge | Approval guest máxima 10 min |
| acr_effect_uncertain_total{connector} | Counter | Revisión humana obligatoria |
| acr_sse_resync_total{reason} | Counter | Gaps y desconexiones |
| acr_ai_requests_total{mode} | Counter | Modo invitado de pago = 0 |
| acr_guest_quota_rejections_total | Counter | Backpressure y abuso |

Evitar `workspaceId` y `executionId` como labels de métricas por alta cardinalidad; mantenerlos en eventos/logs con acceso restringido. Límites y alertas necesitan mediciones reales de carga antes de fijar valores definitivos.

## Seguridad del logging

Solo campos allowlisted: traceId, ejecución, paso, errorCode, duración, actorRef sanitizado y digest. No registrar HMAC signatures, cookies, tokens, claves de cifrado, payloads de lead ni prompts completos. El scrubber de seguridad es defensa adicional, no sustituto de minimización en origen.

## Criterios de pruebas pendientes

- Reconnect SSE real sin gaps/duplicados y autorización cross-workspace.
- API GET y stream coherentes ante reinicio worker y DB.
- Cursor manipulado / expirado rechazado con error tipado.
- Approval y ActionLedger auditados, sin secretos.
- Prueba de carga/retención y logs depurados.

No marcar estas pruebas PASS solo por tener proyección pura en TypeScript.
