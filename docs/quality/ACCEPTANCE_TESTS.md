# Acceptance and Test Matrix
**Status:** proposed · **Gate:** 4F

## Test hierarchy
TypeScript typecheck/lint; unit tests for schema/engine/policy; PostgreSQL integration tests for transitions and queue; API contract tests; Playwright browser E2E; security and failure-injection cases. Never count mocked UI alone as proof of an effect.

## Required cases
| ID | Acceptance evidence |
|---|---|
| AT-01 | Clean-clone Compose boot with migrations and fixture |
| AT-02 | Invalid DAG is rejected with actionable error |
| AT-03 | Published workflow version is immutable |
| AT-04 | Signed webhook accepted once; duplicate deduplicated |
| AT-05 | Invalid signature and stale replay rejected |
| AT-06 | Execution+enqueue commit together |
| AT-07 | DB transaction rollback leaves neither run nor job |
| AT-08 | Classification returns schema-valid output/fixture labeled |
| AT-09 | Sensitive write waits durably for approval |
| AT-10 | Approval cannot be decided twice or cross-workspace |
| AT-11 | Worker interrupted/restarted resumes safely |
| AT-12 | Connector retries only when verified safe |
| AT-13 | Ambiguous external effect becomes needs_review |
| AT-14 | CRM upsert is idempotent on repeated job |
| AT-15 | SSE resumes from persisted event cursor |
| AT-16 | Restricted HTTP node rejects internal targets and redirects |
| AT-17 | Guest isolation and budgets prevent cross-visitor interference |
| AT-18 | E2E demo shows real persisted run and final CRM record |

## Release gate
Evidence includes command, pinned dependency versions, test environment and result. CI should remain lean: one primary workflow for all critical checks, not redundant concurrent jobs.

## Casos adicionales derivados de Gate 4A

| ID | Test verificable | Gate |
|---|---|---|
| AT-19 | Visitante nuevo inicia workspace independiente sin usuario ni API key | 4A / 4E |
| AT-20 | Cookie `HttpOnly/Secure/SameSite`, expiración por inactividad y absoluto 24h | 4E |
| AT-21 | Workspace de invitado B no puede consultar ni decidir runs, drafts, CRM ni SSE del invitado A | 4E |
| AT-22 | Mutaciones cross-origin/CSRF se rechazan con controles del servidor | 4E |
| AT-23 | Sexta ejecución por sesión/24h, segundo run concurrente y tope global activan backpressure | 4E / 4F |
| AT-24 | Borradores con más de 12 nodos, 20 edges o profundidad 10 se rechazan antes de publicar | 4C |
| AT-25 | Demo pública ejecuta **cero** HTTP externos y **cero** llamadas pagas de LLM | 4E |
| AT-26 | UI rotula la clasificación fixture y el ingreso simulado; no afirma «AI live» | 4F |
| AT-27 | Run real en Postgres; rechazar aprobación no escribe CRM; refresh/reconexión recupera estado real | 4B / 4F |
| AT-28 | Fallo transitorio del CRM antes del efecto crea un evento de retry, pero un solo registro final | 4D |
| AT-29 | Webhook HMAC del operador llega al mismo caso de uso de ingreso validado que la simulación, con autenticación separada | 4C / 4E |
| AT-30 | Cleanup elimina registros efímeros expirados y no filtra secretos/PII en logs | 4E / 4F |

**Nota:** una fixture de clasificación no sustituye el test de proveedor LLM real en el modo operador. Deben existir suites independientes para la interfaz del AI Planner, validación de salida y permisos.

Los escenarios y presupuestos corresponden a propuestas de Gate 4A. No pueden darse por «PASS» hasta tener código, infraestructura y ejecución repetible.

## Gate 4C contract evidence (candidate)

- Structural strict parsing rejects extra keys, malformed node configs and unsupported path expressions.
- Semantic validator accepts the synthetic lead fixture and rejects cycle, join, missing approval, unsafe binding, non-ancestor reference and disallowed HTTP destinations.
- Operator HTTP is permitted only under a server-created allowlist and with an immediately preceding approval.
- AI classification/plan schemas and connector manifest have positive and negative test cases.
- OpenAPI YAML must parse without duplicate mapping keys, have required operations and resolve all local `$ref` components.
- `npm run contracts:jsonschema` generates structural JSON Schema; `npm run contracts:check` verifies the committed snapshot.

**Verified for the isolated contracts:** 24 unit/contract tests and JSON Schema drift check pass [in CI](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254). These **do not** constitute API/worker integration or production deployment tests.

## Gate 4D isolated reliability evidence (2026-11-04)

[CI PASS](https://github.com/AlexiVion/automation-control-room/actions/runs/41836485254): **9 tests against PostgreSQL 17** using pinned Prisma 7.10.1 and pg-boss 12.38.0. Validated: atomic enqueue/rollback, same-source dedup, concurrent approval, atomic approval resume/rollback, backlog recovery, SIGKILL of claimed worker followed by local CRM upsert without duplication, and explicit `needs_review` for an uncertain external result.

This evidence supports the **queue adapter feasibility**, **not** a fully implemented product. Full workflow engine, real webhook-HMAC ingress, waiting approval UX, external HTTP connector, provider reconciliation, SSE, guest isolation and product-level acceptance cases remain unimplemented. Neither exactly-once delivery nor remote side-effect exactly-once is claimed.

## Gate 4E — Security negative-case proof targets

| ID | Verificación aislada | No demuestra |
|---|---|---|
| SEC-01 | HMAC raw body correcta; rechazo tamper, secret incorrecto y timestamp vencido/futuro | Endpoint Fastify + replay DB integral |
| SEC-02 | Token guest hashed, expiración idle/absoluta, cookie HttpOnly/Secure | Navegador/sesión desplegada |
| SEC-03 | Rechazo de CSRF y Origin incorrecto | Endpoint protegido/real cookies |
| SEC-04 | Denegación cross-workspace y de grants operador | Aplicación Prisma real de recursos del producto |
| SEC-05 | AES-256-GCM AAD por workspace, tamper, clave incorrecta y rewrap | KMS y gestión de claves prod |
| SEC-06 | Bloqueo de host/IP privados, metadata, IPv6 y redirects | Socket pinning + TLS SNI + firewall egress |
| SEC-07 | LLM no puede concederse grants, aprobar ni invocar HTTP invitado | Robustez semántica universal ante prompt injection |
| SEC-08 | PostgreSQL impide CRM cross-workspace, reserva de cuota concurrente, sexta run y acceso tras expiración | Cuotas globales/limitación de origen y worker real de cleanup |

La evidencia real se añadirá en [Security Evidence](../security/SECURITY_EVIDENCE.md) después de CI. Todos los requisitos de autorización por workspace, quotas y permisos **deben repetirse en endpoints reales** antes de la demo pública.
