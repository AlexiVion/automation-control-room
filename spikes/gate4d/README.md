# Gate 4D — Transaccionalidad y recuperación: prueba aislada

**Estado:** Evidencia CI PASS · 2026-11-04 · Diseño sujeto a aprobación en Gate 4D.

## Versiones exactas

| Componente | Versión |
|---|---|
| PostgreSQL | 17 (servicio efímero en GitHub Actions) |
| Prisma ORM, @prisma/client, @prisma/adapter-pg | 7.10.1 |
| pg-boss | 12.38.0 |
| Node.js | 22 |
| Gestor de dependencias | npm con package-lock.json |

No hay conexión con infraestructura, repositorios privados ni bases de datos de ClickDialog.

## Cómo reproducir

Un PostgreSQL **local y desechable** debe estar funcionando y `DATABASE_URL` debe señalar `localhost` o `127.0.0.1`.

```bash
export DATABASE_URL='postgresql://acr:acr_test@127.0.0.1:5432/acr_test'
npm ci
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts --accept-data-loss
npm run typecheck
npm run test:contracts
npm run typecheck:gate4d
npm run test:gate4d
```

**Importante:** este experimento emplea `db push` solo para una base desechable de pruebas. No es un plan de migraciones de producción. El código rechaza hosts de base de datos no locales.

## Pruebas ejecutadas

**[CI #41836485254 — PASS: 24 contratos + 9 fiabilidad](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254)**

| # | Prueba | Resultado |
|---|---|---|
| 1 | Execution + Event + pg-boss job en una transacción Prisma `fromPrisma(tx)` | PASS |
| 2 | Rollback de ejecución, evento y job en conjunto | PASS |
| 3 | Ingreso duplicado concurrente produce un solo run/job | PASS |
| 4 | Dos decisiones concurrentes de aprobación: ganador único | PASS |
| 5 | Backlog persiste sin consumidor; un worker separado completa CRM idempotente | PASS |
| 6 | Aprobación + Execution + Event + resume job guardados atómicamente | PASS |
| 7 | Rollback de aprobación-resume no deja comandos huérfanos | PASS |
| 8 | **SIGKILL real** al worker tras reclamar un job, supervisor lo recupera y otro worker aplica una escritura única de CRM local | PASS |
| 9 | Resultado remoto simulado como incierto → `needs_review`; sin replay | PASS |

## Qué concluye la prueba

Con las versiones y configuración examinadas, el adaptador oficial de pg-boss **sí permite publicar trabajos en la misma transacción** que las escrituras Prisma, sin introducir Redis ni un outbox adicional para **ese caso concreto**. Las aprobaciones también pueden almacenar decisión y continuación en un mismo commit.

El monitor de pg-boss recupera el trabajo de un proceso asesinado cuando vence su plazo en una cola de prueba configurada con expiración corta. La aplicación local mantiene idempotencia gracias a claves UNIQUE y comprobaciones de estado.

## Límites de esta evidencia

- El worker del SIGKILL se mata **después de reclamar el job y antes de cualquier efecto**; no simula un éxito HTTP remoto seguido de caída antes de guardar el acuse.
- No prueba exactly-once en APIs externas. Un timeout remoto ambiguo requiere idempotencia del proveedor, consulta de reconciliación o estado `needs_review`.
- El ejemplo de callback no combina el ack de pg-boss y todas las escrituras Prisma bajo una misma *transacción del worker*; pg-boss dispone de transactional worker, cuyo diseño debe evaluarse para pasos cortos en Fase 5.
- No existe todavía API, Workflow Engine completo, dashboard, seguridad de red, multi-tenant comercial, backups de producción ni despliegue real.

**Estado del Gate 4D:** viabilidad técnica demostrada; aceptar formalmente ADR 0003 y límites de recuperación después de revisión. Seguimos con Gate 4E (seguridad) y 4F (UX/operación) antes de construir la aplicación.

Referencias: [documentación de adapters pg-boss](https://pgboss.io/api/adapters), [pg-boss workers](https://pgboss.io/api/workers), [Prisma v7](https://www.prisma.io/docs/orm/v7).
