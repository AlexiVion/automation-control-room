# ACR — AI Planner and classification port

> **Gate 4C · Status:** executable interface candidate, **not** provider implementation.

Canonical [Zod output schemas and TypeScript interface](../../packages/contracts/src/ai.ts).

## Boundary

User text and source webhook fields are untrusted. The LLM never receives write credentials or permission grants and never directly calls connectors, SQL, tools, HTTP or workflow publishing. It returns **data only**; server validates JSON shape, graph semantics, workspace policy and usage budget, then requests explicit human publication.

## Port

```typescript
interface AIPlannerPort {
  plan(request: AIPlanRequest, signal: AbortSignal): Promise<AIPlanResult>;
  classify(input: {sanitizedText:string;schemaKey:"lead-classification-v1";budget:TokenBudget},signal:AbortSignal):
    Promise<{mode:AIMode;classification:Classification}>;
}
```

Structured outputs:

- `ClassificationSchema`: `category=automation|software|other`, `priority=high|medium|low`, `rationale`.
- `PlanProposalSchema`: `{draft: WorkflowDraft, explanation:string, warnings:string[]}`.
- Mode/provenance `deterministic_fixture|provider_live` is assigned by **server**, not trusted from model-generated JSON.
- `TokenBudget`: `maxInputTokens`, `maxOutputTokens`, `timeoutMs`; no unlimited generation.

## Mode policy

| Guest demo | Operator |
|---|---|
| Classification fixture (explicit label) | Optional real provider with server-side configuration |
| Predefined safe templates (not marketed as real LLM) | Text→draft via provider, validated before publishing |
| 0 paid requests | Bounded, audited token usage |
| No provider credential | Secret server-side; never put in frontend |

Provider-specific request/response format remains a replaceable adapter. Any provider output beyond allowed node catalog, with invalid bindings, effects or grant fields is rejected.

## Error and abuse policies

- Model output is never a trusted policy: unexpected node types, URLs, credential references, injected instructions and extra properties fail validation.
- Timeout, malformed output and provider failures return typed errors; no partial publication.
- Logs show trace IDs and **redacted** request metadata, not raw secret/personal text by default.
- Rate limits and token quota are enforced on the server; visitors may not change their mode from fixtures to live via client payload.

**Still pending:** actual adapter, end-to-end prompt-injection tests, live credentials in an isolated operator environment, and proofs of budget enforcement.
