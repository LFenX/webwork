-- Phase D: per-user built-in model selection.
ALTER TABLE "Live2DSettings" ADD COLUMN "modelId" TEXT NOT NULL DEFAULT 'mao_pro';
