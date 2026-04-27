-- CreateTable
CREATE TABLE "AutoReplySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "chatType" TEXT,
    "conversationId" TEXT,
    "triggerMode" TEXT NOT NULL DEFAULT 'manual',
    "idleMinutes" INTEGER DEFAULT 10,
    "scheduleStart" TEXT,
    "scheduleEnd" TEXT,
    "timezone" TEXT,
    "replyMode" TEXT NOT NULL DEFAULT 'away_notice',
    "templateText" TEXT,
    "customInstruction" TEXT,
    "discloseAsAutoReply" BOOLEAN NOT NULL DEFAULT true,
    "allowGroupReply" BOOLEAN NOT NULL DEFAULT false,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxRepliesPerDay" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoReplySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatType" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "triggerMessageId" TEXT,
    "replyMessageId" TEXT,
    "replyText" TEXT NOT NULL,
    "replyMode" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoReplySetting_userId_enabled_idx" ON "AutoReplySetting"("userId", "enabled");

-- CreateIndex
CREATE INDEX "AutoReplySetting_userId_chatType_conversationId_idx" ON "AutoReplySetting"("userId", "chatType", "conversationId");

-- CreateIndex
CREATE INDEX "AutoReplySetting_userId_scope_idx" ON "AutoReplySetting"("userId", "scope");

-- CreateIndex
CREATE INDEX "AutoReplyLog_userId_conversationId_createdAt_idx" ON "AutoReplyLog"("userId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoReplyLog_userId_createdAt_idx" ON "AutoReplyLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AutoReplySetting" ADD CONSTRAINT "AutoReplySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyLog" ADD CONSTRAINT "AutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
