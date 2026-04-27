-- CreateTable
CREATE TABLE "MemorySettings" (
    "userId" TEXT NOT NULL,
    "enableLongTermMemory" BOOLEAN NOT NULL DEFAULT true,
    "enablePersonaContext" BOOLEAN NOT NULL DEFAULT true,
    "enableConversationArchive" BOOLEAN NOT NULL DEFAULT true,
    "enableToolMemoryEvents" BOOLEAN NOT NULL DEFAULT true,
    "enableMemoryRecall" BOOLEAN NOT NULL DEFAULT true,
    "enableMemoryTools" BOOLEAN NOT NULL DEFAULT true,
    "storeFullConversations" BOOLEAN NOT NULL DEFAULT false,
    "autoTagSensitiveContent" BOOLEAN NOT NULL DEFAULT true,
    "requireConfirmBeforeSave" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorySettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceConversationId" TEXT,
    "sourceToolCallLogId" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "topicSummary" TEXT NOT NULL,
    "keyTakeaways" TEXT NOT NULL DEFAULT '',
    "relatedModules" TEXT NOT NULL DEFAULT '[]',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "importance" TEXT NOT NULL DEFAULT 'low',
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryToolEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT,
    "title" TEXT,
    "articleId" TEXT,
    "folderId" TEXT,
    "folderName" TEXT,
    "sourceModule" TEXT,
    "targetModule" TEXT,
    "slugChanged" BOOLEAN,
    "changedFields" TEXT NOT NULL DEFAULT '[]',
    "sourceToolCallLogId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryToolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryFact_userId_category_idx" ON "MemoryFact"("userId", "category");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_importance_idx" ON "MemoryFact"("userId", "importance");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_createdAt_idx" ON "MemoryFact"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_deletedAt_idx" ON "MemoryFact"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_userId_createdAt_idx" ON "MemoryEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEvent_userId_conversationId_idx" ON "MemoryEvent"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "MemoryEvent_userId_deletedAt_idx" ON "MemoryEvent"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "MemoryToolEvent_userId_createdAt_idx" ON "MemoryToolEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryToolEvent_userId_action_idx" ON "MemoryToolEvent"("userId", "action");

-- CreateIndex
CREATE INDEX "MemoryToolEvent_userId_module_idx" ON "MemoryToolEvent"("userId", "module");

-- CreateIndex
CREATE INDEX "MemoryToolEvent_userId_deletedAt_idx" ON "MemoryToolEvent"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "MemorySettings" ADD CONSTRAINT "MemorySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEvent" ADD CONSTRAINT "MemoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryToolEvent" ADD CONSTRAINT "MemoryToolEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
