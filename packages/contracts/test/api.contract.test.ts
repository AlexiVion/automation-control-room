import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ApprovalDecisionRequestSchema, CreateDemoSessionResponseSchema,
  CreateWorkflowRequestSchema, ExecutionAcceptedSchema, ExecutionEventSchema,
  PlanWorkflowResponseSchema, PublishWorkflowRequestSchema,
  RunStatusSchema, SubmitDemoEventSchema, WorkflowVersionResponseSchema
} from "../src/index.js";

const id = "00000000-0000-4000-8000-000000000001";
const draft = JSON.parse(readFileSync(
  new URL("../fixtures/valid-lead-workflow.json", import.meta.url), "utf8"
));

describe("API DTO v1 contracts", () => {
  it("requires a structurally valid draft to create workflows", () => {
    expect(CreateWorkflowRequestSchema.safeParse({ name: "Demo", draft }).success).toBe(true);
    expect(CreateWorkflowRequestSchema.safeParse({ name: "Demo", draft, hiddenGrant: "admin" }).success).toBe(false);
  });
  it("rejects anonymous demo inputs outside the three synthetic cases", () => {
    expect(SubmitDemoEventSchema.safeParse({ fixtureId: "lead_demo_002" }).success).toBe(true);
    expect(SubmitDemoEventSchema.safeParse({ fixtureId: "arbitrary-http-request" }).success).toBe(false);
    expect(SubmitDemoEventSchema.safeParse({ fixtureId: "lead_demo_001", url: "http://127.0.0.1" }).success).toBe(false);
  });
  it("uses schema-validated run states in both API and engine contracts", () => {
    for (const status of RunStatusSchema.options) {
      expect(ExecutionAcceptedSchema.safeParse({ executionId: id, status, duplicate: false }).success).toBe(true);
    }
    expect(ExecutionAcceptedSchema.safeParse({ executionId: id, status: "success", duplicate: false }).success).toBe(false);
  });
  it("does not return session tokens in the demo session body", () => {
    const res = {
      workspaceId: id,
      expiresAt: "2026-11-05T12:00:00.000Z",
      budgets: { runsRemaining: 5, maxNodes: 12, maxEdges: 20 }
    };
    expect(CreateDemoSessionResponseSchema.safeParse(res).success).toBe(true);
    expect(CreateDemoSessionResponseSchema.safeParse({ ...res, sessionSecret: "leak" }).success).toBe(false);
  });
  it("enforces expected revision and one-time approval digest shapes", () => {
    expect(PublishWorkflowRequestSchema.safeParse({ expectedRevision: 1 }).success).toBe(true);
    expect(PublishWorkflowRequestSchema.safeParse({ expectedRevision: -1 }).success).toBe(false);
    expect(ApprovalDecisionRequestSchema.safeParse({
      decision: "approved", expectedPayloadDigest: "a".repeat(64)
    }).success).toBe(true);
    expect(ApprovalDecisionRequestSchema.safeParse({
      decision: "approved", expectedPayloadDigest: "unsigned"
    }).success).toBe(false);
  });
  it("validates version/digest and redacted event DTO envelope", () => {
    expect(WorkflowVersionResponseSchema.safeParse({
      workflowVersionId: id, workflowId: id, versionNo: 1,
      graphDigest: "b".repeat(64), publishedAt: "2026-11-04T12:00:00.000Z"
    }).success).toBe(true);
    expect(ExecutionEventSchema.safeParse({
      executionId: id, sequence: 4, eventType: "step.succeeded",
      sanitizedPayload: { nodeId: "classify", mode: "deterministic_fixture" },
      createdAt: "2026-11-04T12:00:00.000Z"
    }).success).toBe(true);
  });
  it("requires the operator LLM response to use server-controlled provider_live mode", () => {
    expect(PlanWorkflowResponseSchema.safeParse({
      mode: "provider_live", draft, explanation: "Validated plan", warnings: []
    }).success).toBe(true);
    expect(PlanWorkflowResponseSchema.safeParse({
      mode: "deterministic_fixture", draft, explanation: "Fake", warnings: []
    }).success).toBe(false);
  });
});
