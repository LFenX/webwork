-- CreateTable
CREATE TABLE "GuardianMemoryBridge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sharedSummary" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL DEFAULT 'low',
    "lastReadAt" TIMESTAMP(3),
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "GuardianMemoryBridge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianMemoryBridgeAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bridgeId" TEXT,
    "action" TEXT NOT NULL,
    "direction" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "target" TEXT,
    "type" TEXT,
    "status" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianMemoryBridgeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianMemoryBridge_userId_direction_status_idx" ON "GuardianMemoryBridge"("userId", "direction", "status");

-- CreateIndex
CREATE INDEX "GuardianMemoryBridge_userId_sourceType_sourceId_idx" ON "GuardianMemoryBridge"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "GuardianMemoryBridge_userId_target_status_idx" ON "GuardianMemoryBridge"("userId", "target", "status");

-- CreateIndex
CREATE INDEX "GuardianMemoryBridgeAuditLog_userId_action_createdAt_idx" ON "GuardianMemoryBridgeAuditLog"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianMemoryBridgeAuditLog_bridgeId_createdAt_idx" ON "GuardianMemoryBridgeAuditLog"("bridgeId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuardianMemoryBridge" ADD CONSTRAINT "GuardianMemoryBridge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianMemoryBridgeAuditLog" ADD CONSTRAINT "GuardianMemoryBridgeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianMemoryBridgeAuditLog" ADD CONSTRAINT "GuardianMemoryBridgeAuditLog_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "GuardianMemoryBridge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
