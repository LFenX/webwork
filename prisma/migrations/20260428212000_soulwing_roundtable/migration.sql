CREATE TABLE "SoulWingRoundtableSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "morningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "eveningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "morningTime" TEXT NOT NULL DEFAULT '07:00',
  "eveningTime" TEXT NOT NULL DEFAULT '21:00',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SoulWingRoundtableSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoulWingRoundtableDay" (
  "id" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "morningTitle" TEXT NOT NULL,
  "morningDescription" TEXT NOT NULL DEFAULT '',
  "eveningTitle" TEXT NOT NULL,
  "eveningDescription" TEXT NOT NULL DEFAULT '',
  "dutyUserId" TEXT,
  "materialCard" JSONB,
  "announcement" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SoulWingRoundtableDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoulWingRoundtableDiscussion" (
  "id" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "topicTitle" TEXT NOT NULL,
  "topicDescription" TEXT NOT NULL DEFAULT '',
  "topicType" TEXT NOT NULL DEFAULT 'custom',
  "materialCard" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source" TEXT NOT NULL DEFAULT 'auto',
  "initiatedById" TEXT,
  "dutyUserId" TEXT,
  "summary" JSONB,
  "errorMessage" TEXT NOT NULL DEFAULT '',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SoulWingRoundtableDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoulWingRoundtableMessage" (
  "id" TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorAvatarUrl" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'agent',
  "round" INTEGER NOT NULL DEFAULT 0,
  "text" TEXT NOT NULL,
  "userProvided" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SoulWingRoundtableMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoulWingRoundtableDay_dateKey_key" ON "SoulWingRoundtableDay"("dateKey");
CREATE INDEX "SoulWingRoundtableDay_dateKey_idx" ON "SoulWingRoundtableDay"("dateKey");
CREATE INDEX "SoulWingRoundtableDay_dutyUserId_idx" ON "SoulWingRoundtableDay"("dutyUserId");
CREATE INDEX "SoulWingRoundtableDiscussion_dateKey_slot_idx" ON "SoulWingRoundtableDiscussion"("dateKey", "slot");
CREATE INDEX "SoulWingRoundtableDiscussion_status_createdAt_idx" ON "SoulWingRoundtableDiscussion"("status", "createdAt");
CREATE INDEX "SoulWingRoundtableDiscussion_dutyUserId_idx" ON "SoulWingRoundtableDiscussion"("dutyUserId");
CREATE INDEX "SoulWingRoundtableMessage_discussionId_createdAt_idx" ON "SoulWingRoundtableMessage"("discussionId", "createdAt");
CREATE INDEX "SoulWingRoundtableMessage_authorUserId_createdAt_idx" ON "SoulWingRoundtableMessage"("authorUserId", "createdAt");

ALTER TABLE "SoulWingRoundtableMessage"
  ADD CONSTRAINT "SoulWingRoundtableMessage_discussionId_fkey"
  FOREIGN KEY ("discussionId") REFERENCES "SoulWingRoundtableDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
