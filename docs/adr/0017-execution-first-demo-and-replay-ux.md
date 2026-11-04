# ADR 0017 — Demo de ejecución real, UX sin estados inventados

**Estado:** proposed · **Gate:** 4F · **Fecha:** 2026-11-04

## Contexto

El valor del portfolio es que una persona pueda comprobar procesos reales y sus errores, no animaciones ni falsas afirmaciones sobre uso de IA.

## Decisión propuesta

- Demo anónima con datos ficticios; clasificación determinista **visible como simulación**, no inferencia paga.
- Estado UI de run se obtiene de `Execution` persistida; timeline de `ExecutionEvent` con orden, cursor SSE, deduplicación y resync ante huecos.
- Aprobaciones solo mediante respuesta autorizada de API; CRM muestra resultados de PostgreSQL.
- El flujo feliz pretende demostrar valor en ~90 s; no es SLA.
- El lead high `lead_demo_001` dispara approval; usarlo para happy/retry/reject con event IDs distintos. Medium/low terminan sin approval/CRM y muestran branching.
- Nunca convertir HTTP 202 de intake en `completed`.

## Alternativas descartadas

Demo exclusivamente animada sin worker/DB; LLM pago para cada invitado; ilustrar reintentos con lead medium que no alcanza el nodo CRM.

## Consecuencias y límites

Hay que implementar todo el vertical slice para demostrarlo. [UX_SPEC](../ux/UX_SPEC.md) y [wireframes](../ux/WIREFRAMES.md) son diseño, no frontend. Faltan endpoints de listado approval e historial paginado, además de Playwright real.

## Criterio de aprobación

Revisión explícita del propietario más pruebas de proyección de eventos; E2E real y accesibilidad se consideran bloqueos de lanzamiento, no pruebas de este ADR.
