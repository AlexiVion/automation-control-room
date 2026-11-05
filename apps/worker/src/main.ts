import { randomUUID, createHash } from "node:crypto";
import { boss, db, QUEUE, RESUME, LAB_RUN, initializeBoss, fromPrisma } from "../../../packages/runtime/src/db.js";
import { fixture, type FixtureId, ensureVersion } from "../../../packages/runtime/src/fixture.js";
import { appendEvent } from "../../../packages/runtime/src/events.js";
import { previewLabWorkflow } from "../../../packages/runtime/src/lab-interpreter.js";

async function classify(executionId:string) {
  await db.$transaction(async tx=>{
    const e=await tx.demoExecution.findUniqueOrThrow({where:{id:executionId}});
    const claimed=await tx.demoExecution.updateMany({
      where:{id:executionId,status:"queued"},data:{status:"running"}
    });
    if(claimed.count!==1)return;
    const lead=fixture(e.leadId as FixtureId);
    await appendEvent(tx,e.id,"step.started","source","Entrada sintética recibida");
    await appendEvent(tx,e.id,"fixture.classified","classify",
      "Clasificación determinista: "+lead.category+" / "+lead.priority);
    await tx.demoExecution.update({where:{id:e.id},data:{
      category:lead.category,priority:lead.priority
    }});
    await appendEvent(tx,e.id,"condition.evaluated","branch",
      lead.priority==="high"?"Rama true · necesita aprobación":"Rama false · finaliza sin CRM");
    if(lead.priority==="high"){
      const digest=createHash("sha256").update(JSON.stringify({
        workspaceId:e.workspaceId,executionId:e.id,leadId:e.leadId,
        priority:lead.priority,category:lead.category
      })).digest("hex");
      await tx.demoApproval.create({data:{
        id:randomUUID(),executionId:e.id,status:"pending",
        payloadDigest:digest,expiresAt:new Date(Date.now()+10*60_000)
      }});
      await tx.demoExecution.update({where:{id:e.id},data:{status:"waiting_approval"}});
      await appendEvent(tx,e.id,"approval.requested","approval","Esperando aprobación humana");
    }else{
      await tx.demoExecution.update({where:{id:e.id},data:{status:"completed"}});
      await appendEvent(tx,e.id,"step.skipped","crm","Rama de CRM no seleccionada");
      await appendEvent(tx,e.id,"execution.completed","done_low","Finalizado sin escribir CRM");
      await tx.demoWorkspace.updateMany({
        where:{id:e.workspaceId,activeRuns:{gt:0}},data:{activeRuns:{decrement:1}}
      });
    }
  });
}

async function continueAfterApproval(executionId:string) {
  await db.$transaction(async tx=>{
    const e=await tx.demoExecution.findUniqueOrThrow({
      where:{id:executionId},include:{approval:true}
    });
    if(e.approval?.status!=="approved"||!["queued","retrying"].includes(e.status))return;
    const claim=await tx.demoExecution.updateMany({
      where:{id:e.id,status:{in:["queued","retrying"]}},data:{status:"running"}
    });
    if(claim.count!==1)return;
    if(e.failOnce){
      await tx.demoExecution.update({where:{id:e.id},data:{
        failOnce:false,status:"retrying",attempts:{increment:1}
      }});
      await appendEvent(tx,e.id,"step.retry_scheduled","crm",
        "Fallo transitorio sintético · reintento seguro programado");
      const queued=await boss.send(RESUME,{executionId:e.id},{db:fromPrisma(tx)});
      if(!queued)throw new Error("Failed to enqueue CRM retry");
      return;
    }
    const operationKey="demo:"+e.id+":crm";
    await tx.demoCrm.upsert({
      where:{workspaceId_externalKey:{workspaceId:e.workspaceId,externalKey:e.leadId}},
      create:{
        id:randomUUID(),workspaceId:e.workspaceId,externalKey:e.leadId,
        category:e.category!,priority:e.priority!,executionId:e.id
      },
      update:{category:e.category!,priority:e.priority!,executionId:e.id}
    });
    await tx.demoAction.upsert({
      where:{operationKey},
      create:{operationKey,executionId:e.id,status:"confirmed"},
      update:{}
    });
    await tx.demoExecution.update({where:{id:e.id},data:{
      status:"completed",attempts:{increment:1}
    }});
    await appendEvent(tx,e.id,"crm.confirmed","crm","Un registro confirmado en PostgreSQL");
    await appendEvent(tx,e.id,"execution.completed","done_high","Proceso finalizado");
    await tx.demoWorkspace.updateMany({
      where:{id:e.workspaceId,activeRuns:{gt:0}},data:{activeRuns:{decrement:1}}
    });
  });
}
async function expireApprovals() {
  const overdue=await db.demoApproval.findMany({where:{
    status:"pending",expiresAt:{lte:new Date()}
  },take:50});
  for(const approval of overdue){
    await db.$transaction(async tx=>{
      const changed=await tx.demoApproval.updateMany({where:{
        id:approval.id,status:"pending",expiresAt:{lte:new Date()}
      },data:{status:"expired",decidedAt:new Date()}});
      if(changed.count!==1)return;
      const e=await tx.demoExecution.findUniqueOrThrow({where:{id:approval.executionId}});
      if(e.status!=="waiting_approval")return;
      await tx.demoExecution.update({where:{id:e.id},data:{status:"cancelled"}});
      await appendEvent(tx,e.id,"approval.expired","approval","Aprobación caducada");
      await appendEvent(tx,e.id,"execution.cancelled","done_high","Sin modificación CRM");
      await tx.demoWorkspace.updateMany({
        where:{id:e.workspaceId,activeRuns:{gt:0}},data:{activeRuns:{decrement:1}}
      });
    });
  }
}

/**
 * The LAB worker executes the exact immutable LabVersion graph that was
 * published by the user. Distinct from the legacy hardcoded lead worker.
 * One PostgreSQL transaction contains claim, decisions and local writes:
 * a worker crash cannot acknowledge an uncommitted side effect.
 */
async function runUserGraph(executionId: string) {
  try {
    await db.$transaction(async tx=>{
      const run=await tx.labExecution.findUnique({
        where:{id:executionId},include:{version:true}
      });
      if(!run)return;
      const claimed=await tx.labExecution.updateMany({
        where:{id:run.id,status:"queued"},data:{status:"running"}
      });
      if(claimed.count!==1)return;
      const decided=run.decision==="approved"?"approved":
        run.decision==="rejected"?"rejected":undefined;
      const result=previewLabWorkflow(run.version.graph,run.input,decided);
      if(result.status==="waiting_approval"){
        await tx.labExecution.update({where:{id:run.id},data:{
          status:"waiting_approval",
          approvalNodeId:result.nextApproval?.nodeId??null,
          approvalReason:result.nextApproval?.reason??null,
          trace:JSON.parse(JSON.stringify(result.trace))
        }});
        return;
      }
      const confirmedTrace=result.trace.map(step=>({...step}));
      for(const intent of result.plannedActions){
        const record=intent.record;
        await tx.labRecord.upsert({
          where:{workspaceId_externalKey:{
            workspaceId:run.workspaceId,externalKey:record.leadId
          }},
          create:{
            id:randomUUID(),workspaceId:run.workspaceId,
            externalKey:record.leadId,category:record.category,
            priority:record.priority,executionId:run.id
          },
          update:{
            category:record.category,priority:record.priority,executionId:run.id
          }
        });
        const step=confirmedTrace.find(x=>x.nodeId===intent.nodeId);
        if(step){
          step.status="executed";
          step.message="Local record committed in PostgreSQL";
        }
      }
      await tx.labExecution.update({where:{id:run.id},data:{
        status:result.status,
        trace:JSON.parse(JSON.stringify(confirmedTrace))
      }});
      await tx.demoWorkspace.updateMany({
        where:{id:run.workspaceId,activeRuns:{gt:0}},
        data:{activeRuns:{decrement:1}}
      });
    });
  }catch(error){
    // On a deterministic domain failure, release the local demo run slot and
    // record an explicit failure. This never replays committed writes: the
    // original transaction already rolled back atomically.
    const problem=error instanceof Error?error.message:String(error);
    console.error("Workflow Lab execution failed",executionId,problem);
    await db.$transaction(async tx=>{
      const changed=await tx.labExecution.updateMany({
        where:{id:executionId,status:"queued"},data:{status:"failed"}
      });
      if(changed.count){
        const run=await tx.labExecution.findUniqueOrThrow({where:{id:executionId}});
        await tx.labExecution.update({where:{id:executionId},data:{
          trace:[{nodeId:"runtime",type:"finish",status:"rejected",
            message:"Execution failed validation or safe processing"}]
        }});
        await tx.demoWorkspace.updateMany({
          where:{id:run.workspaceId,activeRuns:{gt:0}},
          data:{activeRuns:{decrement:1}}
        });
      }
    });
    // Leave a handled, visibly failed run rather than infinite queue retries.
  }
}

await db.$connect();
await ensureVersion();
await initializeBoss();
await boss.work(QUEUE,{pollingIntervalSeconds:0.5},async jobs=>{
  for(const job of jobs)await classify((job.data as {executionId:string}).executionId);
});
await boss.work(RESUME,{pollingIntervalSeconds:0.5},async jobs=>{
  for(const job of jobs)await continueAfterApproval((job.data as {executionId:string}).executionId);
});
await boss.work(LAB_RUN,{pollingIntervalSeconds:0.5},async jobs=>{
  for(const job of jobs)await runUserGraph((job.data as {executionId:string}).executionId);
});
const ticker=setInterval(async()=>{
  try{
    await expireApprovals();
    await db.demoWorkspace.deleteMany({where:{expiresAt:{lte:new Date()}}});
  }catch(error){console.error("Demo maintenance failed",error);}
},30_000);
console.log("ACR demo worker ready · PostgreSQL and pg-boss");
const stop=async()=>{
  clearInterval(ticker);
  await boss.stop();
  await db.$disconnect();
  process.exit(0);
};
process.once("SIGTERM",()=>{void stop()});
process.once("SIGINT",()=>{void stop()});
