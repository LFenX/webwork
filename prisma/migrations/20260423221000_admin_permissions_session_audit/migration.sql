-- Add session-level audit metadata and per-admin permission switches.
ALTER TABLE "UserActivity" ADD COLUMN "sessionId" TEXT;

ALTER TABLE "UserSession" ADD COLUMN "lastResumeActivityAt" TIMESTAMP(3);
ALTER TABLE "UserSession" ADD COLUMN "loggedOutAt" TIMESTAMP(3);
ALTER TABLE "UserSession" ADD COLUMN "logoutReason" TEXT NOT NULL DEFAULT '';

CREATE TABLE "AdminPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approveRegistrations" BOOLEAN NOT NULL DEFAULT false,
    "approvePasswordChanges" BOOLEAN NOT NULL DEFAULT false,
    "viewActivityLogs" BOOLEAN NOT NULL DEFAULT false,
    "manageUsers" BOOLEAN NOT NULL DEFAULT false,
    "manageAnnouncements" BOOLEAN NOT NULL DEFAULT false,
    "manageStickers" BOOLEAN NOT NULL DEFAULT false,
    "manageUpdateLogs" BOOLEAN NOT NULL DEFAULT false,
    "refreshGeoLocations" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPermission_userId_key" ON "AdminPermission"("userId");
CREATE INDEX "AdminPermission_updatedById_idx" ON "AdminPermission"("updatedById");
CREATE INDEX "UserActivity_sessionId_createdAt_idx" ON "UserActivity"("sessionId", "createdAt");
CREATE INDEX "UserSession_loggedOutAt_idx" ON "UserSession"("loggedOutAt");

ALTER TABLE "AdminPermission" ADD CONSTRAINT "AdminPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminPermission" ADD CONSTRAINT "AdminPermission_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
