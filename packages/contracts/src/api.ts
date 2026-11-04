import { z } from "zod";
import { WorkflowDraftSchema } from "./workflow.js";
import { RunStatusSchema } from "./status.js";

/**
 * Wire DTOs. Auth scopes and policies are always enforced at the Fastify boundary;
 * these schemas prove shapes, not permissions or transactional behavior.
 */
const id = z.uuid();
const revision = z.number().int().min(0);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime();

export const CreateDemoSessionResponseSchema = z.strictObject({
  workspaceId: id,
  expiresAt: timestamp,
  budgets: z.strictObject({
    runsRemaining: z.number().int().min(0),
    maxNodes: z.number().int().min(1),
    maxEdges: z.number().int().min(0)
  })
});
export const SubmitDemoEventSchema = z.strictObject({
  fixtureId: z.enum(["lead_demo_001", "lead_demo_002", "lead_demo_003"]),
  simulateTransientFailureOnce: z.boolean().optional()
});
export const CreateWorkflowRequestSchema = z.strictObject({
  name: z.string().min(1).max(100),
  draft: WorkflowDraftSchema
});
export const WorkflowResourceSchema = z.strictObject({
  workflowId: id,
  draftRevision: revision,
  draft: WorkflowDraftSchema,
  publishedVersionId: id.optional()
});
export const ReplaceWorkflowDraftRequestSchema = z.strictObject({
  expectedRevision: revision,
  draft: WorkflowDraftSchema
});
export const PublishWorkflowRequestSchema = z.strictObject({
  expectedRevision: revision
});
export const WorkflowVersionResponseSchema = z.strictObject({
  workflowVersionId: id,
  workflowId: id,
  versionNo: z.number().int().min(1),
  graphDigest: digest,
  publishedAt: timestamp
});
export const ExecutionAcceptedSchema = z.strictObject({
  executionId: id,
  status: RunStatusSchema,
  duplicate: z.boolean()
});
export const ExecutionResourceSchema = z.strictObject({
  executionId: id,
  workflowVersionId: id,
  status: RunStatusSchema,
  revision: revision,
  lastEventSeq: revision
});
export const ExecutionEventSchema = z.strictObject({
  executionId: id,
  sequence: z.number().int().min(1),
  eventType: z.string().min(1).max(100),
  sanitizedPayload: z.record(z.string(), z.unknown()),
  createdAt: timestamp
});
export const ApprovalDecisionRequestSchema = z.strictObject({
  decision: z.enum(["approved", "rejected"]),
  expectedPayloadDigest: digest
});
export const ApprovalDecisionResponseSchema = z.strictObject({
  approvalId: id,
  status: z.enum(["approved", "rejected"]),
  decidedAt: timestamp
});
export const PlanWorkflowRequestSchema = z.strictObject({
  intent: z.string().min(3).max(2000)
});
export const PlanWorkflowResponseSchema = z.strictObject({
  mode: z.literal("provider_live"),
  draft: WorkflowDraftSchema,
  explanation: z.string().min(1).max(1200),
  warnings: z.array(z.string().max(280)).max(12)
});
export const DemoCrmRecordSchema = z.strictObject({
  id,
  externalKey: z.string().min(1).max(100),
  category: z.enum(["automation", "software", "other"]),
  priority: z.enum(["high", "medium", "low"])
});

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;
export type WorkflowResource = z.infer<typeof WorkflowResourceSchema>;
export type ReplaceWorkflowDraftRequest = z.infer<typeof ReplaceWorkflowDraftRequestSchema>;
export type ExecutionResource = z.infer<typeof ExecutionResourceSchema>;
export type ExecutionEventDTO = z.infer<typeof ExecutionEventSchema>;
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;
