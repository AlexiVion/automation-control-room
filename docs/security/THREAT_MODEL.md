# Threat Model — ACR
**Status:** proposed · **Gate:** 4E

## Trust boundaries
Browser → authenticated API; external webhook sender → validated intake; API → PostgreSQL; worker → credential vault → connector; untrusted lead text → LLM; public guest demo → isolated fixture only.

## Risks and mandatory controls
| Threat | Mitigation |
|---|---|
| Forged/replayed webhook | HMAC signatures, timestamp window, source event ID deduplication |
| Cross-workspace access | Server-side scoped queries; per-resource authorization; negative tests |
| Prompt injection | Treat model response as untrusted data; schema/policy validation before publishing |
| SSRF via HTTP node | Explicit destination allowlist, DNS/IP validation, redirect checks, network-level egress rules |
| Credential exfiltration | Encryption at rest, scoped access, no secrets in logs, frontend or AI prompt |
| Duplicate external effects | Stable idempotency key, ActionLedger, reconciliation/needs_review |
| Guest demo abuse | Per-session isolation, resource quotas, rate limits, expiry and hard egress restrictions |
| Dependency compromise | Lockfiles, dependency review, CI scanning and provenance |

## Security gate
Negative integration tests for every boundary; validate network egress at connection time, not only string/hostname checks. No production visitor credentials or unrestricted outbound HTTP in the demo.

## 4A — Controles adicionales para sesiones anónimas propuestas

Este apartado deriva del [PRD §4](../product/PRD.md) y del [ADR 0014](../adr/0014-anonymous-demo-sandbox-and-ai-modes.md). **No se considera una implementación ni una auditoría superada**.

| Vector | Política prevista | Prueba negativa |
|---|---|---|
| Secuestro de sesión / IDOR | Cookie opaca, IDs aleatorios, autorización de workspace en **cada consulta y escritura** | Workspace B no lee, cambia ni aprueba datos de A |
| CSRF en sesión cookie | Origin/Referer permitidos y protección CSRF para mutaciones | POST cross-origin rechazado |
| Extracción por eventos SSE | Endpoint scoped por sesión; cursor validado | A no puede suscribirse a run de B |
| Agotamiento por invitados | 1 workspace/sesión, 5 runs/24h, 1 activa/sesión, 4 globales; límites de creación de sesión y backpressure | Ráfagas limitadas de forma verificable |
| TTL sin limpieza | Inactividad 30 min; límite absoluto 24 h; job de purga con verificación de filas dependientes | Sesión/datos expirados inaccesibles y eliminados |
| Salidas exteriores / proveedores pagos | Invitados nunca acceden a `http.request` externo ni LLM real | La capa de API, policy y worker rechazan la llamada |
| Información sensible en guest data | Solo fixtures sintéticas, sanitización y retención corta | Payload no aparece en logs/sesión ajena |
| Simulación confundida con IA | Etiqueta permanente de fixture determinista | E2E busca rótulo claro, sin falsa atribución |
| Webhook externo falsificado | Ruta separada, HMAC con timestamp/eventId y prevención de replay | Rechazar sin firma, firma mala, caducidad y duplicado |

Los números son presupuestos iniciales de producto. Los límites globales deben persistir/aplicarse en servidor y supervisarse; un navegador malicioso puede borrar cookies, de modo que el límite por sesión **no basta** contra abuso sistemático. Antes del lanzamiento público se define un mecanismo adicional por origen y cupo de infraestructura sin utilizar direcciones IP como clave de autorización.

En la demo, el botón «Simular entrada» usa una ruta de sesión que produce un evento `demo.webhook` y comparte el caso de uso de creación de execution con el endpoint operador firmado. Nunca se considera que una simulación pruebe criptográficamente la recepción HMAC.
