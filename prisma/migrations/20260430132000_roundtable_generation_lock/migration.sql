-- Add database-backed scheduling and generation locks for SoulWing roundtable.
ALTER TABLE "SoulWingRoundtableDiscussion"
  ADD COLUMN "nextTurnAt" TIMESTAMP(3),
  ADD COLUMN "generationLockedAt" TIMESTAMP(3),
  ADD COLUMN "generationLockToken" TEXT,
  ADD COLUMN "runningKey" TEXT,
  ADD COLUMN "slotClaimKey" TEXT;

ALTER TABLE "SoulWingRoundtableMessage"
  ADD COLUMN "followupKey" TEXT;

CREATE UNIQUE INDEX "SoulWingRoundtableDiscussion_runningKey_key"
  ON "SoulWingRoundtableDiscussion"("runningKey");

CREATE UNIQUE INDEX "SoulWingRoundtableDiscussion_slotClaimKey_key"
  ON "SoulWingRoundtableDiscussion"("slotClaimKey");

CREATE INDEX "SoulWingRoundtableDiscussion_status_nextTurnAt_idx"
  ON "SoulWingRoundtableDiscussion"("status", "nextTurnAt");

CREATE INDEX "SoulWingRoundtableDiscussion_generationLockedAt_idx"
  ON "SoulWingRoundtableDiscussion"("generationLockedAt");

CREATE UNIQUE INDEX "SoulWingRoundtableMessage_followupKey_key"
  ON "SoulWingRoundtableMessage"("followupKey");
