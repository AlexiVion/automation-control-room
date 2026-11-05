import { randomUUID } from "node:crypto";
import { createGuestSession, csrfToken, hashToken } from "../../security/src/sessions.js";
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
/**
 * Authenticate + refresh idle TTL in ONE atomic PostgreSQL statement.
 *
 * The previous implementation performed findUnique() followed by updateMany()
 * gated on a per-request JS Date.now(). Parallel browser requests (inspector,
 * CRM and SSE) could race; the losing request returned 401 SESSION_REQUIRED
 * even though the session remained valid. PostgreSQL now owns the clock and
 * serializes the row update; GREATEST prevents lastSeenAt moving backward.
 *
 * The opaque token is never stored or logged, only its SHA-256 hash.
 */
export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  let tokenHash: string;
  try { tokenHash = hashToken(token); } catch { return null; }

  type ActiveSession = {
    workspaceId: string;
    sessionId: string;
    tokenHash: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
  };
  const rows = await db.$queryRaw<ActiveSession[]>`
    UPDATE "DemoSession" AS s
    SET "lastSeenAt" = GREATEST(s."lastSeenAt", CURRENT_TIMESTAMP)
    FROM "DemoWorkspace" AS w
    WHERE s."tokenHash" = ${tokenHash}
      AND s."workspaceId" = w."id"
      -- The token hash plus idle/absolute expiration governs validity.
      -- Never reject solely because createdAt is slightly ahead of the DB clock:
      -- Windows Docker/Desktop clock corrections can move wall time backwards
      -- between issuing a new guest session and the very next HTTP request.
      -- Such a rejected brand-new cookie incorrectly returns SESSION_REQUIRED.
      -- Do NOT require lastSeenAt <= CURRENT_TIMESTAMP: a parallel request can
      -- commit a newer timestamp while this statement awaits the row lock.
      AND s."lastSeenAt" > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      AND s."expiresAt" > CURRENT_TIMESTAMP
      AND w."expiresAt" > CURRENT_TIMESTAMP
    RETURNING s."workspaceId" AS "workspaceId",
      s."id" AS "sessionId",
      s."tokenHash" AS "tokenHash",
      s."createdAt" AS "createdAt",
      s."lastSeenAt" AS "lastSeenAt",
      s."expiresAt" AS "expiresAt"
  `;
  const s = rows[0];
  if (!s) return null;
  const record = {
    workspaceId: s.workspaceId,
    sessionId: s.sessionId,
    tokenHash: s.tokenHash,
    createdAtMs: s.createdAt.getTime(),
    lastSeenAtMs: s.lastSeenAt.getTime(),
    absoluteExpiresAtMs: s.expiresAt.getTime()
  };
  return {
    workspaceId: s.workspaceId,
    sessionId: s.sessionId,
    csrf: csrfToken(CSRF_KEY, record),
    expiresAt: s.expiresAt.toISOString()
  };
}
export async function budget(workspaceId:string) {
  const w=await db.demoWorkspace.findUniqueOrThrow({where:{id:workspaceId}});
  return {runsRemaining:Math.max(0,5-w.runsStarted),activeRuns:w.activeRuns,maxNodes:12,maxEdges:20};
}
