import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgBoss } from "pg-boss";
import {
  BOSS_SCHEMA, QUEUE, approveOnce, commitLocalCrmEffect, connect,
  countJobsForEvent, countJobsForId, duplicateSafeIntake,
  recordUncertainExternalEffect, startExecution, uniqueEventId
} from "../src/spike.js";

const { prisma, boss } = connect();
const url = process.env.DATABASE_URL!;

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error("TIMED_OUT_WAITING_FOR_WORKER");
};

describe("Gate 4D — real PostgreSQL + Prisma7 + pg-boss12", () => {
  beforeAll(async () => {
    await prisma.$connect();
    await boss.start();
    await boss.createQueue(QUEUE, { retryLimit: 2, retryDelay: 0 });
  }, 35_000);
  afterAll(async () => {
    await boss.stop();
    await prisma.$disconnect();
  }, 25_000);

  it("commits Execution + Event + pg-boss job atomically through fromPrisma(tx)", async () => {
    const eventId = uniqueEventId();
    const { execution, jobId } = await startExecution(prisma, boss, "signed", eventId);
    expect((await prisma.spikeExecution.findUnique({ where: { id: execution.id } }))?.status).toBe("queued");
    expect(await prisma.spikeEvent.count({ where: { executionId: execution.id } })).toBe(1);
    expect(await countJobsForId(prisma, jobId)).toBe(1);
  }, 20_000);

  it("rolls back Execution + Event + queue job together on an application error", async () => {
    const eventId = uniqueEventId();
    await expect(startExecution(prisma, boss, "signed", eventId, true)).rejects.toThrow("INTENTIONAL_ROLLBACK");
    expect(await prisma.spikeExecution.count({ where: { sourceId: "signed", eventId } })).toBe(0);
    expect(await countJobsForEvent(prisma, eventId)).toBe(0);
  }, 20_000);

  it("returns one execution for duplicate intake, without adding another job", async () => {
    const eventId = uniqueEventId();
    const [first, second] = await Promise.all([
      duplicateSafeIntake(prisma, boss, "signed", eventId),
      duplicateSafeIntake(prisma, boss, "signed", eventId)
    ]);
    expect(first.executionId).toBe(second.executionId);
    expect([first.duplicate, second.duplicate].sort()).toEqual([false, true]);
    expect(await prisma.spikeExecution.count({ where: { sourceId: "signed", eventId } })).toBe(1);
    expect(await countJobsForEvent(prisma, eventId)).toBe(1);
  }, 30_000);

  it("only one of two competing approval decisions succeeds", async () => {
    const eventId = uniqueEventId();
    const { execution } = await startExecution(prisma, boss, "signed", eventId);
    const approval = await prisma.spikeApproval.create({ data: { executionId: execution.id } });
    const results = await Promise.all([
      approveOnce(prisma, approval.id, "approved"),
      approveOnce(prisma, approval.id, "rejected")
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const updated = await prisma.spikeApproval.findUniqueOrThrow({ where: { id: approval.id } });
    expect(updated.status).toMatch(/^(approved|rejected)$/);
    expect(await approveOnce(prisma, approval.id, "approved")).toBe(false);
  }, 25_000);

  it("persists queued work while no consumer runs and resumes when an independent worker starts", async () => {
    const eventId = uniqueEventId();
    const { execution } = await startExecution(prisma, boss, "signed", eventId);
    // No worker for QUEUE is registered until now: durable backlog across process availability.
    expect((await prisma.spikeExecution.findUnique({ where: { id: execution.id } }))?.status).toBe("queued");
    const workerBoss = new PgBoss({ connectionString: url, schema: BOSS_SCHEMA });
    workerBoss.on("error", error => console.error("worker spike:", error));
    await workerBoss.start();
    let workerId: string | undefined;
    try {
      workerId = await workerBoss.work(QUEUE, { pollingIntervalSeconds: 0.5 }, async jobs => {
        for (const job of jobs) {
          const { executionId } = job.data as { executionId: string };
          await commitLocalCrmEffect(prisma, executionId);
        }
      });
      await waitFor(async () => (await prisma.spikeExecution.findUnique({ where: { id: execution.id } }))?.status === "completed");
      expect(await prisma.spikeCrmRecord.count({ where: { externalKey: eventId } })).toBe(1);
      // Duplicate delivery with the same execution cannot create another CRM record or audit event.
      await boss.send(QUEUE, { executionId: execution.id, eventId });
      await waitFor(async () => {
        const jobs = await prisma.$queryRawUnsafe<Array<{ amount: number }>>(
          `SELECT count(*)::integer AS amount FROM ${BOSS_SCHEMA}.job WHERE data->>'eventId' = $1 AND state = 'completed'`, eventId
        );
        return (jobs[0]?.amount ?? 0) >= 2;
      });
      expect(await prisma.spikeCrmRecord.count({ where: { externalKey: eventId } })).toBe(1);
      expect(await prisma.spikeEvent.count({ where: { executionId: execution.id } })).toBe(2);
    } finally {
      if (workerId) await workerBoss.offWork(workerId);
      await workerBoss.stop();
    }
  }, 35_000);

  it("records an uncertain remote effect once and never blindly retries it", async () => {
    const eventId = uniqueEventId();
    const { execution } = await startExecution(prisma, boss, "signed", eventId);
    expect(await recordUncertainExternalEffect(prisma, execution.id)).toBe(true);
    expect(await recordUncertainExternalEffect(prisma, execution.id)).toBe(false);
    expect((await prisma.spikeExecution.findUniqueOrThrow({ where: { id: execution.id } })).status).toBe("needs_review");
    expect(await prisma.spikeAction.count({ where: { executionId: execution.id, status: "uncertain" } })).toBe(1);
    expect(await prisma.spikeCrmRecord.count({ where: { externalKey: eventId } })).toBe(0);
  }, 20_000);
});
