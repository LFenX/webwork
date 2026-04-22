ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

CREATE TABLE "PasswordChangeRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" DATETIME,
  "approvedById" TEXT,
  CONSTRAINT "PasswordChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PasswordChangeRequest_userId_status_idx" ON "PasswordChangeRequest"("userId", "status");
CREATE INDEX "PasswordChangeRequest_status_requestedAt_idx" ON "PasswordChangeRequest"("status", "requestedAt");
