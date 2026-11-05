import { randomUUID } from "node:crypto";
import { Prisma } from "./db.js";
export async function appendEvent(
  tx: Prisma.TransactionClient, executionId:string, eventType:string,
  nodeId:string|null,message:string
) {
  const current=await tx.demoExecution.findUniqueOrThrow({
    where:{id:executionId},select:{lastEventSeq:true}
  });
  const sequence=current.lastEventSeq+1;
  await tx.demoEvent.create({data:{
    id:randomUUID(),executionId,sequence,eventType,nodeId,message:message.slice(0,280)
  }});
  await tx.demoExecution.update({where:{id:executionId},data:{lastEventSeq:sequence}});
}
