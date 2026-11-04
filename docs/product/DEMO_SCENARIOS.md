# ACR — Escenarios demostrativos y datos sintéticos
> **Estado:** propuesta Gate 4A · **Fecha:** 2026-11-04. Ninguna ruta ni flujo está implementado.

## Tres prospectos ficticios

| ID ficticio | Caso | Resultado esperado del clasificador fixture |
|---|---|---|
| `lead_demo_001` | Negocio pequeño solicita automatizar consultas del sitio web; urgencia alta | `priority=high`, `category=automation` |
| `lead_demo_002` | Empresa consulta por desarrollo de panel interno; prioridad media | `priority=medium`, `category=software` |
| `lead_demo_003` | Consulta genérica no relacionada; prioridad baja | `priority=low`, `category=other` |

Los textos y nombres de los casos serán inventados; no utilizar datos, marcas ni conversaciones de clientes de ClickDialog. La fixture define un resultado determinista para cada caso. Ninguna salida de fixture se presentará como respuesta real del modelo.

## Demo: recorrido feliz

1. `/demo` inicia sesión anónima con workspace efímero y CRM vacío.
2. Seleccionar `lead_demo_001`; pulsar **Simular entrada por webhook**. Mostrar `demo.webhook`, no afirmar firma HMAC externa.
3. El backend genera receipt y execution reales en base de datos; el worker procesa pasos.
4. El inspector muestra `ai.classify` como **Demo fixture**, luego `waiting_approval`.
5. Aprobar como propietario de esa sesión después de revisar cambios.
6. Registrar un `DemoCRMRecord` real con clave idempotente; mostrar confirmación y eventos.
7. Refrescar la página y comprobar el mismo resultado persistido.

## Demo: reintento controlado

1. Elegir de nuevo **`lead_demo_001` (prioridad high)** con una nueva entrada sintética (`sourceEventId` diferente generado por la API). Los leads medium/low toman la rama sin aprobación ni CRM.
2. Activar **Simular error transitorio una vez** del conector de CRM **antes** de aplicar el upsert.
3. Aprobar y ver primer intento fallido, reintento seguro y escritura única.
4. Comprobar que el CRM contiene un solo registro de ese evento y eventos coherentes.

## Demo: rechazo

1. Disparar **`lead_demo_001` (prioridad high)** con nuevo `sourceEventId` en un workspace limpio o comparar el estado del CRM previo.
2. Rechazar la aprobación.
3. La ejecución termina como `cancelled` según el contrato propuesto de Gate 4B, **sin realizar una nueva escritura CRM**. Si ya había un registro del mismo lead, su existencia previa no implica un efecto de este run.
4. Una segunda decisión sobre esa aprobación debe rechazarse.

## Modo operador: prueba LLM real (separada)

El operador puede configurar un proveedor de IA en el servidor y usar un prompt libre para generar un borrador validado. El sistema debe mostrar el proveedor/modo y obligar a publicar manualmente; no trasladar claves ni costos a visitantes anónimos.

## Contrato visible de demostración

- Solo un workspace por sesión, acceso limitado por cookie opaca.
- El motor, worker, estado del run, aprobación y CRM son reales; la clasificación de IA es una fixture **explícita**.
- La demo **no** contacta servicios empresariales reales ni hace llamadas pagas a modelos.
- Los botones de simulación inyectan entradas y errores controlados; no son métricas o fallos inventados en frontend.
- Tras 24 h los datos efímeros deben expirar, con cleanup comprobado en integración.

## Rama sin approval (medium/low)

Los prospectos `lead_demo_002` y `lead_demo_003` tienen prioridad medium/low y siguen la rama `false` del workflow canónico: terminan en `finish` sin activar `ApprovalRequest` ni `demo_crm.upsert`. La UI debe mostrar los pasos no recorridos como `skipped`, nunca como error. Para demos de aprobación/rechazo/retry usar **high**.

La API debe generar un identificador de evento distinto para cada entrada simulada nueva y conservarlo para deduplicación. La estructura actual de `POST /demo/events` no permite elegir arbitrariamente ese ID desde el navegador; el fixtureId del lead es distinto de `sourceEventId`.
