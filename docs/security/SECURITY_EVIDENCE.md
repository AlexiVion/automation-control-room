# Gate 4E — Registro verificable de seguridad

> **Estado:** pruebas aisladas **PASS**, aprobación arquitectónica pendiente. **No autoriza despliegue público.**  
> **Fecha:** 2026-11-04 · **Commit de CI:** `760232b7f733db8beda9c3c9d66bd9ed456ada01`

## Evidencia principal

**[GitHub Actions — ejecución #41840871229](https://github.com/AlexiVion/automation-control-room/actions/runs/41840871229)**: CI completo PASS con PostgreSQL 17 efímero, npm ci, TypeScript, schema drift, contratos y fiabilidad previa.

| Suite | Casos | Estado | Código |
|---|---:|---|---|
| Contratos TypeScript/Zod + OpenAPI | 24 | PASS | [contracts/test](../../packages/contracts/test) |
| Security primitives | 27 | PASS | [security/test](../../packages/security/test) |
| PostgreSQL + pg-boss 12.38.0 (Gate 4D) | 9 | PASS | [gate4d/test](../../spikes/gate4d/test) |
| PostgreSQL — sesiones, aislamiento, cuotas, TTL | 4 | PASS | [gate4e/test](../../spikes/gate4e/test) |
| **Total** | **64** | **PASS** | — |

### Controles realmente ejercitados

- **Webhook**: HMAC-SHA256 sobre bytes originales, ventana temporal, identificación de evento, firma manipulada, clave errónea, entrada sobredimensionada.
- **Sesiones**: bearer aleatorio de 256 bits, almacenamiento por hash, vencimiento 30 minutos inactividad / 24 horas absoluto, cookie HttpOnly/Secure/SameSite, CSRF y validación Origin.
- **Autorización**: denegación de grants de operador y de recursos de otros workspaces en la política tipada.
- **Secretos**: AES-256-GCM con clave de 256 bits, nonce aleatorio, AAD workspace/credential, rechazo de tampering y rewrap.
- **SSRF preflight**: allowlist de dominio exacto HTTPS, rango público IPv4, rechazo de metadatos e IP privadas/IPv6, redirects, dominios confusos y puertos no permitidos.
- **IA**: salida LLM validada por schema+política; una propuesta no tiene privilegios de publicación ni ejecución.
- **DB aislada**: guest scope se resuelve por token hasheado; operaciones CRM limitadas a workspace; cuota de 1 ejecución activa, 5 inicios/24h aplicada atómicamente; sesión expirada rechazada y datos eliminados con cascada.

### Riesgos que **NO** cubre este PASS

1. Ninguna ruta Fastify integra todavía HMAC, cookies, CSRF o autorización. Los resultados no prueban seguridad de una API.
2. La defensa SSRF por ahora es **validación previa**: no existe un transport que haga DNS pinning al socket, TLS/SNI y egress firewall. **No habilitar HTTP externo**.
3. La gestión de claves real (KMS, entorno, rotación segura, revocación) aún no existe.
4. No están verificados el aislamiento de SSE/approval en endpoints reales, cuotas globales ni antiabuso distribuido, ni un worker periódico que ejecute cleanup en despliegue.
5. Prompt injection no está resuelto por completo: validamos permisos de la salida estructurada, no la corrección semántica del modelo.
6. Los modelos `Spike*` son experimentales y utilizan `prisma db push` sobre DB desechable; **no constituyen las migraciones de producción**.

## Gate 4E: criterio de aprobación

Los contratos y pruebas aisladas están verificadas. El propietario debe aprobar o ajustar ADR 0010 y ADR 0016, y registrar como **bloqueadores de release** los controles integrados que aún no existen. No cerrar el gate fingiendo que la seguridad de una demo pública está demostrada.

## Reproducción

```bash
npm ci
npm run typecheck
npm run test:contracts
npm run typecheck:security
npm run test:security
npm run contracts:check
# Con PostgreSQL local desechable:
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts --accept-data-loss
npm run typecheck:gate4d && npm run test:gate4d
npm run typecheck:gate4e && npm run test:gate4e
```

Más contexto: [Security Controls](SECURITY_CONTROLS.md) · [Threat Model](THREAT_MODEL.md) · [Issue #6](https://github.com/AlexiVion/automation-control-room/issues/6).
