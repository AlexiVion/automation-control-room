# ACR — Especificación de experiencia y navegación

> **Versión:** 0.2 · **Estado:** propuesta UX derivada de Gate 4A; el diseño visual definitivo se aprueba en Gate 4F.

## Arquitectura de experiencia

- **Público anónimo:** `/` → `/demo` → inspector de ejecución → aprobación → CRM de demo; sin registro.
- **Operador autenticado:** listado y edición de workflows, publicación, HMAC webhook, LLM opcional configurado en backend y ejecución real.
- Una sola fuente de datos: eventos y estados persistidos por API. Frontend no simula el éxito de un worker.

## Pantalla 1 — Landing (`/`)

Objetivo: una promesa clara, una captura/visual real cuando exista, CTA primario «Probar demo», CTA secundario «Ver código en GitHub». No prometer SaaS comercial listo para usar.

## Pantalla 2 — Demo (`/demo`)

Objetivo: prueba guiada en ~90 segundos bajo ambiente saludable.

Estados:
1. **Sesión iniciando:** obtener workspace efímero y cargar borrador seguro.
2. **Seleccionar caso:** tres leads ficticios con mensaje «No ingreses datos reales».
3. **Simular entrada:** CTA «Simular entrada por webhook», no afirmar webhook HMAC real.
4. **Ejecutando:** canvas con nodo actual, badge visual + texto, elapsed y eventos.
5. **Esperando aprobación:** modal/panel con destino de escritura, payload resumido, botones aprobar/rechazar y expiración.
6. **Completado:** resultado real en CRM, botón «Ver historial» y «Provocar un fallo controlado».
7. **Fallando / reintentando:** mostrar intentos, política y eventos reales; nunca éxito visual sin confirmación de backend.
8. **Sesión expirada / cuota:** explicación con nueva sesión o `429` + `Retry-After`; no perder silenciosamente la confianza del visitante.

La clasificación debe mostrar de forma legible **«Modo demostración: clasificación determinista, sin llamada real a IA»**. El editor de modo operador muestra **«IA real: proveedor configurado»** cuando corresponda.

## Pantalla 3 — Editor (`/workflows/:id`)

- Canvas React Flow: zoom/pan, conexiones tipadas, mover nodos y abrir inspector de propiedades.
- Invitado puede agregar/quitar/reconectar nodos del catálogo **seguro** hasta 12 nodos y 20 conexiones; no se ofrece HTTP externo en demo.
- Validación local para feedback; publicación **siempre** validada nuevamente por API.
- Persistir borrador, publicar snapshot inmutable, mostrar versión activa y advertir de cambios no publicados.
- La generación desde lenguaje natural real solo está disponible al operador con modelo configurado; ejemplos guiados del invitado tienen etiqueta de plantilla.

## Pantalla 4 — Inspector (`/runs/:id`)

- Línea temporal con secuencia, hora, step ID, intento, resultado y duración.
- Reanudar stream por cursor SSE al reconectar, deduplicar eventos en cliente.
- Redacción de inputs/outputs sensibles; verificación de `ActionLedger` cuando corresponda.
- Botones visibles solo si la API concede la operación por estado y permisos.

## Pantalla 5 — Aprobaciones (`/approvals`)

- Mostrar operación propuesta, identificador y versión del workflow, resumen de payload y destino, plazo y actor autorizado.
- Botones Aprobar/Rechazar, acción de una sola decisión; desactivar interacción al enviar, pero confiar solo en la validación atómica de API.

## Pantalla 6 — CRM ficticio (`/demo/crm`)

- Lista y detalle de registros sintéticos que efectivamente existen en PostgreSQL.
- Relación con executionId y ActionLedger; demostrar que un retry no duplicó un registro.
- Datos de otra sesión nunca deben ser visibles.

## Pantalla 7 — Configuración del operador (`/settings`)

- Configuración LLM de servidor, webhook HMAC, allowlist HTTP y trazabilidad.
- No introducir secretos ni consumir créditos del usuario desde la demo pública.

## Accesibilidad y consistencia

Navegación por teclado, controles con nombre accesible, focus states, reduced motion, distinción de estados por texto además de color, responsive mobile para lectura del inspector, carga/errores/quotas accesibles.

## Gate 4F pendiente

Wireframes, tokens visuales, estados de error completos, navegación responsive, copy en otros idiomas, evaluación de accesibilidad y prueba guiada con persona externa.

**Fuentes internas:** [PRD](../product/PRD.md), [escenarios ficticios](../product/DEMO_SCENARIOS.md), [matriz de aceptación](../quality/ACCEPTANCE_TESTS.md).
