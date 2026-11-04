# Gate 4E — Evidence ledger

**Estado:** preparando verificaciones automatizadas. La existencia de archivos no demuestra controles activos en una API.

| Evidencia | Archivo / ruta | CI |
|---|---|---|
| Firma webhook, tampering y timestamps | `packages/security/test/webhook.security.test.ts` | Por verificar |
| Sesiones, CSRF, Origin, workspace grants | `packages/security/test/sessions-auth.security.test.ts` | Por verificar |
| Cifrado AEAD, scoping y rewrap | `packages/security/test/secrets.security.test.ts` | Por verificar |
| SSRF preflight y LLM como dato no confiable | `packages/security/test/ssrf-ai.security.test.ts` | Por verificar |
| Inmutabilidad de cuotas, aislamiento SQL y purga de demo | `spikes/gate4e/test/guest-db.security.test.ts` | Por verificar |

## Bloqueos para afirmar seguridad de producto

No se ha implementado ni probado Fastify auth/session/HMAC, SQL de las entidades definitivas, TLS + pinning de destino en red, credenciales con KMS, auditoría de autorización en SSE/approval ni antiabuso de origen. No habrá conclusión «demo pública segura» hasta completar esas integraciones.

## Ejecución reproducible

```sh
npm ci
npm run typecheck:security
npm run test:security
# Para PostgreSQL real: preparar DB de prueba con prisma generate + db push
npm run typecheck:gate4e
npm run test:gate4e
```
