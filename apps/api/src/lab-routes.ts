import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, boss, LAB_RUN, fromPrisma } from "../../../packages/runtime/src/db.js";
import { validateWorkflowGraph, DEMO_POLICY } from "../../../packages/contracts/src/workflow.js";
import { previewLabWorkflow } from "../../../packages/runtime/src/lab-interpreter.js";

type Auth = {workspaceId:string};
type AuthBoundary = {
  guest:(req:FastifyRequest)=>Promise<Auth>;
  mutation:(req:FastifyRequest)=>Promise<Auth>;
  http:(status:number,code:string)=>never;
};
const json = (x:unknown): any => JSON.parse(JSON.stringify(x));
const uuid = z.uuid();
const workflowInput=z.strictObject({name:z.string().trim().min(3).max(90),draft:z.unknown()});
const draftInput=z.strictObject({expectedRevision:z.number().int().min(0),draft:z.unknown()});
const publishInput=z.strictObject({expectedRevision:z.number().int().min(0)});
const runInput=z.strictObject({
  input:z.record(z.string(),z.unknown()),
  versionId:uuid.optional()
});
const decisionInput=z.strictObject({decision:z.enum(["approved","rejected"])});

function labGraph(input:unknown,http:AuthBoundary["http"]){
  const checked=validateWorkflowGraph(input,DEMO_POLICY);
  if(!checked.ok) return http(422,"INVALID_LAB_GRAPH");
  if(checked.draft.nodes.some(n=>n.type==="ai.classify"||n.type==="http.request") ||
      checked.draft.nodes.filter(n=>n.type==="approval").length>1) {
    return http(422,"UNSUPPORTED_LAB_NODE");
  }
  return checked.draft;
}
function param(req:FastifyRequest,key:string,http:AuthBoundary["http"]):string {
  const raw=(req.params as Record<string,unknown> | undefined)?.[key];
  const result=uuid.safeParse(raw);
  if(!result.success) return http(400,"INVALID_ID");
  return result.data;
}
function payload(req:FastifyRequest, schema:typeof workflowInput, http:AuthBoundary["http"]):z.infer<typeof workflowInput>;
function payload(req:FastifyRequest, schema:typeof draftInput, http:AuthBoundary["http"]):z.infer<typeof draftInput>;
function payload(req:FastifyRequest, schema:typeof publishInput, http:AuthBoundary["http"]):z.infer<typeof publishInput>;
function payload(req:FastifyRequest, schema:typeof runInput, http:AuthBoundary["http"]):z.infer<typeof runInput>;
function payload(req:FastifyRequest, schema:typeof decisionInput, http:AuthBoundary["http"]):z.infer<typeof decisionInput>;
function payload(req:FastifyRequest, schema:z.ZodType, http:AuthBoundary["http"]):any {
  const result=schema.safeParse(req.body);
  if(!result.success) return http(422,"INVALID_LAB_BODY");
  return result.data;
}
export function registerLabRoutes(app:FastifyInstance,auth:AuthBoundary) {
  const http=auth.http;

  app.post("/v1/lab/workflows",async(req,reply)=>{
    const owner=await auth.mutation(req);
    const body=payload(req,workflowInput,http);
    const graph=labGraph(body.draft,http);
    const created=await db.labWorkflow.create({data:{
      id:randomUUID(),workspaceId:owner.workspaceId,
      name:body.name,draft:json(graph)
    }});
    reply.code(201);
    return {workflowId:created.id,name:created.name,
      draftRevision:created.draftRevision,publishedRevision:created.publishedRevision,
      draft:created.draft};
  });
  app.get("/v1/lab/workflows",async req=>{
    const owner=await auth.guest(req);
    return {items:await db.labWorkflow.findMany({
      where:{workspaceId:owner.workspaceId},orderBy:{createdAt:"desc"},
      select:{id:true,name:true,draftRevision:true,publishedRevision:true,
        versions:{select:{id:true,versionNo:true,publishedAt:true},
          orderBy:{versionNo:"desc"},take:1}}
    })};
  });
  app.get("/v1/lab/workflows/:workflowId",async req=>{
    const owner=await auth.guest(req);
    const workflowId=param(req,"workflowId",http);
    const item=await db.labWorkflow.findFirst({
      where:{id:workflowId,workspaceId:owner.workspaceId},
      include:{versions:{orderBy:{versionNo:"desc"},select:{
        id:true,versionNo:true,graphDigest:true,publishedAt:true
      }}}
    });
    if(!item)return http(404,"LAB_WORKFLOW_NOT_FOUND");
    return item;
  });
  app.put("/v1/lab/workflows/:workflowId/draft",async req=>{
    const owner=await auth.mutation(req);
    const workflowId=param(req,"workflowId",http);
    const body=payload(req,draftInput,http);
    const graph=labGraph(body.draft,http);
    const changed=await db.labWorkflow.updateMany({where:{
      id:workflowId,workspaceId:owner.workspaceId,draftRevision:body.expectedRevision
    },data:{draft:json(graph),draftRevision:{increment:1}}});
    if(changed.count!==1)return http(409,"LAB_REVISION_CONFLICT");
    const saved=await db.labWorkflow.findUniqueOrThrow({where:{id:workflowId}});
    return {workflowId,draftRevision:saved.draftRevision,draft:saved.draft};
  });
  app.post("/v1/lab/workflows/:workflowId/publish",async(req,reply)=>{
    const owner=await auth.mutation(req);
    const workflowId=param(req,"workflowId",http);
    const body=payload(req,publishInput,http);
    const published=await db.$transaction(async tx=>{
      const item=await tx.labWorkflow.findFirst({where:{
        id:workflowId,workspaceId:owner.workspaceId
      }});
      if(!item)return http(404,"LAB_WORKFLOW_NOT_FOUND");
      if(item.draftRevision!==body.expectedRevision ||
         item.publishedRevision>=body.expectedRevision) {
        return http(409,"LAB_REVISION_CONFLICT");
      }
      const graph=labGraph(item.draft,http);
      const claimed=await tx.labWorkflow.updateMany({where:{
        id:workflowId,workspaceId:owner.workspaceId,
        draftRevision:body.expectedRevision,publishedRevision:{lt:body.expectedRevision}
      },data:{publishedRevision:body.expectedRevision}});
      if(claimed.count!==1)return http(409,"LAB_REVISION_CONFLICT");
      const latest=await tx.labVersion.findFirst({
        where:{workflowId},orderBy:{versionNo:"desc"},select:{versionNo:true}
      });
      const nextVersion=(latest?.versionNo??0)+1;
      return tx.labVersion.create({data:{
        id:randomUUID(),workflowId,versionNo:nextVersion,graph:json(graph),
        graphDigest:createHash("sha256").update(JSON.stringify(graph)).digest("hex")
      }});
    });
    reply.code(201);
    return {workflowId,versionId:published.id,versionNo:published.versionNo,
      graphDigest:published.graphDigest,publishedAt:published.publishedAt};
  });
  app.post("/v1/lab/workflows/:workflowId/runs",async(req,reply)=>{
    const owner=await auth.mutation(req);
    const workflowId=param(req,"workflowId",http);
    const body=payload(req,runInput,http);
    if(JSON.stringify(body.input).length>4096)return http(422,"LAB_INPUT_TOO_LARGE");
    const key=req.headers["idempotency-key"];
    const eventId=typeof key==="string"&&uuid.safeParse(key).success?key:randomUUID();
    const prior=await db.labExecution.findUnique({where:{workspaceId_eventId:{
      workspaceId:owner.workspaceId,eventId
    }}});
    if(prior){reply.code(202);return {executionId:prior.id,status:prior.status,duplicate:true};}
    try {
      const created=await db.$transaction(async tx=>{
        const version=await tx.labVersion.findFirst({where:{
          ...(body.versionId?{id:body.versionId}:{}),
          workflow:{id:workflowId,workspaceId:owner.workspaceId}
        },orderBy:{versionNo:"desc"}});
        if(!version)return http(409,"LAB_NOT_PUBLISHED");
        // Validate the exact persisted version before reserving a run slot.
        labGraph(version.graph,http);
        const reserved=await tx.demoWorkspace.updateMany({where:{
          id:owner.workspaceId,expiresAt:{gt:new Date()},
          runsStarted:{lt:5},activeRuns:{lt:1}
        },data:{runsStarted:{increment:1},activeRuns:{increment:1}}});
        if(reserved.count!==1)return http(429,"DEMO_QUOTA_REACHED");
        const run=await tx.labExecution.create({data:{
          id:randomUUID(),workspaceId:owner.workspaceId,
          versionId:version.id,eventId,input:json(body.input),status:"queued"
        }});
        const queued=await boss.send(LAB_RUN,{executionId:run.id},{db:fromPrisma(tx)});
        if(!queued)throw new Error("Lab worker queue failed");
        return run;
      });
      reply.code(202);
      return {executionId:created.id,status:created.status,duplicate:false};
    }catch(error){
      const previous=await db.labExecution.findUnique({where:{
        workspaceId_eventId:{workspaceId:owner.workspaceId,eventId}
      }});
      if(previous){reply.code(202);return {
        executionId:previous.id,status:previous.status,duplicate:true
      };}
      throw error;
    }
  });
  app.get("/v1/lab/runs",async req=>{
    const owner=await auth.guest(req);
    return {items:await db.labExecution.findMany({
      where:{workspaceId:owner.workspaceId},orderBy:{createdAt:"desc"},take:30,
      select:{id:true,versionId:true,status:true,approvalNodeId:true,
        createdAt:true,updatedAt:true}
    })};
  });
  app.get("/v1/lab/runs/:executionId",async req=>{
    const owner=await auth.guest(req);
    const executionId=param(req,"executionId",http);
    const run=await db.labExecution.findFirst({
      where:{id:executionId,workspaceId:owner.workspaceId},
      include:{version:{select:{versionNo:true,workflowId:true,graphDigest:true}}}
    });
    if(!run)return http(404,"LAB_RUN_NOT_FOUND");
    return run;
  });
  app.post("/v1/lab/runs/:executionId/decision",async(req)=>{
    const owner=await auth.mutation(req);
    const executionId=param(req,"executionId",http);
    const body=payload(req,decisionInput,http);
    return db.$transaction(async tx=>{
      const run=await tx.labExecution.findFirst({where:{
        id:executionId,workspaceId:owner.workspaceId
      }});
      if(!run)return http(404,"LAB_RUN_NOT_FOUND");
      const moved=await tx.labExecution.updateMany({where:{
        id:executionId,workspaceId:owner.workspaceId,status:"waiting_approval"
      },data:{
        status:body.decision==="approved"?"queued":"cancelled",
        decision:body.decision,
        ...(body.decision==="rejected"?{trace:json([
          ...(Array.isArray(run.trace)?run.trace:[]),
          {nodeId:run.approvalNodeId??"approval",type:"approval",status:"rejected",
            message:"Human rejected: no local write committed"}
        ])}:{})
      }});
      if(moved.count!==1)return http(409,"LAB_DECISION_CONFLICT");
      if(body.decision==="approved"){
        const queued=await boss.send(LAB_RUN,{executionId},{db:fromPrisma(tx)});
        if(!queued)throw new Error("Lab resume failed");
      }else{
        await tx.demoWorkspace.updateMany({
          where:{id:owner.workspaceId,activeRuns:{gt:0}},
          data:{activeRuns:{decrement:1}}
        });
      }
      return {executionId,status:body.decision==="approved"?"queued":"cancelled",
        decision:body.decision};
    });
  });
  app.get("/v1/lab/records",async req=>{
    const owner=await auth.guest(req);
    return {items:await db.labRecord.findMany({where:{workspaceId:owner.workspaceId},
      orderBy:{updatedAt:"desc"},take:50})};
  });
}
