import { describe, expect, it } from "vitest";
import {
  emptyTimeline, applyPersistedEvent, restorePersistedTimeline,
  projectRunView, entryReducer
} from "../src/projection.js";

const executionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const versionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const event = (sequence: number, id = executionId) => ({
  executionId: id, sequence, eventType: "step.status",
  sanitizedPayload: { nodeId: "classify", status: "succeeded" },
  createdAt: "2026-11-04T12:00:00.000Z"
});
const snapshot = (status: string) => ({
  executionId, workflowVersionId: versionId, status,
  revision: 1, lastEventSeq: 3
});

describe("UI projection from persisted evidence", () => {
  it("appends strictly contiguous events with no optimistic fabricated state", () => {
    const first = applyPersistedEvent(emptyTimeline(executionId), event(1));
    expect(first.kind).toBe("applied");
    if (first.kind !== "applied") throw new Error("Expected applied");
    const second = applyPersistedEvent(first.state, event(2));
    expect(second.kind).toBe("applied");
    if (second.kind !== "applied") throw new Error("Expected applied");
    expect(second.state.events.map(x => x.sequence)).toEqual([1, 2]);
  });
  it("ignores duplicate SSE deliveries", () => {
    const first = applyPersistedEvent(emptyTimeline(executionId), event(1));
    if (first.kind !== "applied") throw new Error("Expected applied");
    const duplicated = applyPersistedEvent(first.state, event(1));
    expect(duplicated.kind).toBe("duplicate");
    expect(duplicated.state.events).toHaveLength(1);
  });
  it("detects gaps, stops advancing and requires server-backed resync", () => {
    const gapped = applyPersistedEvent(emptyTimeline(executionId), event(2));
    expect(gapped).toMatchObject({ kind: "gap", expected: 1, received: 2,
      state: { needsResync: true, lastSequence: 0 } });
    const next = applyPersistedEvent(gapped.state, event(1));
    expect(next.kind).toBe("gap");
    expect(next.state.events).toHaveLength(0);
    const recovered = restorePersistedTimeline(executionId, [event(2), event(1)]);
    expect(recovered).toMatchObject({lastSequence:2,needsResync:false});
    expect(recovered.events.map(x => x.sequence)).toEqual([1,2]);
  });
  it("rejects untrusted cross-run and malformed events", () => {
    expect(applyPersistedEvent(emptyTimeline(executionId), event(1, otherId)).kind).toBe("scope_mismatch");
    expect(applyPersistedEvent(emptyTimeline(executionId), { ...event(1), secret: "x" }).kind)
      .toBe("invalid");
    expect(() => restorePersistedTimeline(executionId, [event(1),event(3)])).toThrow("EVENT_HISTORY_NOT_CONTIGUOUS");
  });
  it("does not infer completed without a verified backend snapshot", () => {
    expect(projectRunView(undefined)).toMatchObject({kind:"loading"});
    expect(projectRunView(snapshot("running"))).toMatchObject({
      kind:"ready",status:"running",canAutoRetry:false
    });
    expect(projectRunView(snapshot("needs_review"))).toMatchObject({
      kind:"ready",status:"needs_review",canAutoRetry:false
    });
    expect(projectRunView(snapshot("completed"))).toMatchObject({kind:"ready",status:"completed"});
    expect(projectRunView(snapshot("magic-success"))).toMatchObject({kind:"loading"});
  });
  it("accepting an intake job is not equivalent to a completed run", () => {
    const start = entryReducer({phase:"idle"},{type:"START"});
    expect(start.phase).toBe("submitting");
    const accepted = entryReducer(start,{
      type:"ACK_FROM_API",
      payload:{executionId,status:"queued",duplicate:false}
    });
    expect(accepted).toEqual({phase:"accepted",executionId,duplicate:false});
    expect(accepted).not.toHaveProperty("status","completed");
    expect(entryReducer(accepted,{type:"ACK_FROM_API",payload:{executionId,status:"completed",duplicate:false}}))
      .toEqual(accepted);
  });
  it("rejects invalid acknowledgements and ignores repeated start until reset", () => {
    const start = entryReducer({phase:"idle"},{type:"START"});
    expect(entryReducer(start,{type:"START"})).toEqual(start);
    expect(entryReducer(start,{type:"ACK_FROM_API",payload:{fake:true}}))
      .toEqual({phase:"request_failed",errorCode:"INVALID_SERVER_RESPONSE"});
    expect(entryReducer(start,{type:"ERROR",errorCode:"RATE_LIMITED"}))
      .toEqual({phase:"request_failed",errorCode:"RATE_LIMITED"});
  });
});
