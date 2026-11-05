import {
  DEMO_POLICY, validateWorkflowGraph,
  type Binding, type WorkflowDraft, type WorkflowNode
} from "../../contracts/src/workflow.js";

/**
 * Bounded, side-effect-FREE interpreter for author-created workflow drafts.
 *
 * This is deliberately NOT the persistent worker executor yet. It demonstrates
 * that graph edges/configuration, not hardcoded lead fixture IDs, govern runtime
 * behavior. An external write is reported as an INTENT only, never executed.
 */
export type LabDecision = "approved" | "rejected";
export type LabStatus = "completed" | "waiting_approval" | "cancelled";
export type LabTrace = {
  nodeId: string;
  type: WorkflowNode["type"];
  status: "executed" | "waiting" | "rejected" | "planned";
  branch?: "true" | "false";
  message: string;
};
export type LabActionIntent = {
  kind: "demo_crm.upsert";
  nodeId: string;
  record: { leadId: string; category: string; priority: string };
};
export type LabPreview = {
  mode: "dry_run";
  persisted: false;
  externalEffects: false;
  status: LabStatus;
  trace: LabTrace[];
  nextApproval: { nodeId: string; reason: string } | null;
  plannedActions: LabActionIntent[];
  output: Record<string, unknown> | null;
};
export class LabRuntimeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "LabRuntimeError";
  }
}
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);

function safeResolve(path: string, trigger: Record<string, unknown>,
  steps: Record<string, Record<string, unknown>>): unknown {
  if (!/^\$\.(?:trigger|steps\.[A-Za-z][A-Za-z0-9_-]{0,63})(?:\.[A-Za-z][A-Za-z0-9_]{0,63}){1,6}$/.test(path)) {
    throw new LabRuntimeError("UNSAFE_PATH", "Unsupported binding path");
  }
  const keys = path.slice(2).split(".");
  const root = keys.shift();
  let current: unknown;
  if (root === "trigger") current = trigger;
  else if (root === "steps") current = steps;
  else throw new LabRuntimeError("UNSAFE_PATH", "Unsupported binding root");
  for (const key of keys) {
    if (["__proto__", "constructor", "prototype"].includes(key)) {
      throw new LabRuntimeError("UNSAFE_PATH", "Prototype paths are forbidden");
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      throw new LabRuntimeError("MISSING_INPUT", "Missing input at " + path);
    }
    current = current[key];
  }
  return current;
}
function bind(binding: Binding, trigger: Record<string, unknown>,
  steps: Record<string, Record<string, unknown>>): unknown {
  return binding.kind === "literal" ? binding.value :
    safeResolve(binding.path, trigger, steps);
}
function boundedText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    throw new LabRuntimeError("INVALID_FIELD", field + " must be a nonempty string (max 500 chars)");
  }
  return value;
}
function unsupported(node: WorkflowNode): never {
  throw new LabRuntimeError("UNSUPPORTED_NODE",
    node.type + " is not enabled in the sandbox interpreter");
}
function result(status: LabStatus, trace: LabTrace[], plannedActions: LabActionIntent[],
  output: Record<string, unknown> | null,
  nextApproval: { nodeId: string; reason: string } | null = null): LabPreview {
  return {
    mode: "dry_run", persisted: false, externalEffects: false,
    status, trace, plannedActions, output, nextApproval
  };
}

/**
 * Evaluates the actual author-provided DAG. Nodes have bounded semantics.
 * A decision is requested only at an approval node. A CRM action is a
 * planned intent so the caller cannot mistake a preview for a committed write.
 */
export function previewLabWorkflow(
  proposedGraph: unknown,
  proposedTrigger: unknown,
  approvalDecision?: LabDecision
): LabPreview {
  const validated = validateWorkflowGraph(proposedGraph, DEMO_POLICY);
  if (!validated.ok) {
    throw new LabRuntimeError("INVALID_GRAPH",
      validated.issues.map(issue => issue.code + ": " + issue.message).join("; ").slice(0,1200));
  }
  const graph: WorkflowDraft = validated.draft;
  for (const node of graph.nodes) {
    if (node.type === "ai.classify" || node.type === "http.request") unsupported(node);
  }
  if (!isRecord(proposedTrigger) ||
      JSON.stringify(proposedTrigger).length > 4096) {
    throw new LabRuntimeError("INVALID_INPUT", "Trigger must be a JSON object up to 4096 bytes");
  }
  if (approvalDecision !== undefined &&
      approvalDecision !== "approved" && approvalDecision !== "rejected") {
    throw new LabRuntimeError("INVALID_DECISION", "Unknown approval decision");
  }
  const trigger = structuredClone(proposedTrigger);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const steps: Record<string, Record<string, unknown>> = Object.create(null);
  const trace: LabTrace[] = [];
  const plannedActions: LabActionIntent[] = [];
  let nodeId: string = graph.trigger.nodeId;
  let hops = 0;

  while (++hops <= DEMO_POLICY.maxDepth) {
    const node = nodes.get(nodeId);
    if (!node) throw new LabRuntimeError("BROKEN_GRAPH", "Next node does not exist");
    const outgoing = graph.edges.filter(edge => edge.source === nodeId);
    let branch: "true" | "false" | undefined;
    switch (node.type) {
      case "webhook.trigger":
        steps[node.id] = { received: true };
        trace.push({ nodeId, type: node.type, status: "executed", message: "Input received" });
        break;
      case "compose.template":
        steps[node.id] = { value: node.config.value };
        trace.push({ nodeId, type: node.type, status: "executed", message: "Template evaluated" });
        break;
      case "condition": {
        const left = bind(node.config.left, trigger, steps);
        branch = Object.is(left, node.config.right) ? "true" : "false";
        if (node.config.operator === "neq") branch = branch === "true" ? "false" : "true";
        steps[node.id] = { matched: branch === "true" };
        trace.push({ nodeId, type: node.type, status: "executed", branch,
          message: "Condition selected " + branch + " branch" });
        break;
      }
      case "approval":
        if (approvalDecision === undefined) {
          trace.push({ nodeId, type: node.type, status: "waiting",
            message: "Preview paused: human decision required" });
          return result("waiting_approval", trace, plannedActions, null,
            { nodeId, reason: node.config.reason });
        }
        if (approvalDecision === "rejected") {
          trace.push({ nodeId, type: node.type, status: "rejected",
            message: "Action rejected; no write planned" });
          return result("cancelled", trace, [], null);
        }
        steps[node.id] = { approved: true };
        trace.push({ nodeId, type: node.type, status: "executed",
          message: "Human approval supplied to preview" });
        break;
      case "demo_crm.upsert": {
        const record = {
          leadId: boundedText(bind(node.config.fields.leadId, trigger, steps), "leadId"),
          category: boundedText(bind(node.config.fields.category, trigger, steps), "category"),
          priority: boundedText(bind(node.config.fields.priority, trigger, steps), "priority")
        };
        plannedActions.push({ kind: "demo_crm.upsert", nodeId, record });
        steps[node.id] = { planned: true, ...record };
        trace.push({ nodeId, type: node.type, status: "planned",
          message: "Dry-run ONLY: local CRM write would be requested" });
        break;
      }
      case "finish":
        trace.push({ nodeId, type: node.type, status: "executed", message: "Workflow completed" });
        return result("completed", trace, plannedActions, { finishNodeId: node.id });
      case "ai.classify":
      case "http.request":
        return unsupported(node);
      default: {
        const exhaustive: never = node;
        return exhaustive;
      }
    }
    const selected = node.type === "condition" ?
      outgoing.find(edge => edge.branch === branch) : outgoing[0];
    if (!selected) throw new LabRuntimeError("BROKEN_GRAPH", "Missing next edge");
    nodeId = selected.target;
  }
  throw new LabRuntimeError("STEP_LIMIT", "Sandbox execution exceeded graph depth budget");
}
