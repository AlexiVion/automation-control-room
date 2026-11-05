import { randomUUID, createHash } from "node:crypto";
import { boss, db, QUEUE, RESUME, initializeBoss, fromPrisma } from "../../../packages/runtime/src/db.js";
import { fixture, type FixtureId, ensureVersion } from "../../../packages/runtime/src/fixture.js";
import { appendEvent } from "../../../packages/runtime/src/events.js";

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
await db.$connect();
await ensureVersion();
await initializeBoss();
await boss.work(QUEUE,{pollingIntervalSeconds:0.5},async jobs=>{
  for(const job of jobs)await classify((job.data as {executionId:string}).executionId);
});
await boss.work(RESUME,{pollingIntervalSeconds:0.5},async jobs=>{
  for(const job of jobs)await continueAfterApproval((job.data as {executionId:string}).executionId);
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
