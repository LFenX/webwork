CREATE TABLE "UpdateLogEntry" (
  "hash" TEXT NOT NULL,
  "committedAt" TIMESTAMP(3) NOT NULL,
  "originalMessage" TEXT NOT NULL,
  "changeType" TEXT NOT NULL DEFAULT '功能',
  "modulesJson" JSONB NOT NULL,
  "filesJson" JSONB NOT NULL,
  "diffJson" JSONB NOT NULL,
  "statsJson" JSONB NOT NULL,
  "isDiffTruncated" BOOLEAN NOT NULL DEFAULT false,
  "hiddenReason" TEXT NOT NULL DEFAULT '',
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UpdateLogEntry_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE "UpdateLogComment" (
  "id" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentId" TEXT,
  "content" TEXT NOT NULL,
  "stickerId" TEXT,
  "stickerEmoji" TEXT,
  "ipAddress" TEXT NOT NULL DEFAULT '',
  "geoLocation" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UpdateLogComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UpdateLogEntry_committedAt_idx" ON "UpdateLogEntry"("committedAt");
CREATE INDEX "UpdateLogEntry_changeType_committedAt_idx" ON "UpdateLogEntry"("changeType", "committedAt");
CREATE INDEX "UpdateLogEntry_syncedAt_idx" ON "UpdateLogEntry"("syncedAt");

CREATE INDEX "UpdateLogComment_hash_createdAt_idx" ON "UpdateLogComment"("hash", "createdAt");
CREATE INDEX "UpdateLogComment_authorId_idx" ON "UpdateLogComment"("authorId");
CREATE INDEX "UpdateLogComment_parentId_idx" ON "UpdateLogComment"("parentId");
CREATE INDEX "UpdateLogComment_stickerId_idx" ON "UpdateLogComment"("stickerId");

ALTER TABLE "UpdateLogComment"
  ADD CONSTRAINT "UpdateLogComment_hash_fkey"
  FOREIGN KEY ("hash") REFERENCES "UpdateLogEntry"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpdateLogComment"
  ADD CONSTRAINT "UpdateLogComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpdateLogComment"
  ADD CONSTRAINT "UpdateLogComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "UpdateLogComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpdateLogComment"
  ADD CONSTRAINT "UpdateLogComment_stickerId_fkey"
  FOREIGN KEY ("stickerId") REFERENCES "StickerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
