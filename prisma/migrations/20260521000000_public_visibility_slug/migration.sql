ALTER TABLE "User"
  ADD COLUMN "publicSlug" TEXT;

CREATE UNIQUE INDEX "User_publicSlug_key" ON "User"("publicSlug");

CREATE INDEX "Post_userId_type_visibility_date_idx"
  ON "Post"("userId", "type", "visibility", "date");

CREATE INDEX "ModuleVisibility_userId_visibility_idx"
  ON "ModuleVisibility"("userId", "visibility");
