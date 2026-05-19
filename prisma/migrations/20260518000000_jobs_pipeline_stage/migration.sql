-- Add pipelineStage to JobApplication. 0=投递 1=测评 2=简历筛选 3=面试 4=Offer 5=入职
ALTER TABLE "JobApplication"
  ADD COLUMN "pipelineStage" INTEGER NOT NULL DEFAULT 0;

-- Backfill：把已有数据按 status 推断到一个合理初值
UPDATE "JobApplication" SET "pipelineStage" = 3 WHERE "status" = '进入面试';
UPDATE "JobApplication" SET "pipelineStage" = 4 WHERE "status" = '已Offer';
UPDATE "JobApplication" SET "pipelineStage" = 5 WHERE "status" = '已接受';
