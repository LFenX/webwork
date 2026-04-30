ALTER TABLE "SoulWingRoundtableDiscussion"
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "plannedTurns" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completedTurns" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastMessageAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "SoulWingRoundtableMessage"
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "SoulWingRoundtableParticipant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "adminPaused" BOOLEAN NOT NULL DEFAULT false,
  "pausedById" TEXT,
  "pauseReason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SoulWingRoundtableParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoulWingRoundtableParticipant_userId_key" ON "SoulWingRoundtableParticipant"("userId");
CREATE INDEX "SoulWingRoundtableParticipant_enabled_adminPaused_idx" ON "SoulWingRoundtableParticipant"("enabled", "adminPaused");
CREATE INDEX "SoulWingRoundtableDiscussion_deletedAt_createdAt_idx" ON "SoulWingRoundtableDiscussion"("deletedAt", "createdAt");
CREATE INDEX "SoulWingRoundtableMessage_deletedAt_createdAt_idx" ON "SoulWingRoundtableMessage"("deletedAt", "createdAt");
