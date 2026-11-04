# Gate 4F — Wireframes funcionales (baja fidelidad)

> **Estado: propuesta, no prototipo visual probado.** Estos wireframes son especificaciones textuales para diseñar posteriormente un frontend en React/Next.js. No son pantallas existentes.

## 1. Landing desktop

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Automation Control Room                         [GitHub] [Probar demo]     │
├────────────────────────────────────────────────────────────────────────────┤
│ AUTOMATIZACIONES QUE PODÉS VERIFICAR                                        │
│ Diseñá → Aprobá → Ejecutá → Inspeccioná                                    │
│ Transparencia de cada paso y recuperación de fallos                         │
│ [Probar demo sin cuenta]      [Ver código]                                 │
│ ─────────────────────────────────────────────────────────────────────────  │
│ [Editor de flujo]   [Approval gate]    [Timeline real]                     │
│ Nota: demo con datos ficticios y clasificación determinista etiquetada      │
└────────────────────────────────────────────────────────────────────────────┘
```

No insinuar conectores, empresas clientes o IA real que todavía no existen.

## 2. Demo guiada y ejecución

```text
┌──────────────┬─────────────────────────────────────┬─────────────────────┐
│ Navegación   │ Demo / Ejecución #...               │ Inspector           │
│  • Demo      │ Estado: waiting_approval             │ 01 webhook ✓        │
│  • Workflows │ [Simular lead] [Ver detalle]         │ 02 fixture IA ✓     │
│  • Runs      │                                     │ 03 condición ✓      │
│  • Aprob.    │ [Webhook]──>[IA fixture]──>[Condición]│ 04 aprobación …      │
│  • CRM demo  │                                │    │ Evento #4           │
│              │                        [Approval]──>│ Source: persisted DB│
│              │                           [CRM]     │ [Ver eventos]       │
│              ├─────────────────────────────────────┴─────────────────────┤
│              │ Modo demo · datos ficticios · IA simulada                    │
└──────────────┴───────────────────────────────────────────────────────────┘
```

Solo marcar un nodo como confirmado si lo respalda el estado de `StepExecution` persistido. El dibujo es orientativo: no hay fanout paralelo.

## 3. Editor visual

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Mi workflow · draft rev 3 · public v2     [Validar] [Publicar v3]          │
├─────────────┬────────────────────────────────────────┬─────────────────────┤
│ Paleta      │ Canvas                                 │ Configuración       │
│ Trigger     │ Webhook → IA → Condición                │ Nodo: Condición     │
│ AI classify │                     true ↓   false ↓  │ Input: priority     │
│ Condición   │                   Aprob.     Finish     │ eq "high"           │
│ Template    │                      ↓                 │ Validación: ✓       │
│ Approval    │                 CRM upsert              │                     │
│ Demo CRM    │                      ↓                 │ Errores por campo   │
│ Finish      │                    Finish              │                     │
│ HTTP (🔒)   │                                        │                     │
├─────────────┴────────────────────────────────────────┴─────────────────────┤
│ 0 errores · 7 de 12 nodos · Cambios sin publicar                            │
└────────────────────────────────────────────────────────────────────────────┘
```

HTTP externo no debe poder ejecutarse en la demo aunque se intente modificar el JSON manualmente.

## 4. Aprobación

```text
┌────────────────────────────────────────────┐
│ Aprobación requerida · Espera 07:42        │
│ Acción: demo_crm.upsert                    │
│ Destino: CRM ficticio del workspace       │
│ Lead: lead_demo_001 · Prioridad: high     │
│ Digest: e1d2…a903                        │
│ Motivo: Confirmar alta del lead           │
│ [Rechazar]                  [Aprobar]      │
│ Nota: la aprobación no puede revocarse    │
│ si el efecto ya fue ejecutado.            │
└────────────────────────────────────────────┘
```

No renderizar este panel para las ramas medium/low que finalizan sin aprobación.

## 5. Inspector y error incierto

```text
┌─────────────────────────────────────────────────────────────┐
│ Run #... · v2 · needs_review                                │
│ El resultado del servicio externo es incierto               │
│ No se intentará repetir automáticamente esta escritura       │
├───────────────────────────────┬─────────────────────────────┤
│ Timeline (orden #)            │ Paso seleccionado            │
│ 1. queued                     │ Tipo: http.request           │
│ 2. step.running               │ Intento 1                    │
│ 3. effect.uncertain            │ Código: PROVIDER_UNCERTAIN   │
│ 4. needs_review               │ Payload redactado            │
│ [Releer estado]               │ Operador: revisar            │
└───────────────────────────────┴─────────────────────────────┘
```

Un estado de `needs_review` no tiene botón de retry automático. Los streams SSE se reanudan desde el cursor de eventos y, ante gaps, cargan un snapshot.

## 6. CRM ficticio

```text
┌─────────────────────────────────────────────────────────────┐
│ CRM de demostración · 1 registro confirmado                 │
│ Lead ID         Prioridad  Categoría     Última ejecución    │
│ lead_demo_001   high       automation    #run-...            │
│ [Ver historial del registro]                                 │
│ Al repetir un evento con el mismo lead ID, no duplicar fila  │
└─────────────────────────────────────────────────────────────┘
```

## 7. Mobile (<768 px)

```text
┌──────────────────────────────┐
│ ACR                 [Menú]   │
│ Demo / Run #...               │
│ Status: waiting_approval      │
│                              │
│ Lead demo · prior. alta      │
│ [Simular entrada]             │
│                              │
│ Pasos                         │
│ ✓ Webhook                     │
│ ✓ IA simulada                  │
│ ✓ Condición                    │
│ … Aprobación                   │
│                              │
│ [Abrir aprobación]            │
│ [Ver timeline]                │
│ [Ver CRM]                     │
│                              │
│ Fixture IA · sin costo        │
└──────────────────────────────┘
```

El mobile prioriza realizar y verificar la demo, no replicar un editor denso con precisión engañosa. Aprobaciones y detalles se abren en pantallas/paneles accesibles.

## 8. Estados excepcionales obligatorios

| Estado | Tratamiento UI |
|---|---|
| Error 409 de versión | Mostrar revisión nueva y opción de recarga, no sobrescribir |
| 422 de validación | Ir al nodo/campo con mensaje, conservar draft |
| 429 de cuota | Mostrar límite y Retry-After, deshabilitar nueva ejecución |
| Sesión expirada | Crear nueva sesión explícitamente; datos anteriores no recuperables |
| SSE desconectado | «Sin conexión / sincronizando»; reconciliar snapshot |
| Event gap | No inventar eventos; GET de historial persistido |
| Approval expirada | Leer estado final, no seguir enviando decisiones |
| Runner caído | Estado verificado por API; no mostrar falso completed |
| Efecto incierto | needs_review, revisión humana, no retry genérico |
| Modo fixture | Etiqueta visible permanente «Clasificación determinista» |

**Pendiente de fase 5:** mock visual de alta fidelidad, testeos de teclado/lectores de pantalla y Playwright conectado a API real.
