CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "ipAddress" TEXT NOT NULL DEFAULT '',
  "geoLocation" TEXT NOT NULL DEFAULT '',
  "deviceInfo" TEXT NOT NULL DEFAULT '',
  "replacedByLocation" TEXT NOT NULL DEFAULT '',
  "replacedByDevice" TEXT NOT NULL DEFAULT '',
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSession_sessionId_key" ON "UserSession"("sessionId");
CREATE INDEX "UserSession_userId_status_idx" ON "UserSession"("userId", "status");
CREATE INDEX "UserSession_sessionId_idx" ON "UserSession"("sessionId");
CREATE INDEX "UserSession_lastSeenAt_idx" ON "UserSession"("lastSeenAt");

CREATE TABLE "ArticleFolder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "coverImageUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ArticleFolder_userId_type_idx" ON "ArticleFolder"("userId", "type");

ALTER TABLE "Post" ADD COLUMN "folderId" TEXT;
CREATE INDEX "Post_folderId_idx" ON "Post"("folderId");
