import { describe, expect, it } from "vitest";
import { previewLabWorkflow, LabRuntimeError } from "../src/lab-interpreter.js";
import { validateWorkflowGraph, DEMO_POLICY } from "../../contracts/src/workflow.js";

const path = (value: string) => ({ kind: "path" as const, path: value });
const literal = (value: string) => ({ kind: "literal" as const, value });

/** Two author-created DAGs, no fixture IDs or hardcoded worker node names. */
const inquiries = {
  schemaVersion: 1 as const, trigger: { nodeId: "incoming" },
  nodes: [
    { id: "incoming", type: "webhook.trigger" as const, config: { sourceKey: "lab.local" } },
    { id: "important", type: "condition" as const,
      config: { left: path("$.trigger.priority"), operator: "eq" as const, right: "high" } },
    { id: "review", type: "approval" as const,
      config: { reason: "Confirm local request record", expiresMinutes: 10 } },
    { id: "write", type: "demo_crm.upsert" as const, config: {
      fields: { leadId: path("$.trigger.id"), category: literal("automation"), priority: path("$.trigger.priority") }
    } },
    { id: "saved", type: "finish" as const, config: {} },
    { id: "skipped", type: "finish" as const, config: {} }
  ],
  edges: [
    { id: "incoming_to_important", source: "incoming", target: "important" },
    { id: "important_yes", source: "important", target: "review", branch: "true" as const },
    { id: "important_no", source: "important", target: "skipped", branch: "false" as const },
    { id: "review_to_write", source: "review", target: "write" },
    { id: "write_to_saved", source: "write", target: "saved" }
  ]
};
const support = {
  schemaVersion: 1 as const, trigger: { nodeId: "request" },
  nodes: [
    { id: "request", type: "webhook.trigger" as const, config: { sourceKey: "lab.support" } },
    { id: "tag", type: "compose.template" as const, config: { value: "hold" } },
    { id: "route", type: "condition" as const,
      config: { left: path("$.steps.tag.value"), operator: "eq" as const, right: "go" } },
    { id: "supervisor", type: "approval" as const,
      config: { reason: "Confirm support escalation", expiresMinutes: 5 } },
    { id: "ticket", type: "demo_crm.upsert" as const, config: {
      fields: { leadId: path("$.trigger.id"), category: literal("support"), priority: literal("medium") }
    } },
    { id: "escalated", type: "finish" as const, config: {} },
    { id: "ordinary", type: "finish" as const, config: {} }
  ],
  edges: [
    { id: "request_tag", source: "request", target: "tag" },
    { id: "tag_route", source: "tag", target: "route" },
    { id: "route_yes", source: "route", target: "supervisor", branch: "true" as const },
    { id: "route_no", source: "route", target: "ordinary", branch: "false" as const },
    { id: "supervisor_ticket", source: "supervisor", target: "ticket" },
    { id: "ticket_escalated", source: "ticket", target: "escalated" }
  ]
};
const sameInput = { id: "ticket-001", priority: "high", category: "support" };

describe("Workflow Lab graph execution", () => {
  it("accepts TWO differently structured user-authored DAGs", () => {
    expect(validateWorkflowGraph(inquiries, DEMO_POLICY).ok).toBe(true);
    expect(validateWorkflowGraph(support, DEMO_POLICY).ok).toBe(true);
  });
  it("follows actual graph connections and pauses before any effect", () => {
    const a = previewLabWorkflow(inquiries, sameInput);
    const b = previewLabWorkflow(support, sameInput);
    expect(a.status).toBe("waiting_approval");
    expect(a.nextApproval?.nodeId).toBe("review");
    expect(a.plannedActions).toEqual([]);
    expect(b.status).toBe("completed");
    expect(b.output?.finishNodeId).toBe("ordinary");
    expect(b.plannedActions).toEqual([]);
    expect(b.trace.map(e => e.nodeId)).toEqual(["request", "tag", "route", "ordinary"]);
    expect(a.trace.map(e => e.nodeId)).toEqual(["incoming", "important", "review"]);
  });
  it("shows deterministic behavior change after author edits a node config", () => {
    const v1 = previewLabWorkflow(support, sameInput);
    const altered = structuredClone(support);
    (altered.nodes[1] as {config:{value:string}}).config.value = "go";
    const v2 = previewLabWorkflow(altered, sameInput);
    expect(v1.status).toBe("completed");
    expect(v2.status).toBe("waiting_approval");
    expect(v2.nextApproval?.nodeId).toBe("supervisor");
    expect(previewLabWorkflow(altered, sameInput, "approved")).toMatchObject({
      status: "completed", plannedActions: [{
        kind: "demo_crm.upsert", nodeId: "ticket",
        record: { leadId: "ticket-001", category: "support", priority: "medium" }
      }]
    });
    expect(previewLabWorkflow(altered, sameInput, "approved").trace.some(x=>x.status==="planned")).toBe(true);
  });
  it("rejecting approval never schedules an effect", () => {
    const rejected = previewLabWorkflow(inquiries, sameInput, "rejected");
    expect(rejected.status).toBe("cancelled");
    expect(rejected.plannedActions).toEqual([]);
    expect(rejected.trace.some(event => event.nodeId === "write")).toBe(false);
  });
  it("never turns a preview intent into an actual write", () => {
    const approved = previewLabWorkflow(inquiries, sameInput, "approved");
    expect(approved.mode).toBe("dry_run");
    expect(approved.persisted).toBe(false);
    expect(approved.externalEffects).toBe(false);
    expect(approved.plannedActions).toHaveLength(1);
    expect(approved.trace.some(e => e.message.includes("Dry-run ONLY"))).toBe(true);
  });
  it("enforces graph rules and rejects unapproved effects", () => {
    const wrong = structuredClone(inquiries);
    wrong.edges[3].source = "important";
    expect(() => previewLabWorkflow(wrong, sameInput)).toThrowError(LabRuntimeError);
  });
  it("does not execute unsupported AI/HTTP nodes or unsafe paths", () => {
    const ai = structuredClone(inquiries) as any;
    ai.nodes[1] = {
      id:"important",type:"ai.classify",
      config:{schemaKey:"lead-classification-v1",input:path("$.trigger.priority")}
    };
    const invalid = structuredClone(inquiries) as any;
    invalid.nodes[1].config.left = path("$.trigger.__proto__.polluted");
    expect(() => previewLabWorkflow(invalid, sameInput)).toThrowError(LabRuntimeError);
    expect(() => previewLabWorkflow(ai, sameInput)).toThrowError(LabRuntimeError);
  });
  it("enforces input limits before interpreting", () => {
    expect(() => previewLabWorkflow(inquiries, "not an object")).toThrowError(LabRuntimeError);
    expect(() => previewLabWorkflow(inquiries, { id: "x".repeat(5000), priority:"high" }))
      .toThrowError(LabRuntimeError);
  });
});
