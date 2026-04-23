ALTER TABLE "AdminPermission"
ADD COLUMN "manageAI" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "reasoningSummary" TEXT NOT NULL DEFAULT '',
    "toolTraceSummary" TEXT NOT NULL DEFAULT '',
    "modelName" TEXT NOT NULL DEFAULT '',
    "providerSource" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIUserProviderConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'openai-compatible',
    "providerLabel" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "apiKeyMask" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "streamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUserProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AIAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIUsageGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "providerLabel" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "apiKeyMask" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "streamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AIUsageGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIToolCallLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolInputJson" JSONB NOT NULL,
    "toolResultJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AIToolCallLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");
CREATE INDEX "AIConversation_userId_deletedAt_lastMessageAt_idx" ON "AIConversation"("userId", "deletedAt", "lastMessageAt");

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");
CREATE INDEX "AIMessage_userId_createdAt_idx" ON "AIMessage"("userId", "createdAt");

CREATE UNIQUE INDEX "AIUserProviderConfig_userId_key" ON "AIUserProviderConfig"("userId");

CREATE INDEX "AIAccessRequest_userId_createdAt_idx" ON "AIAccessRequest"("userId", "createdAt");
CREATE INDEX "AIAccessRequest_status_createdAt_idx" ON "AIAccessRequest"("status", "createdAt");
CREATE INDEX "AIAccessRequest_reviewedById_reviewedAt_idx" ON "AIAccessRequest"("reviewedById", "reviewedAt");

CREATE UNIQUE INDEX "AIUsageGrant_userId_key" ON "AIUsageGrant"("userId");
CREATE INDEX "AIUsageGrant_status_updatedAt_idx" ON "AIUsageGrant"("status", "updatedAt");
CREATE INDEX "AIUsageGrant_grantedById_createdAt_idx" ON "AIUsageGrant"("grantedById", "createdAt");
CREATE INDEX "AIUsageGrant_updatedById_updatedAt_idx" ON "AIUsageGrant"("updatedById", "updatedAt");

CREATE INDEX "AIToolCallLog_conversationId_startedAt_idx" ON "AIToolCallLog"("conversationId", "startedAt");
CREATE INDEX "AIToolCallLog_messageId_startedAt_idx" ON "AIToolCallLog"("messageId", "startedAt");
CREATE INDEX "AIToolCallLog_userId_startedAt_idx" ON "AIToolCallLog"("userId", "startedAt");

CREATE INDEX "AIAuditLog_actorId_createdAt_idx" ON "AIAuditLog"("actorId", "createdAt");
CREATE INDEX "AIAuditLog_targetUserId_createdAt_idx" ON "AIAuditLog"("targetUserId", "createdAt");
CREATE INDEX "AIAuditLog_action_createdAt_idx" ON "AIAuditLog"("action", "createdAt");

ALTER TABLE "AIConversation"
ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIMessage"
ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage"
ADD CONSTRAINT "AIMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIUserProviderConfig"
ADD CONSTRAINT "AIUserProviderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAccessRequest"
ADD CONSTRAINT "AIAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIAccessRequest"
ADD CONSTRAINT "AIAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIUsageGrant"
ADD CONSTRAINT "AIUsageGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageGrant"
ADD CONSTRAINT "AIUsageGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIUsageGrant"
ADD CONSTRAINT "AIUsageGrant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIToolCallLog"
ADD CONSTRAINT "AIToolCallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIToolCallLog"
ADD CONSTRAINT "AIToolCallLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIToolCallLog"
ADD CONSTRAINT "AIToolCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIAuditLog"
ADD CONSTRAINT "AIAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
