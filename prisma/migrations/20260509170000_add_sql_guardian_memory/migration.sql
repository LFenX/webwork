-- CreateTable
CREATE TABLE "GuardianMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sensitivity" TEXT NOT NULL DEFAULT 'low',
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 1,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "metadataJson" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianMemory_userId_status_updatedAt_idx" ON "GuardianMemory"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GuardianMemory_guardianProfileId_status_updatedAt_idx" ON "GuardianMemory"("guardianProfileId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GuardianMemory_userId_type_idx" ON "GuardianMemory"("userId", "type");

-- AddForeignKey
ALTER TABLE "GuardianMemory" ADD CONSTRAINT "GuardianMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianMemory" ADD CONSTRAINT "GuardianMemory_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
