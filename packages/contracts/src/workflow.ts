import { z } from "zod";
import type { ContractIssue } from "./errors.js";

const key = z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/);
const nodeId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const path = z.string().max(160).regex(/^\$(?:\.trigger(?:\.[A-Za-z][A-Za-z0-9_]*){1,6}|\.steps\.[A-Za-z][A-Za-z0-9_-]{0,63}(?:\.[A-Za-z][A-Za-z0-9_]*){1,6})$/);
const literalValue = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
export const BindingSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("literal"), value: literalValue }),
  z.strictObject({ kind: z.literal("path"), path })
]);
export type Binding = z.infer<typeof BindingSchema>;

export const NodeSchema = z.discriminatedUnion("type", [
  z.strictObject({ id: nodeId, type: z.literal("webhook.trigger"),
    config: z.strictObject({ sourceKey: key }) }),
  z.strictObject({ id: nodeId, type: z.literal("ai.classify"),
    config: z.strictObject({ schemaKey: z.literal("lead-classification-v1"), input: BindingSchema }) }),
  z.strictObject({ id: nodeId, type: z.literal("condition"),
    config: z.strictObject({ left: BindingSchema, operator: z.enum(["eq", "neq"]), right: literalValue }) }),
  z.strictObject({ id: nodeId, type: z.literal("compose.template"),
    config: z.strictObject({ value: z.string().max(500) }) }),
  z.strictObject({ id: nodeId, type: z.literal("approval"),
    config: z.strictObject({ reason: z.string().min(3).max(280), expiresMinutes: z.number().int().min(1).max(10) }) }),
  z.strictObject({ id: nodeId, type: z.literal("http.request"),
    config: z.strictObject({ destinationKey: key, method: z.enum(["GET", "POST"]), body: BindingSchema.optional() }) }),
  z.strictObject({ id: nodeId, type: z.literal("demo_crm.upsert"),
    config: z.strictObject({ fields: z.strictObject({
      leadId: BindingSchema, category: BindingSchema, priority: BindingSchema
    }) }) }),
  z.strictObject({ id: nodeId, type: z.literal("finish"), config: z.strictObject({}) })
]);
export type WorkflowNode = z.infer<typeof NodeSchema>;
export const EdgeSchema = z.strictObject({
  id: nodeId, source: nodeId, target: nodeId,
  branch: z.enum(["true", "false"]).optional()
});
export type WorkflowEdge = z.infer<typeof EdgeSchema>;

export const WorkflowDraftSchema = z.strictObject({
  schemaVersion: z.literal(1),
  trigger: z.strictObject({ nodeId }),
  nodes: z.array(NodeSchema).min(2).max(64),
  edges: z.array(EdgeSchema).max(100)
});
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;
export type PublishPolicy = {
  mode: "demo" | "operator";
  maxNodes: number;
  maxEdges: number;
  maxDepth: number;
  allowedDestinationKeys: readonly string[];
};
export const DEMO_POLICY: PublishPolicy = Object.freeze({
  mode: "demo", maxNodes: 12, maxEdges: 20, maxDepth: 10, allowedDestinationKeys: []
});
export const OPERATOR_POLICY: PublishPolicy = Object.freeze({
  mode: "operator", maxNodes: 32, maxEdges: 48, maxDepth: 24, allowedDestinationKeys: []
});
export type GraphValidationResult =
  | { ok: true; draft: WorkflowDraft }
  | { ok: false; issues: ContractIssue[] };

function isUnsafePath(value: string): boolean {
  return value.split(".").some(part => ["constructor", "prototype", "__proto__"].includes(part));
}
function bindingsOf(node: WorkflowNode): Binding[] {
  switch (node.type) {
    case "ai.classify": return [node.config.input];
    case "condition": return [node.config.left];
    case "http.request": return node.config.body ? [node.config.body] : [];
    case "demo_crm.upsert": return Object.values(node.config.fields);
    default: return [];
  }
}
const requiresApproval = (node: WorkflowNode): boolean =>
  node.type === "demo_crm.upsert" || node.type === "http.request";

/**
 * Validates publication semantics, not just JSON shape.
 * No runtime permissions, credential checks, DNS allowlist or side effects happen here.
 */
export function validateWorkflowGraph(input: unknown, policy: PublishPolicy): GraphValidationResult {
  const parsed = WorkflowDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(x => ({
      code: "SCHEMA_INVALID", path: x.path.join("."), message: x.message
    })) };
  }
  const draft = parsed.data;
  const issues: ContractIssue[] = [];
  const push = (code: ContractIssue["code"], path: string, message: string) => {
    issues.push({ code, path, message });
  };
  if (draft.nodes.length > policy.maxNodes || draft.edges.length > policy.maxEdges) {
    push("LIMIT_EXCEEDED", "nodes/edges", "Workflow exceeds publication node/edge budget");
  }
  const byId = new Map(draft.nodes.map(node => [node.id, node]));
  if (byId.size !== draft.nodes.length) push("DUPLICATE_ID", "nodes", "Node IDs must be unique");
  if (new Set(draft.edges.map(edge => edge.id)).size !== draft.edges.length) {
    push("DUPLICATE_ID", "edges", "Edge IDs must be unique");
  }
  const triggers = draft.nodes.filter(node => node.type === "webhook.trigger");
  if (triggers.length !== 1 || triggers[0]?.id !== draft.trigger.nodeId) {
    push("INVALID_TRIGGER", "trigger", "Exactly one webhook trigger must match trigger.nodeId");
  }
  const outgoing = new Map<string, WorkflowEdge[]>();
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const node of draft.nodes) { outgoing.set(node.id, []); incoming.set(node.id, []); }
  for (const [i, edge] of draft.edges.entries()) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      push("EDGE_MISSING_NODE", `edges.${i}`, "Edge must refer to existing nodes");
      continue;
    }
    outgoing.get(edge.source)!.push(edge);
    incoming.get(edge.target)!.push(edge);
  }
  if (!draft.nodes.some(node => node.type === "finish")) {
    push("MISSING_FINISH", "nodes", "At least one finish node is required");
  }
  for (const node of draft.nodes) {
    const outs = outgoing.get(node.id)!;
    const ins = incoming.get(node.id)!;
    if (node.type === "webhook.trigger" && ins.length !== 0) {
      push("INVALID_DEGREE", node.id, "Trigger cannot have incoming edges");
    } else if (node.type !== "webhook.trigger" && ins.length !== 1) {
      push("INVALID_DEGREE", node.id, "Each non-trigger node must have exactly one predecessor (no joins)");
    }
    if (node.type === "condition") {
      if (outs.length !== 2 || new Set(outs.map(edge => edge.branch)).size !== 2 ||
          !outs.some(edge => edge.branch === "true") || !outs.some(edge => edge.branch === "false")) {
        push("INVALID_BRANCH", node.id, "Condition must have true and false outgoing edges");
      }
    } else if (node.type === "finish") {
      if (outs.length !== 0) push("INVALID_DEGREE", node.id, "Finish cannot have outgoing edges");
    } else if (outs.length !== 1 || outs[0]?.branch !== undefined) {
      push("INVALID_DEGREE", node.id, "Non-condition node must have one unlabeled outgoing edge");
    }
    if (requiresApproval(node) && (ins.length !== 1 || byId.get(ins[0]!.source)?.type !== "approval")) {
      push("APPROVAL_REQUIRED", node.id, "An effectful connector requires an immediately preceding approval node");
    }
    if (node.type === "http.request") {
      if (policy.mode === "demo" || !policy.allowedDestinationKeys.includes(node.config.destinationKey)) {
        push("FORBIDDEN_CONNECTOR", node.id, "HTTP connector destination is not allowed by the publish policy");
      }
    }
    for (const binding of bindingsOf(node)) {
      if (binding.kind !== "path") continue;
      if (isUnsafePath(binding.path)) {
        push("UNSAFE_BINDING", node.id, "Binding must never reference prototype/constructor");
      }
      const referenced = /^\$\.steps\.([A-Za-z][A-Za-z0-9_-]*)\./.exec(binding.path)?.[1];
      if (referenced) {
        const ancestors = new Set<string>();
        let parent = ins[0]?.source;
        while (parent && !ancestors.has(parent)) {
          ancestors.add(parent);
          parent = incoming.get(parent)?.[0]?.source;
        }
        if (!ancestors.has(referenced)) {
          push("INVALID_BINDING_SOURCE", node.id, `Referenced step ${referenced} must be an ancestor`);
        }
      }
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const visit = (id: string, depth: number): void => {
    if (active.has(id)) { push("CYCLE", id, "Workflow cycles are not allowed"); return; }
    if (visited.has(id)) return;
    visited.add(id);
    if (depth > policy.maxDepth) push("DEPTH_EXCEEDED", id, "Maximum path length exceeded");
    active.add(id);
    for (const edge of outgoing.get(id) ?? []) visit(edge.target, depth + 1);
    active.delete(id);
  };
  // Inspect all components so cycles in disconnected graphs cannot be hidden.
  for (const id of byId.keys()) visit(id, 1);
  visited.clear();
  const reachable = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of outgoing.get(id) ?? []) reachable(edge.target);
  };
  if (byId.has(draft.trigger.nodeId)) reachable(draft.trigger.nodeId);
  for (const id of byId.keys()) {
    if (!visited.has(id)) push("UNREACHABLE", id, "Node is unreachable from trigger");
  }
  // Check selected branch endpoints must be finish; shape+degree guarantee termination if acyclic.
  return issues.length ? { ok: false, issues } : { ok: true, draft };
}
