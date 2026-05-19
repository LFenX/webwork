-- Phase C: replace boolean "enabled" with three-way "displayMode"
-- ("off" | "desktop" | "all"), preserving prior on/off intent.

ALTER TABLE "Live2DSettings" ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'desktop';

UPDATE "Live2DSettings"
  SET "displayMode" = CASE WHEN "enabled" THEN 'desktop' ELSE 'off' END;

ALTER TABLE "Live2DSettings" DROP COLUMN "enabled";
