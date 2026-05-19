-- Per-user speech bubble theme + custom badge name.
ALTER TABLE "Live2DSettings" ADD COLUMN "bubbleTheme" TEXT NOT NULL DEFAULT 'dreamy-glass';
ALTER TABLE "Live2DSettings" ADD COLUMN "bubbleName" TEXT NOT NULL DEFAULT '';
