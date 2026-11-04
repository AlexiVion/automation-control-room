import { z } from "zod";
import { WorkflowDraftSchema } from "./workflow.js";
import type { WorkflowDraft } from "./workflow.js";
import type { ContractIssue } from "./errors.js";

export const ClassificationSchema = z.strictObject({
  category: z.enum(["automation", "software", "other"]),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1).max(280)
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const PlanProposalSchema = z.strictObject({
  draft: WorkflowDraftSchema,
  explanation: z.string().min(1).max(1200),
  warnings: z.array(z.string().max(280)).max(12)
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

export type AIMode = "deterministic_fixture" | "provider_live";
export type TokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
};
export type AIPlanRequest = {
  intent: string;
  allowedNodeTypes: readonly WorkflowDraft["nodes"][number]["type"][];
  limits: { maxNodes: number; maxEdges: number; maxDepth: number };
  budget: TokenBudget;
};
export type AIPlanResult = {
  /** Server-supplied provenance, not an untrusted model-provided field. */
  mode: AIMode;
  proposal: PlanProposal;
  warnings: readonly ContractIssue[];
  providerRequestId?: string;
};
export interface AIPlannerPort {
  plan(request: AIPlanRequest, signal: AbortSignal): Promise<AIPlanResult>;
  classify(input: { sanitizedText: string; schemaKey: "lead-classification-v1"; budget: TokenBudget },
    signal: AbortSignal): Promise<{ mode: AIMode; classification: Classification }>;
}
/** AIPlannerPort must not expose publish, approve, perform HTTP or database writes. */
