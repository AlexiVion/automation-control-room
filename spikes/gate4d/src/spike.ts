import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PgBoss, fromPrisma } from "pg-boss";
import { PrismaClient } from "../generated/prisma/client.js";

export const QUEUE = "acr-gate4d-execution";
export const RESUME_QUEUE = "acr-gate4d-resume";
export const CRASH_QUEUE = "acr-gate4d-crash";
export const BOSS_SCHEMA = "acr_gate4d_jobs";

export function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/localhost|127\.0\.0\.1/.test(new URL(connectionString).hostname)) {
    throw new Error("Gate 4D spike accepts only local PostgreSQL; never connect production DB");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const boss = new PgBoss({ connectionString, schema: BOSS_SCHEMA, superviseIntervalSeconds: 2, monitorIntervalSeconds: 2 });
  boss.on("error", (err) => { console.error("pg-boss spike:", err); });
  return { prisma, boss };
}

type Database = ReturnType<typeof connect>["prisma"];
type Boss = ReturnType<typeof connect>["boss"];

export async function startExecution(prisma: Database, boss: Boss, sourceId: string, eventId: string, shouldRollback = false) {
  let jobId: string | null = null;
  const execution = await prisma.$transaction(async tx => {
    const created = await tx.spikeExecution.create({ data: { sourceId, eventId } });
    await tx.spikeEvent.create({ data: { executionId: created.id, sequence: 1, eventType: "queued" } });
    jobId = await boss.send(QUEUE, { executionId: created.id, eventId }, { db: fromPrisma(tx) });
    if (!jobId) throw new Error("pg-boss did not return job ID");
    if (shouldRollback) throw new Error("INTENTIONAL_ROLLBACK");
    return created;
  });
  return { execution, jobId: jobId! };
}

export async function duplicateSafeIntake(prisma: Database, boss: Boss, sourceId: string, eventId: string) {
  // The unique database constraint is authoritative, not a check-then-create race.
  try {
    const created = await startExecution(prisma, boss, sourceId, eventId);
    return { executionId: created.execution.id, duplicate: false };
  } catch (error) {
    const existing = await prisma.spikeExecution.findUnique({ where: { sourceId_eventId: { sourceId, eventId } } });
    if (existing) return { executionId: existing.id, duplicate: true };
    throw error;
  }
}

export async function approveOnce(prisma: Database, approvalId: string, decision: "approved" | "rejected") {
  const updated = await prisma.spikeApproval.updateMany({
    where: { id: approvalId, status: "pending" },
    data: { status: decision }
  });
  return updated.count === 1;
}

export async function commitLocalCrmEffect(prisma: Database, executionId: string) {
  // A small idempotent LOCAL DB effect, not an external HTTP exactly-once claim.
  return prisma.$transaction(async tx => {
    const execution = await tx.spikeExecution.findUniqueOrThrow({ where: { id: executionId } });
    if (execution.status === "completed" || execution.status === "needs_review") return false;
    const operationKey = `spike:${executionId}:crm`;
    await tx.spikeCrmRecord.upsert({
      where: { externalKey: execution.eventId },
      create: { externalKey: execution.eventId, executionId },
      update: {}
    });
    await tx.spikeAction.upsert({
      where: { operationKey },
      create: { operationKey, executionId, status: "confirmed" },
      update: {}
    });
    await tx.spikeExecution.update({
      where: { id: executionId }, data: { status: "completed", attempts: { increment: 1 } }
    });
    await tx.spikeEvent.create({ data: { executionId, sequence: 2, eventType: "crm.confirmed" } });
    return true;
  });
}

export async function recordUncertainExternalEffect(prisma: Database, executionId: string) {
  // An unknown remote outcome is NOT safe for automatic replay.
  return prisma.$transaction(async tx => {
    const execution = await tx.spikeExecution.findUniqueOrThrow({ where: { id: executionId } });
    if (execution.status === "needs_review" || execution.status === "completed") return false;
    await tx.spikeAction.create({
      data: { operationKey: `spike:${executionId}:remote`, executionId, status: "uncertain" }
    });
    await tx.spikeExecution.update({ where: { id: executionId }, data: { status: "needs_review" } });
    await tx.spikeEvent.create({ data: { executionId, sequence: 2, eventType: "effect.uncertain" } });
    return true;
  });
}

export async function countJobsForId(prisma: Database, jobId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ amount: number }>>(
    `SELECT count(*)::integer AS amount FROM ${BOSS_SCHEMA}.job WHERE id::text = $1`, jobId
  );
  return rows[0]?.amount ?? 0;
}
export async function countJobsForEvent(prisma: Database, eventId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ amount: number }>>(
    `SELECT count(*)::integer AS amount FROM ${BOSS_SCHEMA}.job WHERE data->>'eventId' = $1`, eventId
  );
  return rows[0]?.amount ?? 0;
}
export const uniqueEventId = () => randomUUID();

/**
 * Durable approval resume: approval decision, execution transition, event and
 * pg-boss continuation command are committed as one Prisma transaction.
 */
export async function approveAndQueueResume(
  prisma: Database, boss: Boss, approvalId: string, shouldRollback = false
) {
  return prisma.$transaction(async tx => {
    const approval = await tx.spikeApproval.findUniqueOrThrow({ where: { id: approvalId } });
    const decided = await tx.spikeApproval.updateMany({
      where: { id: approvalId, status: "pending" },
      data: { status: "approved" }
    });
    if (decided.count !== 1) return { accepted: false, jobId: null };
    const moved = await tx.spikeExecution.updateMany({
      where: { id: approval.executionId, status: "waiting_approval" },
      data: { status: "queued" }
    });
    if (moved.count !== 1) throw new Error("APPROVAL_STATE_CONFLICT");
    const jobId = await boss.send(
      RESUME_QUEUE,
      { approvalId, executionId: approval.executionId },
      { db: fromPrisma(tx) }
    );
    if (!jobId) throw new Error("RESUME_JOB_MISSING");
    await tx.spikeEvent.create({ data: {
      executionId: approval.executionId, sequence: 2, eventType: "approval.approved"
    } });
    if (shouldRollback) throw new Error("INTENTIONAL_APPROVAL_ROLLBACK");
    return { accepted: true, jobId };
  });
}
export async function countResumeJobs(prisma: Database, approvalId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ amount: number }>>(
    `SELECT count(*)::integer AS amount FROM ${BOSS_SCHEMA}.job WHERE name = $1 AND data->>'approvalId' = $2`,
    RESUME_QUEUE, approvalId
  );
  return rows[0]?.amount ?? 0;
}
