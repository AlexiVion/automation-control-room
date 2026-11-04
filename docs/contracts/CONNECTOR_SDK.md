# ACR — Connector execution port

> **Gate 4C · Status:** typed interface candidate; no connector runtime implemented.

Canonical interfaces: [connectors.ts](../../packages/contracts/src/connectors.ts). Engine commands: [engine.ts](../../packages/contracts/src/engine.ts).

## Design goals

Every connector declares its version, effect class, grants, input/output schemas, timeout, idempotency support and network policy. Runtime resolves permissions and credentials. **No connector may grant itself privileges based on model/user text.**

## Manifest

```typescript
type ConnectorManifest = {
  key: string; version: string;
  effect: "none" | "read" | "write";
  requiredGrants: string[];
  timeoutMs: number;
  idempotency: "transactional" | "provider_key" | "none";
  network: "none" | "restricted_egress";
  inputSchemaId: string; outputSchemaId: string;
};
```

Example: `demo_crm.upsert@1.0.0`, `effect=write`, `idempotency=transactional`, `network=none`, `requiredGrants=["demo_crm.write"]`.

## Port

```typescript
interface ConnectorPort<Input,Output> {
  manifest: ConnectorManifest;
  validateInput(value: unknown): Input;
  validateOutput(value: unknown): Output;
  execute(context: ConnectorContext,input:Input):Promise<ConnectorResult<Output>>;
}
```

Context includes scoped workspace/exec/step IDs, stable `operationKey`, cancel signal, **authorized** HTTP client, secret reference resolver and sanitized trace writer. It must not offer arbitrary DB handles or `fetch(url)`.

## Error taxonomy and retry

- `ok: true` is provider/local confirmed success.
- `kind: definitive` identifies a confirmed failure and whether it is retry-safe.
- `kind: uncertain` means timeout/ack lost/unknown effect; **never auto retry** absent provider-specific reconciliation/idempotency verified by runtime. Mark ledger uncertain and run `needs_review`.
- A stable action key spans retries of the same intended effect; published-version semantics and approval digest must match before dispatch.

## Risk controls

`http.request` only accepts server-owned `destinationKey`, not arbitrary model or workflow URL. Runtime must check DNS, IP, redirects, egress and grants at effect time, not just at draft publish. Guest mode denies this connector entirely.

No plugin marketplace or arbitrary user code in v1. First implement `demo_crm.upsert` with PostgreSQL uniqueness and an intentionally failing fixture; only then consider a real connector.

**Still pending:** real workers, permission/secret integrations, connector-specific error reconciliation, network egress implementation and Gate 4D recovery tests.
