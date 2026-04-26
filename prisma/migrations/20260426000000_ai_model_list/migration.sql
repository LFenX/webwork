-- Add modelList field to AI provider configs and grants
ALTER TABLE "AIUserProviderConfig" ADD COLUMN "modelList" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AIUsageGrant" ADD COLUMN "modelList" TEXT NOT NULL DEFAULT '[]';
