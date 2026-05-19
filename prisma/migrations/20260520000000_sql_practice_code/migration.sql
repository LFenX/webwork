-- Add code column to SqlPracticeProblem for storing the user's actual SQL solution.
ALTER TABLE "SqlPracticeProblem"
  ADD COLUMN "code" TEXT NOT NULL DEFAULT '';
