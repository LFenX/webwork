CREATE TABLE IF NOT EXISTS "ResumeVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pdfPath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ResumeVersion_userId_createdAt_idx" ON "ResumeVersion"("userId", "createdAt");
