# ACR v1 — Workflow wire format and publication validation

> **Gate 4C · Version 0.3 · State: executable candidate, NOT accepted.**
> Source of truth: [Zod + graph validation](../../packages/contracts/src/workflow.ts).
> Structural JSON Schema is generated from that exact Zod contract. Neither this doc nor OpenAPI replaces graph/policy checks.

## 1. Wire payload

```typescript
type WorkflowDraft = {
  schemaVersion: 1;
  trigger: { nodeId: string };
  nodes: WorkflowNode[];   // discriminated by type
  edges: { id: string; source: string; target: string; branch?: "true" | "false" }[];
};
```

The canonical JSON example is [valid-lead-workflow.json](../../packages/contracts/fixtures/valid-lead-workflow.json).

## 2. Catalog of 8 node types

| Type | Config | Side effect | Required gate |
|---|---|---|---|
| `webhook.trigger` | `sourceKey` | No; ingress authority checked outside graph | Incoming HMAC or demo session |
| `ai.classify` | `schemaKey="lead-classification-v1"`, `input:Binding` | Provider call in operator, deterministic fixture in demo | Model adapter only; no data/model secrets |
| `condition` | `left:Binding`, `operator:eq/neq`, `right:scalar` | No | Exactly two edges labeled `true`, `false` |
| `compose.template` | `value` literal bounded text | No | No code or eval interpolation |
| `approval` | `reason`, `expiresMinutes:1..10` | No; durable pause | Authorized one-time decision |
| `http.request` | `destinationKey`, `method:GET/POST`, `body?:Binding` | Yes, bounded request | Operator only, approved destination, immediately preceding approval |
| `demo_crm.upsert` | `fields:{leadId,category,priority}:Binding` | Yes, local DB upsert | Immediately preceding approval |
| `finish` | Empty config | No | No outgoing edges |

All objects reject unknown properties. Binding scalar means `string | finite number | boolean | null`; a binding is `{"kind":"literal","value": ...}` or `{"kind":"path","path":"..."}`. No arbitrary object literals, scripting, dynamic URL or nested eval.

## 3. Read-only binding grammar

```text
Path       ::= TriggerPath | StepPath
TriggerPath::= "$.trigger." Field ("." Field){0,5}
StepPath   ::= "$.steps." NodeId "." Field ("." Field){0,5}
Field      ::= ASCII_LETTER (ASCII_LETTER | DIGIT | "_")*
NodeId     ::= ASCII_LETTER (ASCII_LETTER | DIGIT | "_" | "-"){0,63}
```

`constructor`, `prototype` and `__proto__` segments are denied by **semantic** validation. Array selectors, wildcards and bracket access are not supported. A referenced step MUST be a predecessor on the unique path to the referencing node; no forward/cross-branch references. The runtime may only read sanitized, typed values using a property-safe resolver; the grammar does **not** permit JS evaluation.

## 4. Publish-time graph invariants

1. Exactly one webhook trigger matching `trigger.nodeId`; no incoming edges to trigger.
2. Unique node IDs and edge IDs; every edge references existing nodes.
3. No directed cycles, unreachable nodes, joins or parallel fanout; every node besides the trigger has exactly one incoming edge.
4. `condition` has **exactly two** outgoing edges (`true` and `false`), selecting one at runtime. Non-condition nodes have exactly one unlabeled edge, except `finish` which has none.
5. At least one finish; non-selected branch is `skipped` in execution ledger (runtime implementation pending).
6. Every `http.request` or `demo_crm.upsert` is **immediately preceded** by an `approval` node.
7. Guest cannot publish `http.request`; operator requires `allowedDestinationKeys` matching a server-side allowlist. Policy is never read from a model or browser request.
8. Demo budget: `nodes<=12`, `edges<=20`, `depth<=10`; operator design budget `32/48/24`. API/runtime have additional quotas from the PRD.
9. Version is immutable after publish, with canonical digest and server-side policy snapshot; persistence not implemented in Gate 4C.

Contract validation: `WorkflowDraftSchema.safeParse(untrusted)` **then** `validateWorkflowGraph(parsedDraft,serverPolicy)`. The schema alone cannot prove graph semantics.

## 5. Error contract

Validation returns `{ok:true,draft}` or `{ok:false,issues:[{code,path,message}]}`. Types in [errors.ts](../../packages/contracts/src/errors.ts), HTTP mapping in [API_ERRORS.md](API_ERRORS.md). Path names, IDs and source snippets must be sanitized before error/log responses.

## 6. Schema evolution

- v1 is a strictly versioned wire type; changing a node config or binding meaning requires a versioned migration and explicit compatibility tests.
- Unknown `schemaVersion` is rejected. No implicit coercion, reinterpretation or mutation of published versions.
- The generator at `packages/contracts/scripts/generate-json-schema.ts` emits a structural JSON Schema snapshot; commit the snapshot after generation and require `contracts:check` before claiming 4C fully passed.

## 7. Contratos DTO de API

[api.ts](../../packages/contracts/src/api.ts) exporta schemas Zod para sesión demo, intake, creación/edición/publicación, versiones, estado de ejecución, eventos de inspector, aprobación, planificación IA y CRM ficticio. [status.ts](../../packages/contracts/src/status.ts) centraliza estados compartidos con el Engine Port. La especificación de transporte es [OpenAPI 3.1](openapi.yaml). Estos DTO validan estructura, **no** autentican, autorizan ni garantizan transacciones.

## 8. Tests and remaining gates

Fixtures: [valid and invalid graph examples](../../packages/contracts/fixtures). Test runner: `npm run typecheck` + `npm run test:contracts`, with one GitHub Actions workflow.

Gate 4C candidate: Zod union, semantic graph checks, typed ports, OpenAPI, tests, generator. **Outstanding:** real green CI evidence, committed up-to-date schema snapshot + lockfile, contract approval, and any fixes after review. Gate 4D separately validates durable worker/DB guarantees.
