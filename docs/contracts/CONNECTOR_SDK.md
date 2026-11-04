# Connector SDK Contract
**Status:** proposed · **Gate:** 4C

## Principles
Built-in TypeScript connectors implement a typed, versioned manifest and a bounded effect interface. The workflow engine depends on the contract, not implementation modules.

## Manifest
`key`, `version`, `effectType` (`read`/`write`), `inputSchema`, `outputSchema`, `requiredGrants`, `timeoutMs`, `idempotencySupport`, `networkPolicy`. Manifest metadata must be deterministic and inspectable in editor and policy engine.

## Execution interface
`execute(context, typedInput) -> typedOutput` where context provides workspace-scoped secret access, abort signal, logger, idempotency key, HTTP transport with egress controls and trace ID. Connector never receives unrestricted database access.

## MVP connectors
`webhook.trigger` (inbound), `ai.classify` (provider adapter), `demo_crm.upsert` (idempotent fixture), `http.request` (allowlist-only), `compose.template` (pure transform). Approval/condition/finish belong to engine semantics, not third-party SDK.

## Recovery
Every mutating connector specifies whether retries are safe. Absent verified idempotency/reconciliation, ambiguous outcomes transition to `needs_review`. Exceptions must be typed and logs redacted.

## Deferred
Public plug-in marketplace, sandboxed arbitrary user modules, third-party package execution, OAuth provider catalog.
