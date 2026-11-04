# Automation Control Room — Product Requirements Document (PRD)

> **Versión:** 0.2 · **Fase:** 4A — Product Definition · **Estado:** propuesta detallada para revisión, **NO aprobada** · **Fecha:** 2026-11-04
>
> Este documento sustituye el alcance exploratorio del PRD inicial. No implica que la aplicación esté implementada ni que se haya publicado un servicio.

## 1. Resumen ejecutivo

**Automation Control Room (ACR)** será una plataforma open source de automatizaciones empresariales que permita definir workflows visualmente o proponerlos con lenguaje natural, publicarlos con validación estricta, ejecutarlos con workers independientes y observar cada paso mediante eventos duraderos.

La promesa de producto no es «un clon de n8n con cientos de conectores». Es **crear, aprobar, ejecutar e inspeccionar un proceso empresarial real de extremo a extremo**, de manera que se entienda tanto la experiencia de usuario como la ingeniería que lo hace fiable.

**Objetivo principal:** demostrar desarrollo Full Stack, APIs, orquestación durable, integraciones, seguridad y LLM en un portfolio público verificable. **Objetivo secundario opcional:** permitir en el futuro una edición administrada por ClickDialog sin dependencia obligatoria del código comunitario.

## 2. Problema, público objetivo y valor diferencial

### 2.1 Problema

Una automatización asistida por IA puede producir un plan atractivo sin mostrar qué acciones se realizarán, cuáles requieren autorización, cómo se recuperan los errores o qué datos se modificaron realmente. Los evaluadores técnicos necesitan evidencia, no animaciones.

### 2.2 Público objetivo y escenario

| Persona | Necesidad | Acceso en MVP |
|---|---|---|
| Visitante/reclutador técnico | Probar la aplicación inmediatamente, ver actividad real y reproducir fallos controlados | **Demo pública anónima**, sin cuenta ni tarjeta |
| Desarrollador que clona el repositorio | Instalar y ejecutar motor, API, frontend, pruebas y un workflow reproducible | **Self-hosted local**, con operador configurado |
| Operador técnico del proyecto | Editar/publicar workflows, firmar webhooks y configurar un LLM opcional | **Modo operador**, autenticado |
| Cliente SaaS comercial | Suscripciones, cuotas de pago, organizaciones y soporte | **Fuera del MVP** |

### 2.3 Diferenciadores medibles

- Un mismo `WorkflowDraft` tipado, tanto si se crea en el editor visual como mediante un AI Planner.
- Cada ejecución utiliza un `WorkflowVersion` publicado e inmutable.
- El navegador muestra estados **persistidos y verificables** en API/base de datos; no inventa ejecuciones.
- Las acciones sensibles exigen aprobación duradera; la IA no puede otorgarse permisos.
- Ante resultados externos ambiguos, se declara `needs_review` en lugar de repetir la operación ciegamente.
- La demo pública no requiere claves de IA ni permite efectos sobre sistemas externos.

## 3. Dos modos de uso: decisión candidata 4A

| Capacidad | Demo pública anónima | Self-hosted operador |
|---|---|---|
| Registro de usuario | **No** | Cuenta de operador local/configurada |
| Workflow editable | Sí, sobre catálogo limitado | Sí, catálogo MVP completo |
| Crear/editar/publicar versiones | Sí, dentro del espacio de demo efímero | Sí, guardado persistente |
| Ejecuciones en workers reales | Sí | Sí |
| Persistencia real en PostgreSQL | Sí, aislada/temporal | Sí |
| Clasificación IA | **Fixture determinista con etiqueta visible** | LLM real opcional, configurado del lado servidor; fixture como respaldo explícito |
| Planner de lenguaje natural | Solo ejemplos predefinidos con salida de demo etiquetada; **no presentarlos como IA real** | Texto libre → LLM → draft validado; sujeto a presupuesto |
| Aprobación humana | Visitante dueño de su sesión de demo | Usuario autorizado |
| CRM | Solo CRM de demostración con datos ficticios | CRM de demostración |
| HTTP externo | Deshabilitado | Solo destino permitido por política y autorización |
| Secrets / credenciales | Ninguna de proveedores | Solo servidor, nunca expuestas al cliente |
| Facturación | No | No |

**Motivo:** la experiencia pública debe ser gratuita, segura y demostrable sin costo variable por visitante. La capacidad LLM real seguirá disponible para demostrarla con cuenta de operador y proveedor configurado. No se mezclan ambos modos ni se induce a creer que una fixture es una respuesta genuina de IA.

## 4. Demo pública: aislamiento, retención y protección de recursos

### 4.1 Modelo de sesión y autorización

- Al abrir la demo, la API crea un **workspace efímero por sesión** (nunca globalmente compartido) y una cookie de sesión opaca, `HttpOnly`, `Secure` en HTTPS y `SameSite=Lax`.
- La sesión es una **capacidad limitada al workspace efímero**; se generan IDs impredecibles, se valida el alcance en servidor en cada solicitud y el navegador nunca decide permisos por parámetros suministrados.
- Expiración por inactividad: **30 minutos**; límite absoluto: **24 horas**; el workspace, runs, borradores, aprobaciones y CRM de demo se purgan automáticamente a las 24 horas o antes por política de limpieza.
- Cada nueva sesión recibe datos **ficticios independientes**. No se permiten importaciones de bases externas ni se solicita información personal real; la interfaz advierte no introducirla.
- Un proceso de limpieza elimina datos expirados y registros asociados; evitar conservar textos de leads más allá de la sesión. Métricas agregadas sin contenido pueden tener política de retención separada.
- Este esquema exige controles específicos de CSRF para endpoints mutables, validación del `Origin` y rate limiting: una cookie no constituye autorización para datos de otras sesiones.

### 4.2 Presupuestos de demo — límites iniciales propuestos

| Recurso | Límite | Resultado al exceder |
|---|---:|---|
| Workspaces efímeros | 1 por sesión | Reusar el actual / renovar al expirar |
| Workflows borrador | 1 activo por sesión | Reemplazar o borrar el existente |
| Versiones publicadas | 5 por sesión | Rechazar nueva publicación hasta borrar/expirar |
| Nodos por workflow | 12 | Error de validación antes de publicar |
| Conexiones por workflow | 20 | Error de validación |
| Longitud del camino (profundidad) | 10 | Error de validación |
| Ejecuciones iniciadas | 5 por sesión / 24 h | `429` con motivo y `Retry-After` |
| Ejecuciones activas | 1 por sesión | `409` / bloqueo de nuevo inicio |
| Concurrencia pública global | 4 ejecuciones activas | Cola limitada o `429` con backpressure |
| Duración de ejecución activa | 90 s, excluyendo espera de aprobación | Terminar con fallo/timeout auditable |
| Tiempo máximo por paso | 10 s | Timeout con error tipado |
| Espera máxima de aprobación | 10 min | Expirar solicitud y cancelar run según política |
| Reintentos automáticos | Hasta 2 adicionales **solo** si son seguros | Error o `needs_review` según semántica |
| LLM de pago en demo pública | **0 solicitudes** | No disponible |

**Estos son presupuestos de producto, no garantías implementadas.** El límite global y el ritmo de creación de sesiones requieren controles del lado servidor y pruebas de abuso; se ajustarán según resultados de carga y recursos del hosting antes de abrir una demo pública. Se podrá aplicar una cuota adicional por origen/red y mecanismos antiabuso sin usar la IP como identidad del workspace.

## 5. Escenario de valor principal — procesamiento de prospectos

**Workflow demostrativo:** consulta entrante → clasificación → condición → aprobación → CRM ficticio → auditoría.

1. Visitante abre `/demo`, inicia su sesión aislada y ve un workflow precargado.
2. Selecciona uno de tres prospectos **ficticios** o modifica únicamente campos de demostración permitidos.
3. Pulsa **«Simular entrada por webhook»**. El navegador llama a una API autenticada por sesión, que utiliza el **mismo servicio de ingreso de eventos** que el endpoint HMAC real del operador. La UI debe identificarlo como **entrada simulada**, no como webhook externo firmado.
4. Se persiste un `WebhookReceipt`, una `Execution` y el trabajo durable. El worker procesa pasos del workflow realmente, sin depender del navegador.
5. El nodo `ai.classify` en demo devuelve una **fixture de clasificación señalizada**; en modo operador puede invocar un LLM auténtico si está habilitado.
6. Una condición determina prioridad y prepara una acción de `demo_crm.upsert`.
7. La ejecución queda en estado `waiting_approval`; el visitante revisa un resumen de la acción y **aprueba o rechaza** en su propia sesión.
8. El worker reanuda, escribe realmente en la base de datos del CRM de demo y registra eventos, estados y resultados.
9. El inspector permite comprobar el `CRMRecord` persistido, duración, cantidad de intentos y la historia del run.
10. En una segunda ejecución, el usuario activa **«simular fallo transitorio una vez»** del conector de CRM, observa el evento de error y su reintento seguro, y confirma que **no se duplicó** el registro.

**Guion objetivo:** flujo feliz visible y comprensible en alrededor de **90 segundos** bajo condiciones de servicio saludables; no es un SLA de ejecución garantizado. El caso de recuperación puede demostrarse por separado.

### 5.1 Ingreso por webhook real

En modo operador existe un endpoint distinto de webhook con **firma HMAC, timestamp y event ID**. Rechaza firmas inválidas, eventos expirados y duplicados; no deriva privilegios de la carga del webhook. Comparte la lógica de ingreso validada pero no utiliza la sesión anónima para autenticar fuentes externas.

### 5.2 Prueba de realidad

El botón de la demo no podrá activar únicamente una animación. Sus resultados deben quedar en PostgreSQL y poder recuperarse con API de consulta. Si el worker cae, el estado y los eventos persisten, y el reintento respeta la semántica de los efectos. Si el navegador se desconecta, una reconexión del inspector recupera eventos vía cursor.

## 6. Alcance funcional de MVP

| ID | Requisito | Prioridad | Verificación |
|---|---|---|---|
| FR-01 | Landing pública y demo sin registro | Must | Browser E2E con sesión nueva |
| FR-02 | Workspace de demo aislado y efímero | Must | Test intersesión y cleanup |
| FR-03 | Edición visual con nodos tipados y validación de grafo | Must | Publicar/rechazar dos grafos |
| FR-04 | Versiones publicadas e inmutables | Must | Cambiar draft sin alterar run |
| FR-05 | Entrada demo y webhook operador HMAC | Must | Test de firma y deduplicación |
| FR-06 | Worker independiente y ejecución durable | Must | Crash/restart con DB real |
| FR-07 | Clasificación fixture explícita + proveedor LLM configurable para operador | Must | Verificación de modo en UI y logs |
| FR-08 | Aprobación duradera con expiración y control de autorización | Must | Crash, dos clicks, rechazo y expiración |
| FR-09 | Demo CRM real, aislado y upsert idempotente | Must | Un registro tras reintento |
| FR-10 | Inspector de nodos y eventos, SSE con replay | Must | Reconexión y eventos persistidos |
| FR-11 | Inyección controlada de fallo transitorio | Must | Evento de retry observable |
| FR-12 | Planner LLM de texto libre → draft validado, operador | Must | Schema válido y rechazo de efectos peligrosos |
| FR-13 | Catálogo de ocho nodos tipados, con HTTP restringido solo operador | Must | Matriz de nodo/config/permisos |
| FR-14 | Instalación local Docker Compose + documentación | Must | Clean clone con datos ficticios |
| FR-15 | Seguridad, pruebas e infraestructura independientes | Must | Pruebas negativas + no dependencia ClickDialog |
| FR-16 | Exportar workflow (JSON validado, sin secretos) | Should | Roundtrip export/import sin credenciales |
| FR-17 | Historial visual de versiones y diff | Could | No bloquea release inicial |

**Tipos de nodos:** `webhook.trigger`, `ai.classify`, `condition`, `compose.template`, `approval`, `http.request` (solo operador y destinos permitidos), `demo_crm.upsert`, `finish`. El contrato exacto de ramificación y bindings se define en Gate 4C.

### 6.1 Editor de MVP, sin ambigüedad

- Canvas con zoom/pan, selección y arrastre de nodos; agregar/quitar nodos de catálogo disponible, conectar nodos, inspector lateral de propiedades.
- Validación local informativa y **validación definitiva del backend al publicar**.
- Puede editarse un borrador; publicar crea una nueva versión inmutable. En ejecución, solo se admite consulta y acciones controladas de aprobación/cancelación.
- No habrá scripting arbitrario, loops, subworkflows, marketplace, importación de plugins de terceros, colaboración multiusuario en tiempo real ni conexiones de cuentas de proveedores externas en el modo demo.
- Natural language → workflow solo en modo operador con LLM real configurado; ejemplos guiados sin LLM solo en modo demo y **etiquetados como plantilla/fixture**.

## 7. Pantallas y navegación de MVP

| Ruta conceptual | Función principal | Acción importante |
|---|---|---|
| `/` | Presentar proyecto y demo | «Probar demo» |
| `/demo` | Ejecución guiada con datos ficticios | «Simular consulta» |
| `/workflows/:id` | Canvas y propiedades, validación, publicación | «Publicar versión» |
| `/runs/:id` | Inspector de ejecución/eventos y errores | «Examinar paso» |
| `/approvals` | Revisar acción pendiente | «Aprobar / rechazar» |
| `/demo/crm` | CRM ficticio y historial | «Ver registro» |
| `/settings` | Solo operador: LLM, webhooks, destinos permitidos | «Configurar integración» |

Las rutas son propuestas de experiencia, **no endpoints ni rutas implementadas**. Los detalles de responsive, accesibilidad, estados vacíos, loading y fallos se completan en Gate 4F.

## 8. Requisitos no funcionales y restricciones

- **Reproducibilidad:** `docker compose up --build` y migraciones/seed automatizados en entorno limpio, sin secretos de terceros para el flujo fixture.
- **Correctitud:** estado y eventos derivan de PostgreSQL; worker no depende del proceso web.
- **Fiabilidad:** colas at-least-once, idempotencia por conector y revisión explícita ante resultado incierto. No prometer «exactly once» de integraciones externas.
- **Seguridad:** auth y autorización por workspace en backend; protección CSRF; HMAC para webhooks; validaciones estructurales de LLM; allowlist+egress para HTTP; secretos cifrados/redactados.
- **Privacidad:** demo con datos ficticios y TTL. No recopilar datos reales por diseño. No reutilizar bases ni credenciales de ClickDialog.
- **Observabilidad:** secuencia ordenada de eventos, trace IDs y reanudación SSE tras desconexión.
- **Accesibilidad:** teclado, contraste, estados no dependientes solo del color, reduced motion y lectura móvil del inspector.
- **Calidad:** TypeScript estricto, pruebas unitarias, integración PostgreSQL real, Playwright E2E y validaciones de seguridad.
- **Despliegue:** monorepo con procesos web, API y worker independientes; hosting elegido en Gate 4F. La demo pública no puede depender de Vercel para ejecutar workers persistentes.

## 9. Métricas para aprobar MVP, no promesas operativas

| Métrica | Objetivo verificable de aceptación |
|---|---|
| Instalación | Nuevo checkout levanta servicios y fixture sin configuración externa de IA |
| Experiencia | Una persona externa completa el flujo feliz desde el navegador sin cuenta |
| Persistencia | Cada acción visible tiene un estado/evento consultable después de refrescar la página |
| Idempotencia | Webhook repetido y reintento de CRM no generan duplicados |
| Recuperación | Kill/restart de worker no pierde ejecuciones pendientes ni aprobaciones |
| Seguridad | Ninguna sesión puede consultar el CRM/runs de otra; no salen peticiones a destinos privados |
| Claridad IA | «Fixture de demo» se distingue visualmente de «LLM real» |
| Calidad | Pasan todos los casos obligatorios de la matriz de aceptación |
| Tiempo UX | Guion feliz idealmente <=90 s en ambiente sano, medido y no fingido |

Los resultados se documentarán con versiones de dependencias, comandos y evidencia. Estos objetivos aún no están verificados.

## 10. Dependencias entre fases y alcance futuro

**Gate 4A** fija el **qué** y los límites de la demo; **Gate 4B** define estados y modelo; **Gate 4C** concreta schemas y contratos; **4D** valida semántica transaccional de cola y recuperación; **4E** los controles de seguridad; **4F** wireframes, operación y pruebas. **Fase 5** implementa cortes verticales verificables.

### Fuera del MVP (no crear tickets hasta aceptación del MVP)

- Mercado Pago, suscripciones, pricing, comisiones, límites de planes comerciales.
- Plataforma alojada multiempresa con facturación, invitaciones y roles complejos.
- Directorio amplio de conectores, plugins externos o OAuth a cientos de servicios.
- Ejecución de código arbitrario de usuarios, contenedores sandbox de código externo.
- Agentes autónomos con acceso irrestricto a herramientas, navegación o ejecución de comandos.
- Integración o migración a infraestructura, DB, APIs privadas o clientes de ClickDialog.
- Escalamiento multi-región, alta disponibilidad empresarial y garantías SLA.

## 11. Decisions register / bloqueos restantes

| Decisión | Propuesta en este PRD | Estado |
|---|---|---|
| Modo público | Workspace efímero por sesión con cookie opaca | **Para revisión 4A** |
| IA pública | Fixture etiquetada, 0 llamadas pagas | **Para revisión 4A** |
| IA operador | LLM opcional real vía adaptador servidor | **Para revisión 4A** |
| Presupuestos | Tabla §4.2 | **Para revisión 4A** |
| Editor invitado | Catálogo seguro, 12 nodos, draft propio | **Para revisión 4A** |
| Efectos demo | Solo CRM ficticio, sin HTTP externo | **Para revisión 4A** |
| Producto comercial | Fuera del MVP, core autónomo | **Ya es la dirección acordada; no comercializado** |

El Gate 4A solo se marca aprobado cuando el propietario acepta los límites concretos, se actualiza el issue #2 y el PR registra la decisión. Implementación y validación de seguridad siguen pendientes de los gates posteriores.
