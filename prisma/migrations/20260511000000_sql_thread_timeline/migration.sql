-- SQL Lab Stage Thread timeline

CREATE TABLE "SqlThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新分析',
    "titleLocked" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT NOT NULL DEFAULT '',
    "modelName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlThreadStep" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "title" TEXT NOT NULL DEFAULT '',
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "sql" TEXT NOT NULL DEFAULT '',
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SqlThreadStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SqlThread_userId_archivedAt_lastEventAt_idx"
    ON "SqlThread"("userId", "archivedAt", "lastEventAt");
CREATE INDEX "SqlThread_userId_updatedAt_idx"
    ON "SqlThread"("userId", "updatedAt");

CREATE UNIQUE INDEX "SqlThreadStep_threadId_orderIndex_key"
    ON "SqlThreadStep"("threadId", "orderIndex");
CREATE INDEX "SqlThreadStep_threadId_createdAt_idx"
    ON "SqlThreadStep"("threadId", "createdAt");
CREATE INDEX "SqlThreadStep_userId_createdAt_idx"
    ON "SqlThreadStep"("userId", "createdAt");

ALTER TABLE "SqlThread"
    ADD CONSTRAINT "SqlThread_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SqlThreadStep"
    ADD CONSTRAINT "SqlThreadStep_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "SqlThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SqlThreadStep"
    ADD CONSTRAINT "SqlThreadStep_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link audit logs to thread / step so executions are replayable.
ALTER TABLE "SqlAuditLog"
    ADD COLUMN "threadId" TEXT,
    ADD COLUMN "threadStepId" TEXT;

CREATE INDEX "SqlAuditLog_threadId_idx" ON "SqlAuditLog"("threadId");

ALTER TABLE "SqlAuditLog"
    ADD CONSTRAINT "SqlAuditLog_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "SqlThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SqlAuditLog"
    ADD CONSTRAINT "SqlAuditLog_threadStepId_fkey"
    FOREIGN KEY ("threadStepId") REFERENCES "SqlThreadStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
