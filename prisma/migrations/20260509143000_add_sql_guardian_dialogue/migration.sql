-- CreateTable
CREATE TABLE "GuardianDialogue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mood" TEXT,
    "pagePath" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianDialogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianDialogue_userId_createdAt_idx" ON "GuardianDialogue"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianDialogue_guardianProfileId_createdAt_idx" ON "GuardianDialogue"("guardianProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianDialogue_userId_role_createdAt_idx" ON "GuardianDialogue"("userId", "role", "createdAt");

-- AddForeignKey
ALTER TABLE "GuardianDialogue" ADD CONSTRAINT "GuardianDialogue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianDialogue" ADD CONSTRAINT "GuardianDialogue_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
