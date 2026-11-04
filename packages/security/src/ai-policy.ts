import { PlanProposalSchema } from "../../contracts/src/ai.js";
import { validateWorkflowGraph } from "../../contracts/src/workflow.js";
import type { PublishPolicy } from "../../contracts/src/workflow.js";

export function inspectUntrustedAIProposal(input: unknown, serverPolicy: PublishPolicy) {
  const proposal = PlanProposalSchema.safeParse(input);
  if (!proposal.success) return { ok: false as const, reason: "AI_SCHEMA_INVALID" };
  const graph = validateWorkflowGraph(proposal.data.draft, serverPolicy);
  if (!graph.ok) return { ok: false as const, reason: "AI_GRAPH_OR_POLICY_REJECTED", issues: graph.issues };
  return {
    ok: true as const,
    /** This is a draft proposal, NOT approval or publication permission. */
    draft: graph.draft,
    approved: false as const,
    executable: false as const
  };
}
