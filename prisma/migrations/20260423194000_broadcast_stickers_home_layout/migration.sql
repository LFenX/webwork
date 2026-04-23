-- World channel broadcasts are separate from administrator announcements.
CREATE TABLE "WorldBroadcast" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorldBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldBroadcastView" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "lastViewedAt" TIMESTAMP(3),
  CONSTRAINT "WorldBroadcastView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StickerAsset" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "ownerId" TEXT,
  "uploaderId" TEXT,
  "name" TEXT NOT NULL DEFAULT '',
  "filename" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "isAnimated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StickerAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeLayout" (
  "userId" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ChatMessage" ADD COLUMN "stickerId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "stickerEmoji" TEXT;
ALTER TABLE "ChannelMessage" ADD COLUMN "stickerId" TEXT;
ALTER TABLE "ChannelMessage" ADD COLUMN "stickerEmoji" TEXT;
ALTER TABLE "Comment" ADD COLUMN "stickerId" TEXT;
ALTER TABLE "Comment" ADD COLUMN "stickerEmoji" TEXT;
ALTER TABLE "GuestbookMessage" ADD COLUMN "stickerId" TEXT;
ALTER TABLE "GuestbookMessage" ADD COLUMN "stickerEmoji" TEXT;

CREATE UNIQUE INDEX "WorldBroadcast_messageId_key" ON "WorldBroadcast"("messageId");
CREATE INDEX "WorldBroadcast_createdAt_idx" ON "WorldBroadcast"("createdAt");
CREATE INDEX "WorldBroadcast_authorId_idx" ON "WorldBroadcast"("authorId");
CREATE UNIQUE INDEX "WorldBroadcastView_broadcastId_userId_key" ON "WorldBroadcastView"("broadcastId", "userId");
CREATE INDEX "WorldBroadcastView_userId_hidden_viewCount_idx" ON "WorldBroadcastView"("userId", "hidden", "viewCount");
CREATE INDEX "StickerAsset_scope_createdAt_idx" ON "StickerAsset"("scope", "createdAt");
CREATE INDEX "StickerAsset_ownerId_createdAt_idx" ON "StickerAsset"("ownerId", "createdAt");
CREATE INDEX "ChatMessage_stickerId_idx" ON "ChatMessage"("stickerId");
CREATE INDEX "ChannelMessage_stickerId_idx" ON "ChannelMessage"("stickerId");
CREATE INDEX "Comment_stickerId_idx" ON "Comment"("stickerId");
CREATE INDEX "GuestbookMessage_stickerId_idx" ON "GuestbookMessage"("stickerId");

ALTER TABLE "WorldBroadcast" ADD CONSTRAINT "WorldBroadcast_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBroadcastView" ADD CONSTRAINT "WorldBroadcastView_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "WorldBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldBroadcastView" ADD CONSTRAINT "WorldBroadcastView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerAsset" ADD CONSTRAINT "StickerAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerAsset" ADD CONSTRAINT "StickerAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "StickerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "StickerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "StickerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuestbookMessage" ADD CONSTRAINT "GuestbookMessage_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "StickerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
