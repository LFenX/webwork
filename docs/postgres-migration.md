# PostgreSQL Migration Notes

## Audit Summary

- The app is a Next.js 16 App Router project using Prisma 7 with a generated client in `app/generated/prisma`.
- The previous runtime database adapter was libSQL/SQLite, hard-coded to `file:./dev.db` in `lib/db.ts`, `prisma/seed.ts`, and `scripts/migrate-content-to-db.ts`.
- The active SQLite source is root `dev.db`; `prisma/dev.db` is empty.
- SQLite migration history has drift: repository migrations and `_prisma_migrations` do not fully match, so PostgreSQL uses a fresh baseline migration generated from the current Prisma schema.
- Raw SQL is limited to user profile/admin reads and updates. PostgreSQL requires the `"User"` table name to be quoted.
- Historical data checks found valid foreign keys, valid dates, valid integer fields, valid JSON arrays in `Post.tags`, and no unique-key conflicts in the current `dev.db`.
- Known cleanup: legacy `UserActivity` columns `ip`, `location`, and `userAgent` exist in SQLite but are not part of the Prisma schema and are intentionally not imported.

## PostgreSQL Setup

Use a dedicated database, for example `webappwork_dev`. Keep the password in your local environment or `.env`; never hard-code it in source.

```bash
DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/webappwork_dev?schema=public"
SQLITE_DATABASE_URL="file:./dev.db"
```

Install dependencies, generate the Prisma client, and apply migrations:

```bash
npm install
npm run db:generate
npm run db:migrate
```

Then migrate legacy SQLite data:

```bash
npm run db:migrate:sqlite-to-postgres
```

The data migration refuses to write into a non-empty PostgreSQL database. To intentionally rerun against a disposable database, back it up first and pass:

```bash
npm run db:migrate:sqlite-to-postgres -- --truncate
```

## Validation Checklist

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:migrate:sqlite-to-postgres`
- `npm run lint`
- `npm run build`
- Start the app with `npm run dev` and verify login/register, settings, posts, jobs, interviews, friends/chat, guestbook, uploads, session heartbeat, and admin flows.

The migration script also validates table counts, key foreign-key relationships, JSON array format for `Post.tags`, boolean conversion for `UpdateLogOverride`, and a small concurrent session create/update/delete sanity check.

## Risk Register

- SQLite migration drift means the PostgreSQL migration should be treated as a baseline from current schema, not a replay of old SQLite SQL.
- PostgreSQL string search differs from SQLite; article search now explicitly uses Prisma `mode: "insensitive"`.
- Email uniqueness remains database-case-sensitive. Current data has no lower-case duplicate email conflicts, but a later migration can add normalization or `citext`.
- `Post.tags` remains a string containing JSON arrays for compatibility. Converting to native JSON should be a separate migration.

## Rollback

- Keep a timestamped copy of `dev.db` before switching traffic.
- If PostgreSQL migration fails, drop and recreate the dedicated PostgreSQL database; the SQLite source is untouched.
- If the app must roll back, revert the PostgreSQL commit and restore the previous SQLite adapter code and `.env` values.
- If imported data is wrong, stop writes to PostgreSQL, preserve logs, fix the conversion rule, and rerun from the SQLite source into a clean PostgreSQL database.
