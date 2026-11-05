import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const path = new URL("../../../docs/contracts/openapi.yaml", import.meta.url);
const raw = readFileSync(path, "utf8");
const doc = YAML.parseDocument(raw, { uniqueKeys: true });
const openapi = doc.toJS() as {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, Record<string, unknown>>;
};

describe("OpenAPI 3.1 design contract", () => {
  it("parses without YAML errors or duplicate map keys", () => {
    expect(doc.errors).toEqual([]);
    expect(openapi.openapi).toBe("3.1.1");
  });
  it("covers intake, drafts, publish, execution, SSE, approvals and AI planning", () => {
    for (const p of [
      "/demo/sessions", "/demo/events", "/workflows",
      "/workflows/{workflowId}/draft", "/workflows/{workflowId}/publish",
      "/webhooks/{sourceKey}", "/executions/{executionId}",
      "/executions/{executionId}/events", "/executions/{executionId}/cancel",
      "/approvals/{approvalId}/decision", "/ai/workflows:plan"
    ]) expect(openapi.paths).toHaveProperty(p);
  });
  it("references only defined local OpenAPI components", () => {
    const refs: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref" && typeof child === "string") refs.push(child);
        else walk(child);
      }
    };
    walk(openapi);
    for (const ref of refs) {
      expect(ref.startsWith("#/components/")).toBe(true);
      const segments = ref.slice(2).split("/");
      let target: unknown = openapi;
      for (const segment of segments) target = (target as Record<string, unknown>)?.[segment];
      expect(target, `Broken OpenAPI reference ${ref}`).toBeDefined();
    }
  });
  it("disallows guest authentication for real AI planner", () => {
    const operation = openapi.paths["/ai/workflows:plan"]?.post as {
      security: Array<Record<string, unknown>>;
    };
    expect(operation.security).toEqual([{ operatorBearer: [] }]);
  });
});
