CREATE TABLE IF NOT EXISTS RegistrationRequest (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  displayName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approveToken TEXT NOT NULL UNIQUE,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approvedAt DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS RegistrationRequest_approveToken_key ON RegistrationRequest(approveToken);
