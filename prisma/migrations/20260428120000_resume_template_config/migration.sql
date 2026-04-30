-- Migration: resume template config + resume user-level config fields
-- Safe: only CREATE TABLE and ALTER TABLE ADD COLUMN. No DROP.

-- Add user-level config columns to Resume
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "resumeLocale" TEXT;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "resumeAppearance" TEXT;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "resumeConfig" JSONB;
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "lastBuiltConfigHash" TEXT;

-- Create ResumeTemplateConfig table
CREATE TABLE IF NOT EXISTS "ResumeTemplateConfig" (
  "slug" TEXT NOT NULL,
  "pkg" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "category" TEXT NOT NULL DEFAULT 'en',
  "sortOrder" INTEGER NOT NULL DEFAULT 1000,
  "displayName" TEXT,
  "description" TEXT,
  "defaultLocale" TEXT,
  "defaultAppearance" TEXT,
  "defaultConfig" JSONB,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResumeTemplateConfig_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX IF NOT EXISTS "ResumeTemplateConfig_category_sortOrder_idx" ON "ResumeTemplateConfig"("category", "sortOrder");
CREATE INDEX IF NOT EXISTS "ResumeTemplateConfig_enabled_idx" ON "ResumeTemplateConfig"("enabled");

-- Create ResumeTemplateAuditLog table
CREATE TABLE IF NOT EXISTS "ResumeTemplateAuditLog" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResumeTemplateAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResumeTemplateAuditLog_slug_createdAt_idx" ON "ResumeTemplateAuditLog"("slug", "createdAt");
