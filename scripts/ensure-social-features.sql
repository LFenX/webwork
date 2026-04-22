CREATE TABLE IF NOT EXISTS ModuleVisibility (
  id TEXT NOT NULL PRIMARY KEY,
  userId TEXT NOT NULL,
  module TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ModuleVisibility_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ModuleVisibility_userId_module_key ON ModuleVisibility(userId, module);
CREATE INDEX IF NOT EXISTS ModuleVisibility_userId_idx ON ModuleVisibility(userId);

CREATE TABLE IF NOT EXISTS VisitLog (
  id TEXT NOT NULL PRIMARY KEY,
  ownerId TEXT NOT NULL,
  visitorId TEXT,
  module TEXT NOT NULL,
  path TEXT NOT NULL,
  postId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT VisitLog_ownerId_fkey FOREIGN KEY (ownerId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT VisitLog_visitorId_fkey FOREIGN KEY (visitorId) REFERENCES User(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS VisitLog_ownerId_module_createdAt_idx ON VisitLog(ownerId, module, createdAt);
CREATE INDEX IF NOT EXISTS VisitLog_visitorId_idx ON VisitLog(visitorId);

CREATE TABLE IF NOT EXISTS Comment (
  id TEXT NOT NULL PRIMARY KEY,
  postId TEXT NOT NULL,
  authorId TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT Comment_postId_fkey FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT Comment_authorId_fkey FOREIGN KEY (authorId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS Comment_postId_createdAt_idx ON Comment(postId, createdAt);
CREATE INDEX IF NOT EXISTS Comment_authorId_idx ON Comment(authorId);
