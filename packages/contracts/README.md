# Executable contracts — Gate 4C

**Status:** implementation candidate, pending CI/runtime validation and owner review. **Not** a functional API or worker.

This package defines the **data wire format** in Zod v4, validates graph semantics, and exports port interfaces for a future API/worker. Its schemas are intentionally bounded and reject unknown fields.

## Local commands

```sh
npm install
npm run typecheck
npm run test:contracts
npm run contracts:jsonschema
npm run contracts:check
```

`workflow.v1.schema.json` is emitted by the generator from Zod. **The generated JSON Schema captures structure, not graph-wide invariants**; consumers MUST also call `validateWorkflowGraph` before publication. Do not assume generated schema proves DAG validity or authorization.

## Compatibility contract

- `schemaVersion: 1`; new versions require explicit migrations.
- Workflow nodes: webhook.trigger, ai.classify, condition, compose.template, approval, http.request, demo_crm.upsert, finish.
- Read-only binding grammar: `$.trigger.<field>[.<field>...]` or `$.steps.<nodeId>.<field>[.<field>...]`. No wildcards, arrays, evaluation or prototype access.
- Sequential DAG, exclusive conditional branches, no joins/parallel/cycles; effectful nodes require an immediately preceding approval.
- HTTP uses a `destinationKey`, never an arbitrary URL in graph content. Authorization and egress protection remain runtime obligations.

API document: [OpenAPI 3.1](../../docs/contracts/openapi.yaml). Human-readable specification: [Workflow](../../docs/contracts/WORKFLOW_SCHEMA.md).
