# Automation Control Room — Deployment & Operations Runbook v0.3

> **Gate 4F · Propuesta, no despliegue ejecutado.** No existe aún el frontend Next.js, API Fastify ni worker del producto. El Compose actual ejecuta únicamente verificaciones técnicas sobre PostgreSQL de pruebas y Node.js.

## Topología objetivo (Fase 5)

| Componente | Función | Situación actual |
|---|---|---|
| Web Next.js | Demo guiada, React Flow, inspector, approvals | No implementado |
| API Fastify | Auth, webhooks, drafts, publish, SSE, approval | No implementado |
| Worker independiente | DAG durable, conectores, ActionLedger, retry | No implementado |
| PostgreSQL 17 + pg-boss | DB autoritativa + cola transaccional | Spikes Gate 4D/4E verificados |
| IA real | Solo operador con proveedor configurado | Contrato, sin integración |
| HTTP externo | Egress restringido por política/TLS/IP | Bloqueado hasta seguridad de red |

PostgreSQL nunca se expone públicamente. El worker nunca se aloja dentro de un proceso web serverless. El proyecto es independiente de ClickDialog: sin reutilizar DB, credenciales, datos ni servicios productivos.

## Un comando local: validar contratos y experimentos

Requisitos: Git, Docker Engine y Docker Compose v2. Desde la raíz del repositorio:

```bash
docker compose -f ops/compose/validation.yml up --abort-on-container-exit --exit-code-from verifier
```

Limpiar servicios y volúmenes de pruebas:

```bash
docker compose -f ops/compose/validation.yml down -v --remove-orphans
```

La configuración define PostgreSQL 17 en almacenamiento efímero, **sin puertos publicados**, y un contenedor Node 22 en el mismo namespace de red para respetar la protección local del spike. Se monta el repositorio en solo lectura; node_modules y Prisma generated se guardan en volúmenes separados y no sobrescriben los archivos de Windows.

**Estado de evidencia:** el único CI comprobará sintaxis Compose mediante `docker compose config --quiet` además de los tests normales. La ejecución integral del comando Compose no se declara PASS mientras no sea ejecutada por separado. No es un `docker compose` del producto web/API/worker.

## Compatibilidad Docker Desktop en Windows (incidente 2026-11-04)

Una validación local sobre Docker Desktop 28.4/Compose 2.39 encontró que el Compose original de Fase 4 montaba el checkout `/workspace:ro` y además volúmenes hijos en `/workspace/node_modules` y `/workspace/spikes/gate4d/generated`. **Falló antes de iniciar el contenedor verificador** con `mkdirat ... /workspace/node_modules: read-only file system`, pese a que el mismo Compose había pasado en GitHub Actions Linux.

**Corrección:** el checkout se monta solo en `/source:ro`. El shell del verificador realiza `cp -a /source/. /workspace/` y todas las escrituras de npm y Prisma suceden en el directorio `/workspace` propio y escribible del contenedor. No hay volúmenes anidados bajo un bind read-only. Al bajar el proyecto se elimina el overlay efímero del verificador.

La salida del primer script PowerShell impresa después de un `throw` **no es evidencia** de aprobación: cuando se pegan líneas de forma interactiva, PowerShell puede seguir ejecutando los comandos restantes y mostrar un falso encabezado `PHASE 4 PASS`. Repetir la validación dentro de un bloque `& { ... }` y emitir `PASS` únicamente si `docker compose up --exit-code-from verifier` devuelve 0.

La verificación Linux CI del fix y la repetición Windows por parte del usuario son evidencias **separadas**; no atribuir una prueba Windows a GitHub Actions.

## Arranque del producto futuro: orden obligatorio

1. Configurar TLS, claves, límites de gasto, autorización, backups y egress antes de abrir tráfico.
2. Verificar readiness PostgreSQL y credenciales de migración separadas.
3. Ejecutar backup y comprobar integridad antes de migración sensible.
4. Aplicar migraciones versionadas con `prisma migrate deploy`. **Prohibido usar `prisma db push --accept-data-loss` en producción**.
5. Iniciar API, probar liveness y readiness (rutas por definir) con DB, policy y schema version.
6. Iniciar worker bajo supervisor y confirmar acceso a cola sin efectos externos no controlados.
7. Iniciar web, verificar flujo feliz real desde navegador y controles de seguridad.
8. Habilitar entrada pública solo con checklist completo. En fallo, no habilitar release.

## Healthchecks y manejo de fallos

| Servicio | Liveness | Readiness | Conducta segura |
|---|---|---|---|
| Web | Proceso responde | API accesible, renderiza ruta | Mostrar error verificable |
| API | Event loop activo | DB+schema+auth+queue | Rechazar nuevas ejecuciones si DB no funciona |
| Worker | Heartbeat de supervisor | Queue accesible + lease | Dejar trabajos persistidos y reintentar solo los seguros |
| PostgreSQL | pg_isready | Tablas/roles/permisos | Detener escrituras cuando no está disponible |
| SSE | Conexión autenticada | Cursor/historial recuperable | Recargar snapshot, nunca inventar eventos |

Una cancelación no revierte efectos externos ya realizados. Los resultados HTTP inciertos se convierten en `needs_review` y requieren reconciliación/manual review.

## Backups, retención y restauración

**Objetivos candidatos, no SLA:** backup diario, retención inicial 7 días, verificación semanal en DB aislada; RPO deseado ≤24 h y RTO deseado ≤4 h, sujetos a pruebas reales y presupuesto.

Procedimiento propuesto: detener nuevas escrituras; crear backup consistente y cifrado; registrar checksum+fecha; restaurar en DB **nueva**, comprobar migraciones, claves, FK, secuencias de eventos, registros ActionLedger y approvals; identificar efectos externos potencialmente no reflejados tras restauración; reconciliar antes de reabrir tráfico. No reintentar ciegamente un proveedor externo.

**No se ha ejecutado todavía un backup/restore rehearsal**. PostgreSQL de Compose usa datos desechables; no es un backup.

## Observabilidad

Registrar counters de ingreso, edad máxima de jobs, durations de runs, retries, approvals expiradas, effects uncertain, reconnects SSE y gasto del proveedor de IA en operador. Usar trace IDs y logs sanitizados, evitando tokens y datos del lead. Definición detallada: [Observability](OBSERVABILITY.md).

## Seguridad y despliegue público

- No lanzar mientras falten middleware Fastify de sesión+CSRF+HMAC, scopes por workspace en todas las rutas y cuotas globales.
- Credenciales cifradas con claves externas a DB; revocación/rotación auditadas.
- HTTP saliente **deshabilitado** mientras no haya pinning de IP, TLS/SNI, redirects prohibidos y egress firewall comprobado.
- Demo invitado: IA fixture, datos sintéticos, no pagos/credenciales ni conectores externos.
- Hosting para web y workers deberá comprobar sus términos/recursos; no asumir que un frontend serverless aloja jobs duraderos.

## CI: coste controlado

Un único workflow existente ejecutará TypeScript, Vitest de contratos/seguridad/UX, schema drift, integración PostgreSQL y chequeo de Compose. Playwright real **solo cuando existan frontend y API**. Sin jobs paralelos redundantes.

## Gate de salida

[Release Gates](../quality/RELEASE_GATES.md). Ningún test de componentes acredita por sí solo una aplicación desplegable o segura públicamente.
