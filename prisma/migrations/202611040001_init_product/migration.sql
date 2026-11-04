CREATE TABLE "DemoWorkspace" (
  "id" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "runsStarted" INTEGER NOT NULL DEFAULT 0,
  "activeRuns" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DemoWorkspace_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DemoWorkspace_expiresAt_idx" ON "DemoWorkspace"("expiresAt");
CREATE TABLE "DemoSession" (
  "id" UUID NOT NULL, "workspaceId" UUID NOT NULL, "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoSession_tokenHash_key" ON "DemoSession"("tokenHash");
CREATE INDEX "DemoSession_workspaceId_idx" ON "DemoSession"("workspaceId");
ALTER TABLE "DemoSession" ADD CONSTRAINT "DemoSession_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "DemoVersion" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "graphDigest" TEXT NOT NULL,
  "graph" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DemoExecution" (
  "id" UUID NOT NULL,"workspaceId" UUID NOT NULL,"versionId" UUID NOT NULL,
  "eventId" TEXT NOT NULL,"leadId" TEXT NOT NULL,"priority" TEXT,"category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',"failOnce" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 0,"lastEventSeq" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoExecution_workspaceId_eventId_key" ON "DemoExecution"("workspaceId","eventId");
CREATE INDEX "DemoExecution_workspaceId_createdAt_idx" ON "DemoExecution"("workspaceId","createdAt");
ALTER TABLE "DemoExecution" ADD CONSTRAINT "DemoExecution_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemoExecution" ADD CONSTRAINT "DemoExecution_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "DemoVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "DemoEvent" (
  "id" UUID NOT NULL, "executionId" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,"nodeId" TEXT,"message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoEvent_executionId_sequence_key" ON "DemoEvent"("executionId","sequence");
CREATE INDEX "DemoEvent_executionId_createdAt_idx" ON "DemoEvent"("executionId","createdAt");
ALTER TABLE "DemoEvent" ADD CONSTRAINT "DemoEvent_executionId_fkey"
  FOREIGN KEY ("executionId") REFERENCES "DemoExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "DemoApproval" (
  "id" UUID NOT NULL,"executionId" UUID NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',
  "payloadDigest" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoApproval_executionId_key" ON "DemoApproval"("executionId");
ALTER TABLE "DemoApproval" ADD CONSTRAINT "DemoApproval_executionId_fkey"
  FOREIGN KEY ("executionId") REFERENCES "DemoExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "DemoAction" (
  "operationKey" TEXT NOT NULL,"executionId" UUID NOT NULL,"status" TEXT NOT NULL,
  CONSTRAINT "DemoAction_pkey" PRIMARY KEY ("operationKey")
);
ALTER TABLE "DemoAction" ADD CONSTRAINT "DemoAction_executionId_fkey"
  FOREIGN KEY ("executionId") REFERENCES "DemoExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "DemoCrm" (
  "id" UUID NOT NULL,"workspaceId" UUID NOT NULL,"externalKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,"priority" TEXT NOT NULL,"executionId" UUID NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoCrm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoCrm_workspaceId_externalKey_key" ON "DemoCrm"("workspaceId","externalKey");
ALTER TABLE "DemoCrm" ADD CONSTRAINT "DemoCrm_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
