import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BindingSchema, ClassificationSchema, ConnectorManifestSchema,
  DEMO_POLICY, OPERATOR_POLICY, PlanProposalSchema, WorkflowDraftSchema,
  validateWorkflowGraph
} from "../src/index.js";
import type { ContractErrorCode } from "../src/index.js";

const load = (name: string): unknown => JSON.parse(
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")
);
const codes = (input: unknown, mode: "demo" | "operator" = "demo"): ContractErrorCode[] => {
  const result = validateWorkflowGraph(input, mode === "demo"
    ? DEMO_POLICY : { ...OPERATOR_POLICY, allowedDestinationKeys: ["crm.remote"] });
  return result.ok ? [] : result.issues.map(issue => issue.code);
};

describe("workflow v1 contracts", () => {
  it("accepts a complete lead example with exclusive branches and approved CRM write", () => {
    const sample = load("valid-lead-workflow.json");
    expect(WorkflowDraftSchema.safeParse(sample).success).toBe(true);
    const result = validateWorkflowGraph(sample, DEMO_POLICY);
    expect(result.ok, result.ok ? "" : JSON.stringify(result.issues)).toBe(true);
  });
  it.each([
    ["invalid-missing-approval.json", "APPROVAL_REQUIRED"],
    ["invalid-join.json", "INVALID_DEGREE"],
    ["invalid-cycle.json", "CYCLE"],
    ["invalid-unsafe-binding.json", "UNSAFE_BINDING"],
    ["invalid-nonancestor-binding.json", "INVALID_BINDING_SOURCE"],
    ["invalid-guest-http.json", "FORBIDDEN_CONNECTOR"]
  ] as const)("rejects %s with %s", (fixture, expectedCode) => {
    expect(codes(load(fixture))).toContain(expectedCode);
  });
  it("allows an explicitly permitted operator HTTP destination only when approved", () => {
    expect(codes(load("invalid-guest-http.json"), "operator")).toEqual([]);
  });
  it("rejects unknown config keys, raw URLs and arbitrary binding evaluation", () => {
    const bad = structuredClone(load("valid-lead-workflow.json")) as any;
    bad.nodes[1].config.url = "http://127.0.0.1/admin";
    expect(WorkflowDraftSchema.safeParse(bad).success).toBe(false);
    expect(BindingSchema.safeParse({ kind: "path", path: "$.trigger.lead[0]" }).success).toBe(false);
    expect(BindingSchema.safeParse({ kind: "literal", value: { eval: "run()" } }).success).toBe(false);
  });
  it("rejects repeated node IDs and unauthorized effects", () => {
    const repeated = structuredClone(load("valid-lead-workflow.json")) as any;
    repeated.nodes[1].id = "source";
    expect(codes(repeated)).toContain("DUPLICATE_ID");
    const forbidden = structuredClone(load("invalid-guest-http.json")) as any;
    forbidden.nodes[4].config.destinationKey = "metadata.local";
    expect(codes(forbidden, "operator")).toContain("FORBIDDEN_CONNECTOR");
  });
  it("returns structural JSON Schema for the Zod contract", () => {
    const schema = z.toJSONSchema(WorkflowDraftSchema);
    expect(schema).toMatchObject({ type: "object" });
    expect(schema).toHaveProperty("properties");
  });
  it("validates the typed LLM output but never treats provider text as authority", () => {
    const classified = {
      category: "automation", priority: "high", rationale: "Lead requested automation."
    };
    expect(ClassificationSchema.safeParse(classified).success).toBe(true);
    expect(ClassificationSchema.safeParse({ ...classified, allowHttp: true }).success).toBe(false);
    const proposed = { draft: load("valid-lead-workflow.json"), explanation: "demo", warnings: [] };
    expect(PlanProposalSchema.safeParse(proposed).success).toBe(true);
  });
  it("requires connector manifests to declare effect, idempotency, grants and network", () => {
    const manifest = {
      key: "demo_crm.upsert", version: "1.0.0", effect: "write",
      requiredGrants: ["demo_crm.write"], timeoutMs: 1000,
      idempotency: "transactional", network: "none",
      inputSchemaId: "crm-input-v1", outputSchemaId: "crm-output-v1"
    };
    expect(ConnectorManifestSchema.safeParse(manifest).success).toBe(true);
    expect(ConnectorManifestSchema.safeParse({ ...manifest, network: "arbitrary" }).success).toBe(false);
  });
});
