-- Workflow Lab P0: isolated, versioned graph execution. No legacy demo tables changed.
CREATE TABLE "LabWorkflow" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "draft" JSONB NOT NULL,
  "draftRevision" INTEGER NOT NULL DEFAULT 0,
  "publishedRevision" INTEGER NOT NULL DEFAULT -1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabWorkflow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LabWorkflow_workspaceId_createdAt_idx"
  ON "LabWorkflow"("workspaceId", "createdAt");
ALTER TABLE "LabWorkflow" ADD CONSTRAINT "LabWorkflow_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LabVersion" (
  "id" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "graphDigest" TEXT NOT NULL,
  "graph" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LabVersion_workflowId_versionNo_key"
  ON "LabVersion"("workflowId", "versionNo");
ALTER TABLE "LabVersion" ADD CONSTRAINT "LabVersion_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "LabWorkflow"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LabExecution" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "eventId" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "decision" TEXT,
  "approvalNodeId" TEXT,
  "approvalReason" TEXT,
  "trace" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LabExecution_workspaceId_eventId_key"
  ON "LabExecution"("workspaceId", "eventId");
CREATE INDEX "LabExecution_workspaceId_createdAt_idx"
  ON "LabExecution"("workspaceId", "createdAt");
ALTER TABLE "LabExecution" ADD CONSTRAINT "LabExecution_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabExecution" ADD CONSTRAINT "LabExecution_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "LabVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LabRecord" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "externalKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "executionId" UUID NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LabRecord_workspaceId_externalKey_key"
  ON "LabRecord"("workspaceId", "externalKey");
ALTER TABLE "LabRecord" ADD CONSTRAINT "LabRecord_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "DemoWorkspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
