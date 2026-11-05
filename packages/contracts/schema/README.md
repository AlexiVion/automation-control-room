# Workflow JSON Schema snapshots

Canonical source: `../src/workflow.ts` using Zod 4.6.7.

Run `npm run contracts:jsonschema` to emit `workflow-draft.v1.schema.json`, and commit the resulting file. The tracked snapshot is part of Gate 4C, and `npm run contracts:check` must pass before claiming that the JSON Schema is versioned and synchronized.

The JSON Schema validates **structure only**. `validateWorkflowGraph` additionally checks DAG semantics, authorization policy and approval adjacency. A JSON Schema match alone is **not** publication permission.
