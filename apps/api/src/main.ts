import { randomUUID, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { z } from "zod";
import { verifyMutationOrigin, guestCookie } from "../../../packages/security/src/sessions.js";
import { SubmitDemoEventSchema, ApprovalDecisionRequestSchema } from "../../../packages/contracts/src/api.js";
import { db, boss, QUEUE, RESUME, initializeBoss, fromPrisma } from "../../../packages/runtime/src/db.js";
import { listFixtures, fixture, ensureVersion, VERSION_ID } from "../../../packages/runtime/src/fixture.js";
import { issueSession, resolveSession, budget } from "../../../packages/runtime/src/session.js";
import { appendEvent } from "../../../packages/runtime/src/events.js";

const app=Fastify({logger:{level:"info"},bodyLimit:16*1024});
await app.register(cookie);
const allowedOrigins=(process.env.ACR_ALLOWED_ORIGINS??"http://localhost:3000").split(",");
const isLocal=process.env.ACR_LOCAL_ONLY==="true";
if(!isLocal)throw new Error("Phase 5 slice 1 is LOCAL ONLY. Configure ACR_LOCAL_ONLY=true and restrict ports.");
const now=()=>Date.now();
class HttpError extends Error {
  constructor(public statusCode:number,public errorCode:string){super(errorCode);}
}
const http=(status:number,code:string):never=>{throw new HttpError(status,code)};
function origin(req:{headers:Record<string,unknown>}) {
  const header=req.headers.origin;
  if(!verifyMutationOrigin(typeof header==="string"?header:undefined,allowedOrigins))http(403,"INVALID_ORIGIN");
}
async function guest(req:{cookies:Record<string,string|undefined>}) {
  const record=await resolveSession(req.cookies.acr_demo_session);
  if(!record)http(401,"SESSION_REQUIRED");
  return record!;
}
function safeCsrf(actual:string,presented:unknown){
  if(typeof presented!=="string"||!/^[a-f0-9]{64}$/.test(presented))return false;
  return timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(presented,"hex"));
}
async function mutation(req:{cookies:Record<string,string|undefined>,headers:Record<string,unknown>}){
  origin(req);
  const session=await guest(req);
  if(!safeCsrf(session.csrf,req.headers["x-acr-csrf"]))http(403,"CSRF_REQUIRED");
  return session;
}
const uuid=z.uuid();
app.setErrorHandler((error,req,reply)=>{
  const status=error instanceof HttpError?error.statusCode:500;
  const code=error instanceof HttpError?error.errorCode:"INTERNAL_ERROR";
  if(status>=500)req.log.error({message:error instanceof Error?error.message:String(error)},"request failed");
  reply.status(status).send({error:{code,message:code,retryable:false}});
});
app.get("/health/live",async()=>({status:"live"}));
app.get("/health/ready",async()=>{
  await db.demoVersion.findUniqueOrThrow({where:{id:VERSION_ID}});
  return {status:"ready",database:"ok"};
});
app.post("/v1/demo/sessions",async(req,reply)=>{
  origin(req);
  const current=await resolveSession(req.cookies.acr_demo_session);
  if(current){
    return {...current,budgets:await budget(current.workspaceId),fixtures:listFixtures()};
  }
  const created=await issueSession();
  // On localhost only; never use an insecure cookie on a public deployment.
  reply.setCookie("acr_demo_session",created.token,{
    httpOnly:true,sameSite:"lax",secure:false,path:"/",maxAge:24*60*60
  });
  const {token,...publicSession}=created;
  reply.code(201);
  return {...publicSession,budgets:await budget(created.workspaceId),fixtures:listFixtures()};
});
app.get("/v1/demo/me",async req=>{
  const s=await guest(req);
  return {...s,budgets:await budget(s.workspaceId),fixtures:listFixtures()};
});
app.post("/v1/demo/events",async(req,reply)=>{
  const s=await mutation(req);
  const parsed=SubmitDemoEventSchema.safeParse(req.body);
  if(!parsed.success)throw new HttpError(422,"INVALID_FIXTURE");
  const body=parsed.data;
  const lead=fixture(body.fixtureId);
  const header=req.headers["idempotency-key"];
  const eventId=typeof header==="string" && /^[a-f0-9-]{36}$/.test(header)?header:randomUUID();
  const prior=await db.demoExecution.findUnique({where:{
    workspaceId_eventId:{workspaceId:s.workspaceId,eventId}
  }});
  if(prior){
    reply.code(202);return {executionId:prior.id,status:prior.status,duplicate:true};
  }
  try{
    const result=await db.$transaction(async tx=>{
      const reserved=await tx.demoWorkspace.updateMany({
        where:{id:s.workspaceId,expiresAt:{gt:new Date()},runsStarted:{lt:5},activeRuns:{lt:1}},
        data:{runsStarted:{increment:1},activeRuns:{increment:1}}
      });
      if(reserved.count!==1)http(429,"DEMO_QUOTA_REACHED");
      const id=randomUUID();
      const execution=await tx.demoExecution.create({data:{
        id,workspaceId:s.workspaceId,versionId:VERSION_ID,eventId,
        leadId:lead.id,failOnce:body.simulateTransientFailureOnce??false,
        status:"queued",lastEventSeq:1,
        events:{create:{id:randomUUID(),sequence:1,eventType:"execution.queued",
          nodeId:"source",message:"Ejecución guardada y en cola"}}
      }});
      const jobId=await boss.send(QUEUE,{executionId:id},{db:fromPrisma(tx)});
      if(!jobId)throw new Error("Job enqueue failed");
      return execution;
    });
    reply.code(202);return {executionId:result.id,status:result.status,duplicate:false};
  }catch(error){
    // Unique(workspace,eventId) is the authoritative concurrency guard.
    const existing=await db.demoExecution.findUnique({where:{
      workspaceId_eventId:{workspaceId:s.workspaceId,eventId}
    }});
    if(existing){reply.code(202);return {executionId:existing.id,status:existing.status,duplicate:true};}
    throw error;
  }
});
const runParams=z.object({executionId:uuid});
async function scopedRun(workspaceId:string,id:string) {
  const result=await db.demoExecution.findFirst({where:{id,workspaceId}});
  if(!result)http(404,"EXECUTION_NOT_FOUND");
  return result!;
}
app.get("/v1/executions/:executionId",async req=>{
  const s=await guest(req);
  const p=runParams.safeParse(req.params);
  if(!p.success)throw new HttpError(400,"INVALID_ID");
  const e=await scopedRun(s.workspaceId,p.data.executionId);
  return {executionId:e.id,workflowVersionId:e.versionId,status:e.status,
    revision:e.lastEventSeq,lastEventSeq:e.lastEventSeq};
});
app.get("/v1/demo/runs/:executionId",async req=>{
  const s=await guest(req);
  const p=runParams.safeParse(req.params);
  if(!p.success)throw new HttpError(400,"INVALID_ID");
  const e=await db.demoExecution.findFirst({where:{id:p.data.executionId,workspaceId:s.workspaceId},
    include:{events:{orderBy:{sequence:"asc"}},approval:true}});
  if(!e)throw new HttpError(404,"EXECUTION_NOT_FOUND");
  return {
    execution:{id:e.id,status:e.status,leadId:e.leadId,priority:e.priority,
      category:e.category,attempts:e.attempts,lastEventSeq:e.lastEventSeq,createdAt:e.createdAt},
    events:e.events.map(ev=>({sequence:ev.sequence,eventType:ev.eventType,nodeId:ev.nodeId,
      message:ev.message,createdAt:ev.createdAt})),
    approval:e.approval?{id:e.approval.id,status:e.approval.status,
      payloadDigest:e.approval.payloadDigest,expiresAt:e.approval.expiresAt}:null,
    budgets:await budget(s.workspaceId)
  };
});
app.get("/v1/demo/crm",async req=>{
  const s=await guest(req);
  return {items:await db.demoCrm.findMany({
    where:{workspaceId:s.workspaceId},orderBy:{updatedAt:"desc"},
    select:{id:true,externalKey:true,category:true,priority:true,executionId:true,updatedAt:true}
  })};
});
app.post("/v1/approvals/:approvalId/decision",async(req)=>{
  const s=await mutation(req);
  const p=z.object({approvalId:uuid}).safeParse(req.params);
  const b=ApprovalDecisionRequestSchema.safeParse(req.body);
  if(!p.success||!b.success)throw new HttpError(422,"INVALID_APPROVAL_DECISION");
  const a=await db.demoApproval.findFirst({where:{id:p.data.approvalId,
    execution:{workspaceId:s.workspaceId}}});
  if(!a)throw new HttpError(404,"APPROVAL_NOT_FOUND");
  if(a.payloadDigest!==b.data.expectedPayloadDigest)http(409,"APPROVAL_DIGEST_CONFLICT");
  return db.$transaction(async tx=>{
    const changed=await tx.demoApproval.updateMany({
      where:{id:a.id,status:"pending",expiresAt:{gt:new Date()}},
      data:{status:b.data.decision,decidedAt:new Date()}
    });
    if(changed.count!==1)http(409,"APPROVAL_ALREADY_DECIDED_OR_EXPIRED");
    const e=await tx.demoExecution.findUniqueOrThrow({where:{id:a.executionId}});
    const moved=await tx.demoExecution.updateMany({where:{id:e.id,status:"waiting_approval"},
      data:{status:b.data.decision==="approved"?"queued":"cancelled"}});
    if(moved.count!==1)http(409,"EXECUTION_STATE_CONFLICT");
    await appendEvent(tx,e.id,"approval."+b.data.decision,"approval",
      b.data.decision==="approved"?"Aprobación confirmada":"Acción rechazada");
    if(b.data.decision==="approved"){
      const id=await boss.send(RESUME,{executionId:e.id},{db:fromPrisma(tx)});
      if(!id)throw new Error("Approval continuation enqueue failed");
    }else{
      await appendEvent(tx,e.id,"execution.cancelled","done_high","Sin modificar CRM");
      await tx.demoWorkspace.updateMany({
        where:{id:e.workspaceId,activeRuns:{gt:0}},data:{activeRuns:{decrement:1}}
      });
    }
    return {approvalId:a.id,status:b.data.decision,decidedAt:new Date().toISOString()};
  });
});
// SSE uses DB-backed event sequence. This is an inspector transport, not a trigger.
app.get("/v1/executions/:executionId/events",async(req,reply)=>{
  const s=await guest(req);
  const p=runParams.safeParse(req.params);
  if(!p.success)throw new HttpError(400,"INVALID_ID");
  await scopedRun(s.workspaceId,p.data.executionId);
  const cursor=typeof req.headers["last-event-id"]==="string"?
    Number(req.headers["last-event-id"]):0;
  if(!Number.isSafeInteger(cursor)||cursor<0)http(400,"INVALID_EVENT_CURSOR");
  reply.hijack();
  const raw=reply.raw;
  raw.writeHead(200,{"Content-Type":"text/event-stream; charset=utf-8",
    "Cache-Control":"no-cache, no-transform","Connection":"keep-alive",
    "X-Accel-Buffering":"no"});
  let last=cursor;
  let busy=false;
  const pump=async()=>{
    if(busy||raw.destroyed)return;
    busy=true;
    try{
      const events=await db.demoEvent.findMany({where:{
        executionId:p.data.executionId,sequence:{gt:last}},
        orderBy:{sequence:"asc"},take:100
      });
      for(const event of events){
        raw.write("id: "+event.sequence+"\nevent: execution-event\ndata: "+
          JSON.stringify({executionId:event.executionId,sequence:event.sequence,
            eventType:event.eventType,createdAt:event.createdAt.toISOString(),
            sanitizedPayload:{nodeId:event.nodeId,message:event.message}})+"\n\n");
        last=event.sequence;
      }
    }catch(error){req.log.error({message:String(error)},"SSE poll failed");}
    finally{busy=false;}
  };
  await pump();
  const interval=setInterval(()=>{void pump()},800);
  const heartbeat=setInterval(()=>{if(!raw.destroyed)raw.write(": keepalive\n\n")},15_000);
  raw.on("close",()=>{clearInterval(interval);clearInterval(heartbeat)});
});
await db.$connect();
await ensureVersion();
await initializeBoss();
await app.listen({host:"0.0.0.0",port:3100});
