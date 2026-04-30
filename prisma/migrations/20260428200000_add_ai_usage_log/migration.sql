-- AIUsageLog: per-call token usage and latency log for the AI runtime.
-- Non-destructive: no existing tables are altered, no data is changed.
-- Logging is best-effort and must not affect chat behaviour even when this
-- table is missing (the runtime swallows errors).
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "runId" TEXT,
    "messageId" TEXT,
    "callType" TEXT NOT NULL DEFAULT 'chat',
    "providerLabel" TEXT NOT NULL DEFAULT '',
    "providerType" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "configSource" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "hasRealUsage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");
CREATE INDEX "AIUsageLog_model_createdAt_idx" ON "AIUsageLog"("model", "createdAt");
CREATE INDEX "AIUsageLog_providerLabel_createdAt_idx" ON "AIUsageLog"("providerLabel", "createdAt");
CREATE INDEX "AIUsageLog_configSource_createdAt_idx" ON "AIUsageLog"("configSource", "createdAt");
CREATE INDEX "AIUsageLog_conversationId_createdAt_idx" ON "AIUsageLog"("conversationId", "createdAt");
CREATE INDEX "AIUsageLog_runId_idx" ON "AIUsageLog"("runId");

ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AIRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
