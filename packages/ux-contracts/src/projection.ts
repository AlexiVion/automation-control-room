import {
  ExecutionAcceptedSchema,
  ExecutionEventSchema,
  ExecutionResourceSchema
} from "../../contracts/src/api.js";
import type { ExecutionEventDTO, ExecutionResource } from "../../contracts/src/api.js";

/**
 * This is a PURE read-model for a future browser. It cannot execute a node,
 * approve an action, write CRM, or invent persisted completion.
 */
export type TimelineModel = {
  executionId: string;
  lastSequence: number;
  events: readonly ExecutionEventDTO[];
  needsResync: boolean;
};

export type TimelineOutcome =
  | { kind: "applied"; state: TimelineModel }
  | { kind: "duplicate"; state: TimelineModel }
  | { kind: "gap"; expected: number; received: number; state: TimelineModel }
  | { kind: "scope_mismatch"; state: TimelineModel }
  | { kind: "invalid"; state: TimelineModel };

export function emptyTimeline(executionId: string): TimelineModel {
  return { executionId, lastSequence: 0, events: [], needsResync: false };
}
export function applyPersistedEvent(state: TimelineModel, input: unknown): TimelineOutcome {
  const parsed = ExecutionEventSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", state };
  const event = parsed.data;
  if (event.executionId !== state.executionId) return { kind: "scope_mismatch", state };
  if (state.needsResync) {
    return { kind: "gap", state, expected: state.lastSequence + 1, received: event.sequence };
  }
  if (event.sequence <= state.lastSequence) return { kind: "duplicate", state };
  if (event.sequence !== state.lastSequence + 1) {
    return { kind: "gap", expected: state.lastSequence + 1, received: event.sequence,
      state: { ...state, needsResync: true } };
  }
  return {
    kind: "applied",
    state: { ...state, lastSequence: event.sequence, events: [...state.events, event] }
  };
}
/**
 * Replace the whole timeline with a contiguous, authenticated DB-backed fetch.
 * A gap MUST NOT be patched from imagination or locally synthesized events.
 */
export function restorePersistedTimeline(executionId: string, fetched: unknown): TimelineModel {
  if (!Array.isArray(fetched)) throw new Error("EVENT_HISTORY_INVALID");
  const parsed = fetched.map(value => ExecutionEventSchema.parse(value));
  if (parsed.length > 1000) throw new Error("EVENT_HISTORY_LIMIT");
  const ordered = [...parsed].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i]!.executionId !== executionId || ordered[i]!.sequence !== i + 1) {
      throw new Error("EVENT_HISTORY_NOT_CONTIGUOUS");
    }
  }
  return { executionId, lastSequence: ordered.length, events: ordered, needsResync: false };
}
export type RunView =
  | { kind: "loading"; message: "Sincronizando estado" }
  | { kind: "ready"; status: ExecutionResource["status"]; executionId: string;
      workflowVersionId: string; lastEventSeq: number; canAutoRetry: false };

/** Only a verified GET /executions snapshot can determine run success/state. */
export function projectRunView(snapshot: unknown): RunView {
  const parsed = ExecutionResourceSchema.safeParse(snapshot);
  if (!parsed.success) return { kind: "loading", message: "Sincronizando estado" };
  return {
    kind: "ready", status: parsed.data.status, executionId: parsed.data.executionId,
    workflowVersionId: parsed.data.workflowVersionId,
    lastEventSeq: parsed.data.lastEventSeq,
    canAutoRetry: false
  };
}

export type EntryState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "accepted"; executionId: string; duplicate: boolean }
  | { phase: "request_failed"; errorCode: string };

export function entryReducer(state: EntryState, action:
  | { type: "START" }
  | { type: "ACK_FROM_API"; payload: unknown }
  | { type: "ERROR"; errorCode: string }
  | { type: "RESET" }): EntryState {
  switch (action.type) {
    case "START": return state.phase === "submitting" ? state : { phase: "submitting" };
    case "ACK_FROM_API": {
      if (state.phase !== "submitting") return state;
      const parsed = ExecutionAcceptedSchema.safeParse(action.payload);
      if (!parsed.success) return { phase: "request_failed", errorCode: "INVALID_SERVER_RESPONSE" };
      return { phase: "accepted", executionId: parsed.data.executionId,
        duplicate: parsed.data.duplicate };
    }
    case "ERROR":
      return state.phase !== "submitting" ? state : {
        phase: "request_failed", errorCode: action.errorCode
      };
    case "RESET": return { phase: "idle" };
  }
}
