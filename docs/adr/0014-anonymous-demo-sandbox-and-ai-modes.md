# ADR 0014 — Demo pública aislada, modos IA explícitos y cuotas

**Status:** proposed · **Date:** 2026-11-04 · **Gate:** 4A

## Contexto

La primera audiencia será un reclutador técnico sin cuenta, créditos de IA ni API keys. El sistema deberá demostrar estados persistidos, sin permitir acceso a sistemas reales ni comprometer la estabilidad del servidor.

## Alternativas evaluadas

1. **Workspace global compartido con datos reiniciables:** menor complejidad, pero riesgo de interferencia y exposición entre visitantes; descartado.
2. **Cuenta obligatoria para cada visitante:** simplifica algunos permisos, pero introduce fricción y dificulta una demo de 90 segundos; descartado para público.
3. **Workspace efímero por sesión con recursos limitados:** más trabajo de lifecycle y cuotas; **propuesta elegida**.
4. **LLM real para invitados:** demuestra IA directamente, pero introduce gasto variable, abuso y transmisión de inputs arbitrarios; descartado en MVP.
5. **Fixture determinista explícitamente etiquetada:** reproducible sin API key; elegida para invitados, con LLM auténtico disponible únicamente para operador configurado.

## Decisión propuesta

- Sesión anónima con cookie opaca `HttpOnly/Secure/SameSite=Lax`, workspace propio, expiración 30 min de inactividad y absoluta 24 h, limpieza a más tardar 24 h.
- Acceso al demo CRM, drafts, approvals, events y runs filtrado siempre por scope de sesión validado en servidor.
- Cuotas iniciales: 1 borrador, 5 versiones, máximo 12 nodos/20 edges/profundidad 10, 5 ejecuciones por sesión/24h, 1 activa/sesión, 4 ejecuciones guest globales.
- 90 s de procesamiento activo y 10 min de espera de aprobación. Intentos HTTP externos prohibidos al visitante; sin llamadas de IA pagas.
- Fixture de clasificación y sugerencias guiadas de flujo etiquetadas como demo. LLM real solo para operadores y mediante adaptador servidor con control de presupuesto.
- Webhook demo y webhook HMAC operador son entradas distintas que convergen en la **misma lógica de creación de ejecución validada**.

## Consecuencias

No se garantiza una experiencia pública ilimitada; habrá backpressure y cleanup. Hay que implementar CSRF/origin checks, límites de creación de sesiones y autorización por workspace antes de abrir la demo pública. La fixture no demuestra ejecución del proveedor IA; esta capacidad se verifica separadamente en modo operador.

## Criterio de aceptación

Gate 4A: aprobar experiencia y presupuestos. Gates 4E/4F: tests de aislamiento cruzado, expiración, cuotas, firma HMAC, no egress y rotulación inequívoca de fixture. El ADR permanece **proposed** hasta esa aprobación.

**Referencias:** [PRD](../product/PRD.md), [escenarios](../product/DEMO_SCENARIOS.md), [seguridad](../security/THREAT_MODEL.md).
