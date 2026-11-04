import type { WorkflowDraft } from "./workflow.js";
import type { RunStatus, StepStatus } from "./status.js";

export type EngineEvent =
  | { type: "START" }
  | { type: "STEP_SUCCEEDED"; nodeId: string; outputDigest: string }
  | { type: "STEP_FAILED"; nodeId: string; errorCode: string; retrySafe: boolean }
  | { type: "APPROVAL_DECIDED"; nodeId: string; decision: "approved" | "rejected" }
  | { type: "CANCEL_REQUESTED" }
  | { type: "EFFECT_UNCERTAIN"; nodeId: string; operationKey: string };
export type EngineCommand =
  | { type: "RUN_STEP"; nodeId: string }
  | { type: "REQUEST_APPROVAL"; nodeId: string; payloadDigest: string }
  | { type: "MARK_SKIPPED"; nodeId: string }
  | { type: "SCHEDULE_RETRY"; nodeId: string; delayMs: number }
  | { type: "RECORD_TERMINAL"; status: "needs_review" | "completed" | "failed" | "cancelled" };
export interface EngineSnapshot {
  workflowVersionId: string;
  graph: WorkflowDraft;
  revision: number;
  runStatus: RunStatus;
  stepStatuses: Readonly<Record<string, StepStatus>>;
  cursorNodeId?: string;
}
export type EngineDecision =
  | { ok: true; status: RunStatus; commands: readonly EngineCommand[] }
  | { ok: false; code: "CONFLICT" | "INVALID_GRAPH" | "FORBIDDEN"; message: string };
/** Pure deterministic transition planning. Runtime owns persistence and effects. */
export interface WorkflowEnginePort {
  decide(snapshot: Readonly<EngineSnapshot>, event: Readonly<EngineEvent>): EngineDecision;
}
