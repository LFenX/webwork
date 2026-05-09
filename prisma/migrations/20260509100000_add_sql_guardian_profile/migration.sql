-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Query',
    "title" TEXT NOT NULL DEFAULT '迷失的数据水手',
    "avatarSeed" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "formStage" TEXT NOT NULL DEFAULT 'seed',
    "mood" TEXT NOT NULL DEFAULT 'curious',
    "personalityJson" JSONB,
    "preferencesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT,
    "pagePath" TEXT,
    "expDelta" INTEGER NOT NULL DEFAULT 0,
    "eventPayloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");

-- CreateIndex
CREATE INDEX "GuardianEvent_userId_createdAt_idx" ON "GuardianEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianEvent_userId_eventType_createdAt_idx" ON "GuardianEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianEvent_guardianProfileId_createdAt_idx" ON "GuardianEvent"("guardianProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianEvent_eventType_idx" ON "GuardianEvent"("eventType");

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianEvent" ADD CONSTRAINT "GuardianEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianEvent" ADD CONSTRAINT "GuardianEvent_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
