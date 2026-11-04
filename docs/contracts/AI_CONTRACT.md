# AI Planner Contract
**Status:** proposed · **Gate:** 4C

## Separation of responsibility
The LLM receives sanitized user intent + allowed node manifests and returns **data only**: a `WorkflowDraft` proposal or a typed classification object. It cannot publish, approve, schedule or directly execute effects.

## Interfaces
- `planWorkflow({intent, allowedNodeManifests, limits}) -> {draft, explanations, warnings, providerMetadata}`
- `classifyLead({sanitizedLead, schemaKey}) -> {category, priority, explanation, confidence?}`
- Validation: parse strict JSON against versioned Zod schema; reject unsupported nodes, credentials, URLs, permissions or excessively complex graphs.
- Runtime: rate/usage budget, timeout, cancellation, output-size caps and structured error handling.
- Mock/fixture mode must be visibly labeled; no visitor-provided paid credentials are required.

## Security
Treat webhook contents, CRM data and model output as untrusted. Never let model output grant itself permissions. Avoid sending secrets to LLM; redact PII by policy. Negative tests cover prompt injection and instruction leakage.

## Pending
Exact provider adapter shape, supported languages, token budgets, retryable errors and redaction rules.
