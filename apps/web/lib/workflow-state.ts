export type CanvasEvent = { sequence:number; nodeId:string|null; eventType:string; message:string; createdAt:string };
export type GraphRun = { status:string; priority:string|null; lastEventSeq:number };

export type NodeState="idle"|"complete"|"waiting"|"retrying"|"cancelled"|"skipped"|"running";
export function stateOfNode(id:string,run:GraphRun|null,events:CanvasEvent[]):NodeState {
  if(!run)return "idle";
  const kinds=new Set(events.map(e=>e.eventType));
  const has=(type:string)=>events.some(e=>e.nodeId===id&&e.eventType===type);
  if(id==="source")return has("step.started")?"complete":"running";
  if(id==="classify")return has("fixture.classified")?"complete":"idle";
  if(id==="branch")return has("condition.evaluated")?"complete":"idle";
  const low=run.priority!==null&&run.priority!=="high";
  if(id==="done_low")return low&&has("execution.completed")?"complete":low?"idle":"skipped";
  if(low)return "skipped";
  if(id==="approval"){
    if(kinds.has("approval.approved"))return "complete";
    if(kinds.has("approval.rejected")||kinds.has("approval.expired"))return "cancelled";
    if(kinds.has("approval.requested"))return "waiting";
    return "idle";
  }
  if(id==="crm"){
    if(kinds.has("crm.confirmed"))return "complete";
    if(run.status==="retrying"||has("step.retry_scheduled"))return "retrying";
    if(run.status==="cancelled")return "skipped";
    if(kinds.has("approval.approved"))return "running";
    return "idle";
  }
  if(id==="done_high"){
    if(run.status==="completed"&&has("execution.completed"))return "complete";
    return run.status==="cancelled"?"skipped":"idle";
  }
  return "idle";
}
