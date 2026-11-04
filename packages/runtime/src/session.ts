import { randomUUID } from "node:crypto";
import { createGuestSession, validateGuestSession, csrfToken, hashToken } from "../../security/src/sessions.js";
import { db } from "./db.js";
export const SESSION_TTL = 24 * 60 * 60 * 1000;
export const CSRF_KEY = (() => {
  const value = process.env.ACR_CSRF_SECRET;
  if (!value || value.length < 64 || !/^[a-f0-9]{64,}$/.test(value)) throw new Error("ACR_CSRF_SECRET requires 32+ bytes hex");
  return Buffer.from(value, "hex");
})();
export async function issueSession(nowMs = Date.now()) {
  const workspaceId = randomUUID(), sessionId = randomUUID();
  const issued = createGuestSession(nowMs, workspaceId, sessionId);
  await db.demoWorkspace.create({data:{
    id:workspaceId, expiresAt:new Date(nowMs+SESSION_TTL),
    sessions:{create:{
      id:sessionId, tokenHash:issued.record.tokenHash,
      lastSeenAt:new Date(nowMs),expiresAt:new Date(nowMs+SESSION_TTL)
    }}
  }});
  return { token: issued.token, workspaceId, csrf: csrfToken(CSRF_KEY,issued.record),
    expiresAt:new Date(nowMs+SESSION_TTL).toISOString() };
}
export async function resolveSession(token: string | undefined, nowMs=Date.now()) {
  if(!token)return null;
  let tokenHash: string;
  try{tokenHash=hashToken(token)}catch{return null;}
  const s=await db.demoSession.findUnique({where:{tokenHash},include:{workspace:true}});
  if(!s||s.workspace.expiresAt.getTime()<=nowMs)return null;
  const record={
    workspaceId:s.workspaceId,sessionId:s.id,tokenHash:s.tokenHash,
    createdAtMs:s.createdAt.getTime(),lastSeenAtMs:s.lastSeenAt.getTime(),
    absoluteExpiresAtMs:s.expiresAt.getTime()
  };
  if(!validateGuestSession(token,record,nowMs))return null;
  const touched=await db.demoSession.updateMany({
    where:{id:s.id,expiresAt:{gt:new Date(nowMs)},lastSeenAt:{lte:new Date(nowMs)}},
    data:{lastSeenAt:new Date(nowMs)}
  });
  return touched.count===1?{
    workspaceId:s.workspaceId,sessionId:s.id,csrf:csrfToken(CSRF_KEY,record),
    expiresAt:s.expiresAt.toISOString()
  }:null;
}
export async function budget(workspaceId:string) {
  const w=await db.demoWorkspace.findUniqueOrThrow({where:{id:workspaceId}});
  return {runsRemaining:Math.max(0,5-w.runsStarted),activeRuns:w.activeRuns,maxNodes:12,maxEdges:20};
}
