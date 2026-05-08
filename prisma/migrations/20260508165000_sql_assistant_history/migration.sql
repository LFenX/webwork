CREATE TABLE "SqlAssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "titleLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SqlAssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlAssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL DEFAULT '',
    "sql" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "thinkingSteps" JSONB,
    "actions" JSONB,
    "executedActions" JSONB,
    "runResult" JSONB,
    "provider" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SqlAssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SqlAssistantConversation_userId_deletedAt_lastMessageAt_idx" ON "SqlAssistantConversation"("userId", "deletedAt", "lastMessageAt");
CREATE INDEX "SqlAssistantConversation_userId_updatedAt_idx" ON "SqlAssistantConversation"("userId", "updatedAt");
CREATE INDEX "SqlAssistantMessage_conversationId_createdAt_idx" ON "SqlAssistantMessage"("conversationId", "createdAt");
CREATE INDEX "SqlAssistantMessage_userId_createdAt_idx" ON "SqlAssistantMessage"("userId", "createdAt");

ALTER TABLE "SqlAssistantConversation" ADD CONSTRAINT "SqlAssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlAssistantMessage" ADD CONSTRAINT "SqlAssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SqlAssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlAssistantMessage" ADD CONSTRAINT "SqlAssistantMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
