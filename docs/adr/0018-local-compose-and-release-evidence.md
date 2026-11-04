# ADR 0018 — Validación local reproducible y evidencia de release

**Estado:** proposed · **Gate:** 4F · **Fecha:** 2026-11-04

## Decisión propuesta

- Mantener monorepo TS con producto futuro en tres procesos: Next.js web, Fastify API, worker durable; PostgreSQL 17 + pg-boss.
- Antes de construir esas aplicaciones, ofrecer únicamente [Compose de verificación](../../ops/compose/validation.yml), con DB efímera y Node para tests de contratos, UX, seguridad y fiabilidad. No crear servicios simulados que aparenten ser el producto.
- Mantener **un solo workflow** GitHub Actions para typecheck, tests, PostgreSQL y sintaxis Compose. Playwright se añadirá cuando haya frontend.
- Salud, backups y recuperación quedan especificados en [Runbook](../operations/DEPLOYMENT_RUNBOOK.md), pero no se declaran probados.
- No lanzar sin [release gates](../quality/RELEASE_GATES.md).

## Alternativas descartadas

Compose ficticio de web/API/worker, integración con infraestructura ClickDialog, jobs CI duplicados, despliegue de worker durable en frontend serverless sin garantía.

## Consecuencias

La verificación local es accesible y de costo limitado. **Config validation no equivale a ejecución integral de Compose ni prueba de despliegue.** El owner decide aceptar o modificar este ADR al cerrar Gate 4F.
