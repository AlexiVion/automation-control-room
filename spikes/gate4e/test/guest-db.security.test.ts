import {describe,it,expect,afterAll,beforeAll} from "vitest";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../../gate4d/generated/prisma/client.js";
import {
  createDemoWorkspace,resolveDemoWorkspace,reserveGuestRun,completeGuestRun,
  upsertScopedCrm,readScopedCrm,purgeExpiredDemoWorkspaces
} from "../src/guest-store.js";

const connectionString=process.env.DATABASE_URL;
if(!connectionString || !["localhost","127.0.0.1"].includes(new URL(connectionString).hostname))
  throw new Error("Only disposable local PostgreSQL is permitted for Gate 4E");
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString})});
const t=Date.now();
describe("Gate 4E — real DB guest scoping, quotas, expiry and cleanup",()=>{
  beforeAll(()=>prisma.$connect());
  afterAll(()=>prisma.$disconnect());

  it("cannot read/write a synthetic CRM record using another authenticated workspace",async()=>{
    const a=await createDemoWorkspace(prisma,t),b=await createDemoWorkspace(prisma,t);
    expect(await resolveDemoWorkspace(prisma,a.token,t+100)).toEqual({
      workspaceId:a.workspaceId,sessionId:a.sessionId
    });
    expect(await resolveDemoWorkspace(prisma,b.token,t+100)).toEqual({
      workspaceId:b.workspaceId,sessionId:b.sessionId
    });
    await upsertScopedCrm(prisma,a.workspaceId,"lead-001","privateA",t+100);
    expect((await readScopedCrm(prisma,a.workspaceId,"lead-001",t+200))?.value).toBe("privateA");
    expect(await readScopedCrm(prisma,b.workspaceId,"lead-001",t+200)).toBeNull();
    await upsertScopedCrm(prisma,b.workspaceId,"lead-001","privateB",t+200);
    expect((await readScopedCrm(prisma,a.workspaceId,"lead-001",t+300))?.value).toBe("privateA");
    expect((await readScopedCrm(prisma,b.workspaceId,"lead-001",t+300))?.value).toBe("privateB");
  });

  it("two concurrent run claims admit at most one active execution",async()=>{
    const a=await createDemoWorkspace(prisma,t);
    const results=await Promise.all([
      reserveGuestRun(prisma,a.workspaceId,t+100),
      reserveGuestRun(prisma,a.workspaceId,t+100)
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await prisma.spikeWorkspace.findUniqueOrThrow({where:{id:a.workspaceId}})).runsStarted).toBe(1);
    expect((await prisma.spikeWorkspace.findUniqueOrThrow({where:{id:a.workspaceId}})).activeRuns).toBe(1);
    expect(await completeGuestRun(prisma,a.workspaceId)).toBe(true);
    expect(await completeGuestRun(prisma,a.workspaceId)).toBe(false);
  });
  it("fifth allowed start succeeds and sixth is rejected atomically",async()=>{
    const a=await createDemoWorkspace(prisma,t);
    for(let i=1;i<=5;i++){
      expect(await reserveGuestRun(prisma,a.workspaceId,t+100)).toBe(true);
      expect(await completeGuestRun(prisma,a.workspaceId)).toBe(true);
    }
    expect(await reserveGuestRun(prisma,a.workspaceId,t+100)).toBe(false);
    expect((await prisma.spikeWorkspace.findUniqueOrThrow({where:{id:a.workspaceId}})).runsStarted).toBe(5);
  });

  it("expired session cannot be resolved or read even before background cleanup",async()=>{
    const a=await createDemoWorkspace(prisma,t);
    await upsertScopedCrm(prisma,a.workspaceId,"lead-expired","synthetic",t+100);
    expect(await resolveDemoWorkspace(prisma,a.token,t+30*60*1000)).toBeNull();
    expect(await resolveDemoWorkspace(prisma,a.token,t+24*3600*1000)).toBeNull();
    expect(await readScopedCrm(prisma,a.workspaceId,"lead-expired",t+24*3600*1000)).toBeNull();
    expect(await reserveGuestRun(prisma,a.workspaceId,t+24*3600*1000)).toBe(false);
    const purged=await purgeExpiredDemoWorkspaces(prisma,t+24*3600*1000);
    expect(purged.count).toBeGreaterThan(0);
    expect(await prisma.spikeGuestSession.findUnique({where:{id:a.sessionId}})).toBeNull();
    expect(await prisma.spikeScopedCrmRecord.findUnique({
      where:{workspaceId_externalKey:{workspaceId:a.workspaceId,externalKey:"lead-expired"}}
    })).toBeNull();
  });
});
