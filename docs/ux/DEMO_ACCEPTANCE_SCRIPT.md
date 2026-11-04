# Demo de 90 segundos — guion de aceptación reproducible

> **Gate 4F, definición de producto; NO ejecutado end-to-end.**
> 
> Esta especificación es para probar una futura app real con PostgreSQL y worker. **No** se pueden marcar como PASS los pasos sin endpoints y navegador implementados.

## Preconditions

- Servicio web, API, worker y PostgreSQL sanos; fixture sintética cargada; no acceso a ningún sistema externo.
- Entorno nuevo, navegador de invitado sin cuenta ni API key, sesión aislada.
- Modo `deterministic_fixture` declarado en UI, sin llamadas LLM reales.
- `WorkflowVersion` publicado para lead route; `lead_demo_001` prioridad alta activa approval.
- API, SSE y DB ofrecen correlación de IDs `workspaceId,workflowVersionId,executionId,sequence`.

## Recorrido feliz — objetivo 90 s (no SLA)

| Tiempo objetivo | Acción del visitante | Evidencia que DEBE existir |
|---|---|---|
| 0–10 s | Abrir `/`, pulsar Probar demo | Workspace creado, cookie de sesión opaca |
| 10–20 s | Seleccionar `lead_demo_001` (alta) | Fixture visible, sin clave ni llamada IA |
| 20–30 s | «Simular entrada por webhook» | `WebhookReceipt`, Execution `queued` y trabajo durable |
| 30–45 s | Ver nodos procesados | `ExecutionEvent` de trigger, fixture, condición; respuesta SSE |
| 45–60 s | Leer aprobación y pulsar Aprobar | Approval `approved` transaccional, job de continuación |
| 60–80 s | Ver CRM demo | Upsert real con `workspaceId+externalKey` único |
| 80–90 s | Abrir inspector/refrescar | Estado `completed` y eventos recuperables tras refresco |

**Solo completar si la ejecución entra realmente a completed.** Si el worker no responde, el test falla; el frontend no debe producir una animación engañosa.

## Recorrido de fallo seguro (separado, no dentro del presupuesto de 90 s)

- Volver a disparar **`lead_demo_001` (high)** con un **nuevo `sourceEventId`**, manteniendo el mismo lead ID. Activar «Simular error transitorio una vez» del conector de CRM **antes** del upsert.
- Aprobar; comprobar primer fallo, evento `retrying`, luego `completed`.
- Contar CRM: una sola fila con externalKey del lead (aunque haya varias ejecuciones/intentonas), y comparar ActionLedger.
- Repetir con el **mismo** `sourceEventId`: debe devolver execution existente o indicar duplicado, sin ejecutar nuevo efecto.

## Recorrido de rechazo (separado)

- Disparar `lead_demo_001` (high) con nuevo `sourceEventId`.
- Rechazar en approval pendiente. Debe terminar `cancelled` (contrato de Gate 4B) y **no** producir una nueva escritura CRM. Si el lead ya existía de otro recorrido, comparar digest/updatedAt o utilizar **nuevo workspace demo**, no afirmar «CRM vacío» si no lo estaba.
- Intentar decidir de nuevo: respuesta 409 o estado final equivalente, sin nueva continuación.

## Recorrido de rama sin aprobación

- Disparar `lead_demo_002` (medium) o `lead_demo_003` (low).
- La condición elige rama `false`, marca pasos no elegidos `skipped` y termina **sin approval ni upsert**.
- Verificar en DB que no se creó una nueva ApprovalRequest ni CRMRecord para ese lead.

## Pruebas de veracidad y aislamiento

- Refrescar inspector; leer Execution por API y retomar SSE desde último `sequence`.
- Forzar desconexión SSE; no duplicar eventos y hacer catch-up desde DB.
- Abrir segunda sesión aislada: no puede leer la primera aprobación, run ni CRM.
- Intentar callback HMAC inválido y CSRF cross-origin: rechazar.
- Worker reiniciado: cola sigue disponible, no hay efecto duplicado.
- Probar 6º run invitado: `429`; sesión vencida: 401/estado expirado.
- Verificar que **no** salen requests a conectores HTTP externos ni IA paga durante la demo.

## Fuente de evidencia

Para aceptar pruebas E2E, adjuntar `npm ci`/Docker Compose pinning, fecha, GitHub Actions run, screenshot del flujo, script Playwright, identificadores anónimos de run, query o aserción del DB, logs sanitizados. Los tests de Gate 4D/4E son **pruebas de componentes**, no sustitutos del flujo E2E.

## Bloqueos de diseño no fingidos

- No hay frontend/Playwright conectado a API real todavía.
- El GET de lista de approvals no está todavía en OpenAPI.
- No se ha implementado rate-limit global, SSE handler ni transporte HTTP seguro.
- La duración objetivo depende de infraestructura sana, no está medida.
