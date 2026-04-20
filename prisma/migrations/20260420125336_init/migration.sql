-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT '其他',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT '已投递',
    "repliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InterviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "round" TEXT NOT NULL DEFAULT '技术一面',
    "format" TEXT NOT NULL DEFAULT '视频',
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewers" TEXT,
    "questions" TEXT,
    "selfRating" INTEGER,
    "result" TEXT NOT NULL DEFAULT '待定',
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
