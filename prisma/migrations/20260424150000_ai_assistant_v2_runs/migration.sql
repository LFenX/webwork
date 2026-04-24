-- AI assistant v2: persistent run timeline

CREATE TABLE "AIRun" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL DEFAULT '',
  "mode" TEXT NOT NULL DEFAULT 'self',
  "delegatedTargetUserId" TEXT,
  "plannerModel" TEXT NOT NULL DEFAULT '',
  "finalModel" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AIRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIRunStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary" TEXT NOT NULL DEFAULT '',
  "inputPreview" JSONB,
  "outputPreview" JSONB,
  "errorMessage" TEXT NOT NULL DEFAULT '',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AIRunStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIRun_messageId_key" ON "AIRun"("messageId");
CREATE INDEX "AIRun_conversationId_createdAt_idx" ON "AIRun"("conversationId", "createdAt");
CREATE INDEX "AIRun_userId_createdAt_idx" ON "AIRun"("userId", "createdAt");
CREATE INDEX "AIRun_delegatedTargetUserId_createdAt_idx" ON "AIRun"("delegatedTargetUserId", "createdAt");
CREATE INDEX "AIRunStep_runId_startedAt_idx" ON "AIRunStep"("runId", "startedAt");
CREATE INDEX "AIRunStep_messageId_startedAt_idx" ON "AIRunStep"("messageId", "startedAt");
CREATE INDEX "AIRunStep_userId_startedAt_idx" ON "AIRunStep"("userId", "startedAt");

ALTER TABLE "AIRun"
ADD CONSTRAINT "AIRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIRun"
ADD CONSTRAINT "AIRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIRun"
ADD CONSTRAINT "AIRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIRun"
ADD CONSTRAINT "AIRun_delegatedTargetUserId_fkey" FOREIGN KEY ("delegatedTargetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIRunStep"
ADD CONSTRAINT "AIRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AIRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIRunStep"
ADD CONSTRAINT "AIRunStep_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIRunStep"
ADD CONSTRAINT "AIRunStep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
