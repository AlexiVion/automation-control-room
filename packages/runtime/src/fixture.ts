import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DEMO_POLICY, validateWorkflowGraph } from "../../contracts/src/workflow.js";
import { db } from "./db.js";

export const VERSION_ID = "10000000-0000-4000-8000-000000000001";
const fixtures = {
  lead_demo_001: {
    id: "lead_demo_001",
    name: "Automatización de consultas",
    text: "Un negocio quiere automatizar sus consultas. Prioridad alta.",
    category: "automation",
    priority: "high"
  },
  lead_demo_002: {
    id: "lead_demo_002",
    name: "Panel interno",
    text: "Una empresa consulta por un panel interno. Prioridad media.",
    category: "software",
    priority: "medium"
  },
  lead_demo_003: {
    id: "lead_demo_003",
    name: "Consulta general",
    text: "Consulta informativa general. Prioridad baja.",
    category: "other",
    priority: "low"
  }
} as const;
export type FixtureId = keyof typeof fixtures;
export function fixture(id: FixtureId) { return fixtures[id]; }
export function listFixtures() { return Object.values(fixtures); }

export const graph = JSON.parse(readFileSync(
  new URL("../../contracts/fixtures/valid-lead-workflow.json", import.meta.url), "utf8"
));
const validated = validateWorkflowGraph(graph, DEMO_POLICY);
if (!validated.ok) throw new Error("Canonical demonstration workflow did not pass Gate 4C validation");
const graphDigest = createHash("sha256").update(JSON.stringify(graph)).digest("hex");
export async function ensureVersion() {
  const existing = await db.demoVersion.findUnique({where:{id:VERSION_ID}});
  if (existing) {
    if (existing.graphDigest !== graphDigest) throw new Error("Immutable workflow version changed; issue a new ID");
    return existing;
  }
  return db.demoVersion.create({ data: {
    id: VERSION_ID, name: "Lead → Clasificar → Aprobar → CRM", graphDigest, graph
  } });
}
