ALTER TABLE "User" ADD COLUMN "avatarText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;

UPDATE "User"
SET "role" = 'owner'
WHERE lower("email") = 'fli.gda@foxmail.com';

CREATE TABLE "UserActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");
CREATE INDEX "UserActivity_createdAt_idx" ON "UserActivity"("createdAt");
