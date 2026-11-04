import {randomUUID} from "node:crypto";
import {PrismaClient} from "../../gate4d/generated/prisma/client.js";
import {
  createGuestSession, hashToken, validateGuestSession
} from "../../../packages/security/src/sessions.js";

type DB = PrismaClient;
const DAY = 24 * 3600 * 1000;

/** Isolated DB spike, not Fastify middleware. No user-controlled workspace ID is accepted. */
export async function createDemoWorkspace(db: DB, nowMs: number) {
  const workspaceId=randomUUID(), sessionId=randomUUID();
  const issued=createGuestSession(nowMs,workspaceId,sessionId);
  await db.$transaction(async tx=>{
    await tx.spikeWorkspace.create({data:{
      id:workspaceId,mode:"demo",createdAt:new Date(nowMs),expiresAt:new Date(nowMs+DAY)
    }});
    await tx.spikeGuestSession.create({data:{
      id:sessionId,workspaceId,tokenHash:issued.record.tokenHash,
      createdAt:new Date(nowMs),lastSeenAt:new Date(nowMs),expiresAt:new Date(nowMs+DAY)
    }});
  });
  return {workspaceId,sessionId,token:issued.token};
}
export async function resolveDemoWorkspace(db: DB, token: string, nowMs: number) {
  let tokenHash: string;
  try {tokenHash=hashToken(token);} catch {return null;}
  const session=await db.spikeGuestSession.findUnique({
    where:{tokenHash},include:{workspace:true}
  });
  if(!session || session.workspace.mode!=="demo" ||
     session.workspace.expiresAt.getTime()<=nowMs ||
     !validateGuestSession(token,{
       workspaceId:session.workspaceId,sessionId:session.id,
       tokenHash:session.tokenHash,createdAtMs:session.createdAt.getTime(),
       lastSeenAtMs:session.lastSeenAt.getTime(),absoluteExpiresAtMs:session.expiresAt.getTime()
     },nowMs))return null;
  // Active sessions extend only the idle deadline, never the absolute 24-hour deadline.
  const refreshed=await db.spikeGuestSession.updateMany({
    where:{id:session.id,expiresAt:{gt:new Date(nowMs)},lastSeenAt:{lte:new Date(nowMs)}},
    data:{lastSeenAt:new Date(nowMs)}
  });
  if(refreshed.count!==1)return null;
  return {workspaceId:session.workspaceId,sessionId:session.id};
}
/** DB atomic conditional increment prevents a concurrent guest execution limit bypass. */
export async function reserveGuestRun(db: DB, workspaceId: string, nowMs: number) {
  const result=await db.spikeWorkspace.updateMany({
    where:{
      id:workspaceId,mode:"demo",expiresAt:{gt:new Date(nowMs)},
      runsStarted:{lt:5},activeRuns:{lt:1}
    },
    data:{runsStarted:{increment:1},activeRuns:{increment:1}}
  });
  return result.count===1;
}
export async function completeGuestRun(db: DB, workspaceId: string) {
  return (await db.spikeWorkspace.updateMany({
    where:{id:workspaceId,mode:"demo",activeRuns:{gt:0}},
    data:{activeRuns:{decrement:1}}
  })).count===1;
}
/** The caller must derive workspaceId from resolveDemoWorkspace, never request JSON. */
export async function readScopedCrm(db: DB, workspaceId: string, externalKey: string, nowMs: number) {
  const workspace=await db.spikeWorkspace.findFirst({
    where:{id:workspaceId,mode:"demo",expiresAt:{gt:new Date(nowMs)}},select:{id:true}
  });
  if(!workspace)return null;
  return db.spikeScopedCrmRecord.findUnique({
    where:{workspaceId_externalKey:{workspaceId,externalKey}}
  });
}
/** CAS/DB unique keys enforce scope on every write. */
export async function upsertScopedCrm(db: DB, workspaceId: string, externalKey: string, value: string, nowMs: number) {
  return db.$transaction(async tx=>{
    const scope=await tx.spikeWorkspace.findFirst({
      where:{id:workspaceId,mode:"demo",expiresAt:{gt:new Date(nowMs)}},select:{id:true}
    });
    if(!scope) throw new Error("GUEST_WORKSPACE_EXPIRED");
    return tx.spikeScopedCrmRecord.upsert({
      where:{workspaceId_externalKey:{workspaceId,externalKey}},
      create:{workspaceId,externalKey,value},update:{value}
    });
  });
}
/** Real deployed cleanup would require a scheduled worker and bounded batches. */
export async function purgeExpiredDemoWorkspaces(db: DB, nowMs: number) {
  return db.spikeWorkspace.deleteMany({where:{mode:"demo",expiresAt:{lte:new Date(nowMs)}}});
}
