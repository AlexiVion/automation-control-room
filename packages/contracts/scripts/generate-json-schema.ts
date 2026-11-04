import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { WorkflowDraftSchema } from "../src/workflow.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "schema/workflow-draft.v1.schema.json");
const schema = z.toJSONSchema(WorkflowDraftSchema);
const content = JSON.stringify({
  ...schema,
  $id: "https://github.com/AlexiVion/automation-control-room/blob/main/packages/contracts/schema/workflow-draft.v1.schema.json",
  title: "ACR Workflow Draft v1 — structural contract"
}, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
    throw new Error("JSON Schema missing or stale; run npm run contracts:jsonschema and commit the generated file");
  }
  console.log("JSON Schema snapshot is in sync");
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`Wrote ${target}`);
}
