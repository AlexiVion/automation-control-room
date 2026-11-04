# Workflow Schema v1
**Status:** proposed · **Gate:** 4C · **Canonical form:** TypeScript discriminated union / Zod + generated JSON Schema

## Draft example
```json
{ "schemaVersion": 1, "trigger": { "nodeId": "source" }, "nodes": [
  { "id": "source", "type": "webhook.trigger", "config": {} },
  { "id": "classify", "type": "ai.classify", "config": { "schemaKey": "lead-classification-v1" } },
  { "id": "approval", "type": "approval", "config": { "reason": "Review CRM write" } },
  { "id": "crm", "type": "demo_crm.upsert", "config": { "externalKeyPath": "$.lead.id" } },
  { "id": "done", "type": "finish", "config": {} }
 ], "edges": [
  { "id": "e1", "source": "source", "target": "classify" },
  { "id": "e2", "source": "classify", "target": "approval" },
  { "id": "e3", "source": "approval", "target": "crm" },
  { "id": "e4", "source": "crm", "target": "done" }
] }
```

## Supported node types
`webhook.trigger`, `ai.classify`, `condition`, `compose.template`, `approval`, `http.request` (restricted), `demo_crm.upsert`, `finish`. Node kinds carry typed configuration, input/output contracts, effect class and permission requirements.

## Publication validation
Exactly one trigger; unique IDs; existing edge endpoints; acyclic reachable graph; bounded path length/fanout/nodes; allowed node types only; no code interpolation/eval; typed declarative data bindings; required approvals; authorized credential references and outbound destinations; explicit effect classification. A versioned published graph is immutable and has a digest.

## Gate 4C outstanding
Full Zod schemas, error codes, branch semantics, JSON binding path grammar, skipped-node transitions and schema evolution/migrations. The example is a design sketch, **not executable code**.
