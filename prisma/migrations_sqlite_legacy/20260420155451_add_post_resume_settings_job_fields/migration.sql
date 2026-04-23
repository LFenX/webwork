-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN "baseLocation" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN "hrContact" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN "link" TEXT;

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "content" TEXT NOT NULL DEFAULT '',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "mode" TEXT NOT NULL DEFAULT 'markdown',
    "content" TEXT NOT NULL DEFAULT '',
    "pdfPath" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "ownerName" TEXT NOT NULL DEFAULT 'LFen',
    "heroTagline" TEXT NOT NULL DEFAULT '这里是我的个人空间，记录博客、日常、心得，以及正在进行中的求职旅程。',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Post_type_date_idx" ON "Post"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Post_type_slug_key" ON "Post"("type", "slug");
