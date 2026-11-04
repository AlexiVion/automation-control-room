import { describe, expect, it } from "vitest";
import { stateOfNode, type CanvasEvent, type GraphRun } from "../lib/workflow-state";

const entry=(eventType:string,nodeId:string,sequence:number):CanvasEvent=>({
  sequence,eventType,nodeId,message:"synthetic test",createdAt:"2026-11-04T17:00:00.000Z"
});
const high:GraphRun={status:"waiting_approval",priority:"high",lastEventSeq:5};
describe("published workflow node state projection",()=>{
  it("shows an approval request as WAITING, never completed",()=>{
    const events=[
      entry("step.started","source",2),
      entry("fixture.classified","classify",3),
      entry("condition.evaluated","branch",4),
      entry("approval.requested","approval",5)
    ];
    expect(stateOfNode("source",high,events)).toBe("complete");
    expect(stateOfNode("classify",high,events)).toBe("complete");
    expect(stateOfNode("approval",high,events)).toBe("waiting");
    expect(stateOfNode("crm",high,events)).toBe("idle");
  });
  it("only labels approval complete after persisted approval.approved",()=>{
    const approved=[
      entry("approval.requested","approval",5),
      entry("approval.approved","approval",6)
    ];
    expect(stateOfNode("approval",{...high,status:"queued"},approved)).toBe("complete");
    expect(stateOfNode("crm",{...high,status:"queued"},approved)).toBe("running");
  });
  it("distinguishes rejected and skipped effects",()=>{
    const rejected=[
      entry("approval.requested","approval",5),
      entry("approval.rejected","approval",6)
    ];
    expect(stateOfNode("approval",{...high,status:"cancelled"},rejected)).toBe("cancelled");
    expect(stateOfNode("crm",{...high,status:"cancelled"},rejected)).toBe("skipped");
  });
  it("does not imply CRM work on the medium/low path",()=>{
    const medium={...high,priority:"medium",status:"completed"};
    const events=[
      entry("step.skipped","crm",4),
      entry("execution.completed","done_low",5)
    ];
    expect(stateOfNode("done_low",medium,events)).toBe("complete");
    expect(stateOfNode("approval",medium,events)).toBe("skipped");
    expect(stateOfNode("crm",medium,events)).toBe("skipped");
    expect(stateOfNode("done_high",medium,events)).toBe("skipped");
  });
  it("displays retry until real CRM confirmation",()=>{
    const events=[
      entry("approval.approved","approval",6),
      entry("step.retry_scheduled","crm",7)
    ];
    expect(stateOfNode("crm",{...high,status:"retrying"},events)).toBe("retrying");
    const complete=[...events,entry("crm.confirmed","crm",8),
      entry("execution.completed","done_high",9)];
    expect(stateOfNode("crm",{...high,status:"completed"},complete)).toBe("complete");
    expect(stateOfNode("done_high",{...high,status:"completed"},complete)).toBe("complete");
  });
});
