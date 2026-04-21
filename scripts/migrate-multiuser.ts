/**
 * Manual multi-user migration script.
 * Run once: npx tsx scripts/migrate-multiuser.ts
 *
 * Creates User / FriendRequest / Friendship tables and migrates all existing
 * data to be owned by a bootstrap admin user (email from ADMIN_EMAIL env var).
 */

import "dotenv/config"
import { createClient } from "@libsql/client"
import bcrypt from "bcryptjs"

const DB_URL = "file:./dev.db"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123"
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME ?? "LFen"

function genId(): string {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 9)
  return `c${ts}${rnd}`
}

async function main() {
  const db = createClient({ url: DB_URL })
  const now = new Date().toISOString()

  console.log("▶  Starting multi-user migration…")

  // ── 1. Create User table ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id"           TEXT NOT NULL PRIMARY KEY,
      "email"        TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "displayName"  TEXT NOT NULL DEFAULT '',
      "bio"          TEXT NOT NULL DEFAULT '',
      "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    DATETIME NOT NULL
    )
  `)
  console.log("✓  User table ready")

  // ── 2. Create FriendRequest table ───────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "FriendRequest" (
      "id"          TEXT NOT NULL PRIMARY KEY,
      "fromUserId"  TEXT NOT NULL,
      "toUserId"    TEXT NOT NULL,
      "status"      TEXT NOT NULL DEFAULT 'pending',
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "respondedAt" DATETIME,
      CONSTRAINT "FriendRequest_fromUserId_fkey"
        FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FriendRequest_toUserId_fkey"
        FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE ("fromUserId", "toUserId")
    )
  `)
  await db.execute(`
    CREATE INDEX IF NOT EXISTS "FriendRequest_toUserId_status_idx"
      ON "FriendRequest" ("toUserId", "status")
  `)
  console.log("✓  FriendRequest table ready")

  // ── 3. Create Friendship table ───────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "Friendship" (
      "id"        TEXT NOT NULL PRIMARY KEY,
      "userAId"   TEXT NOT NULL,
      "userBId"   TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Friendship_userAId_fkey"
        FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Friendship_userBId_fkey"
        FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE ("userAId", "userBId")
    )
  `)
  console.log("✓  Friendship table ready")

  // ── 4. Insert admin user ─────────────────────────────────────────────────────
  const existing = await db.execute({
    sql: `SELECT id FROM "User" WHERE email = ?`,
    args: [ADMIN_EMAIL],
  })
  let adminId: string
  if (existing.rows.length > 0) {
    adminId = existing.rows[0].id as string
    console.log(`✓  Admin user already exists (${adminId})`)
  } else {
    adminId = genId()
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
    await db.execute({
      sql: `INSERT INTO "User" ("id","email","passwordHash","displayName","bio","createdAt","updatedAt")
            VALUES (?,?,?,?,?,?,?)`,
      args: [adminId, ADMIN_EMAIL, hash, ADMIN_DISPLAY_NAME, "", now, now],
    })
    console.log(`✓  Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  }

  // ── 5. Migrate Post ──────────────────────────────────────────────────────────
  const postCols = await db.execute(`PRAGMA table_info("Post")`)
  const postHasUserId = postCols.rows.some((r) => r.name === "userId")
  if (!postHasUserId) {
    // Recreate Post with userId column and updated unique constraint
    await db.execute(`PRAGMA foreign_keys=OFF`)
    await db.execute(`
      CREATE TABLE "Post_new" (
        "id"         TEXT NOT NULL PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "type"       TEXT NOT NULL,
        "slug"       TEXT NOT NULL,
        "title"      TEXT NOT NULL,
        "summary"    TEXT NOT NULL DEFAULT '',
        "tags"       TEXT NOT NULL DEFAULT '[]',
        "content"    TEXT NOT NULL DEFAULT '',
        "visibility" TEXT NOT NULL DEFAULT 'private',
        "date"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"  DATETIME NOT NULL,
        CONSTRAINT "Post_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE ("userId","type","slug")
      )
    `)
    await db.execute({
      sql: `INSERT INTO "Post_new"
              ("id","userId","type","slug","title","summary","tags","content","visibility","date","createdAt","updatedAt")
            SELECT "id",?,"type","slug","title","summary","tags","content",'private',"date","createdAt","updatedAt"
            FROM "Post"`,
      args: [adminId],
    })
    await db.execute(`DROP TABLE "Post"`)
    await db.execute(`ALTER TABLE "Post_new" RENAME TO "Post"`)
    await db.execute(`CREATE INDEX IF NOT EXISTS "Post_userId_type_date_idx" ON "Post" ("userId","type","date")`)
    await db.execute(`PRAGMA foreign_keys=ON`)
    console.log("✓  Post migrated")
  } else {
    console.log("✓  Post already migrated (skipped)")
  }

  // ── 6. Migrate JobApplication ────────────────────────────────────────────────
  const jobCols = await db.execute(`PRAGMA table_info("JobApplication")`)
  const jobHasUserId = jobCols.rows.some((r) => r.name === "userId")
  if (!jobHasUserId) {
    await db.execute(`PRAGMA foreign_keys=OFF`)
    await db.execute(`
      CREATE TABLE "JobApplication_new" (
        "id"           TEXT NOT NULL PRIMARY KEY,
        "userId"       TEXT NOT NULL,
        "company"      TEXT NOT NULL,
        "position"     TEXT NOT NULL,
        "channel"      TEXT NOT NULL DEFAULT '其他',
        "appliedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status"       TEXT NOT NULL DEFAULT '已投递',
        "repliedAt"    DATETIME,
        "notes"        TEXT,
        "baseLocation" TEXT,
        "hrContact"    TEXT,
        "link"         TEXT,
        "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    DATETIME NOT NULL,
        CONSTRAINT "JobApplication_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await db.execute({
      sql: `INSERT INTO "JobApplication_new"
              ("id","userId","company","position","channel","appliedAt","status","repliedAt","notes","baseLocation","hrContact","link","createdAt","updatedAt")
            SELECT "id",?,"company","position","channel","appliedAt","status","repliedAt","notes","baseLocation","hrContact","link","createdAt","updatedAt"
            FROM "JobApplication"`,
      args: [adminId],
    })
    await db.execute(`DROP TABLE "JobApplication"`)
    await db.execute(`ALTER TABLE "JobApplication_new" RENAME TO "JobApplication"`)
    await db.execute(`CREATE INDEX IF NOT EXISTS "JobApplication_userId_idx" ON "JobApplication" ("userId")`)
    await db.execute(`PRAGMA foreign_keys=ON`)
    console.log("✓  JobApplication migrated")
  } else {
    console.log("✓  JobApplication already migrated (skipped)")
  }

  // ── 7. Migrate InterviewRecord ───────────────────────────────────────────────
  const intCols = await db.execute(`PRAGMA table_info("InterviewRecord")`)
  const intHasUserId = intCols.rows.some((r) => r.name === "userId")
  if (!intHasUserId) {
    await db.execute(`PRAGMA foreign_keys=OFF`)
    await db.execute(`
      CREATE TABLE "InterviewRecord_new" (
        "id"           TEXT NOT NULL PRIMARY KEY,
        "userId"       TEXT NOT NULL,
        "jobId"        TEXT,
        "company"      TEXT NOT NULL,
        "position"     TEXT NOT NULL,
        "round"        TEXT NOT NULL DEFAULT '技术一面',
        "format"       TEXT NOT NULL DEFAULT '视频',
        "scheduledAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "interviewers" TEXT,
        "questions"    TEXT,
        "selfRating"   INTEGER,
        "result"       TEXT NOT NULL DEFAULT '待定',
        "feedback"     TEXT,
        "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    DATETIME NOT NULL,
        CONSTRAINT "InterviewRecord_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "InterviewRecord_jobId_fkey"
          FOREIGN KEY ("jobId") REFERENCES "JobApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `)
    await db.execute({
      sql: `INSERT INTO "InterviewRecord_new"
              ("id","userId","jobId","company","position","round","format","scheduledAt","interviewers","questions","selfRating","result","feedback","createdAt","updatedAt")
            SELECT "id",?,"jobId","company","position","round","format","scheduledAt","interviewers","questions","selfRating","result","feedback","createdAt","updatedAt"
            FROM "InterviewRecord"`,
      args: [adminId],
    })
    await db.execute(`DROP TABLE "InterviewRecord"`)
    await db.execute(`ALTER TABLE "InterviewRecord_new" RENAME TO "InterviewRecord"`)
    await db.execute(`CREATE INDEX IF NOT EXISTS "InterviewRecord_userId_idx" ON "InterviewRecord" ("userId")`)
    await db.execute(`PRAGMA foreign_keys=ON`)
    console.log("✓  InterviewRecord migrated")
  } else {
    console.log("✓  InterviewRecord already migrated (skipped)")
  }

  // ── 8. Migrate Resume ────────────────────────────────────────────────────────
  const resumeCols = await db.execute(`PRAGMA table_info("Resume")`)
  const resumeHasUserId = resumeCols.rows.some((r) => r.name === "userId")
  if (!resumeHasUserId) {
    await db.execute(`PRAGMA foreign_keys=OFF`)
    await db.execute(`
      CREATE TABLE "Resume_new" (
        "userId"    TEXT NOT NULL PRIMARY KEY,
        "mode"      TEXT NOT NULL DEFAULT 'markdown',
        "content"   TEXT NOT NULL DEFAULT '',
        "pdfPath"   TEXT,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Resume_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await db.execute({
      sql: `INSERT INTO "Resume_new" ("userId","mode","content","pdfPath","updatedAt")
            SELECT ?,"mode","content","pdfPath","updatedAt" FROM "Resume"`,
      args: [adminId],
    })
    await db.execute(`DROP TABLE "Resume"`)
    await db.execute(`ALTER TABLE "Resume_new" RENAME TO "Resume"`)
    await db.execute(`PRAGMA foreign_keys=ON`)
    console.log("✓  Resume migrated")
  } else {
    console.log("✓  Resume already migrated (skipped)")
  }

  // ── 9. Migrate SiteSettings ──────────────────────────────────────────────────
  const settingsCols = await db.execute(`PRAGMA table_info("SiteSettings")`)
  const settingsHasUserId = settingsCols.rows.some((r) => r.name === "userId")
  if (!settingsHasUserId) {
    await db.execute(`PRAGMA foreign_keys=OFF`)
    await db.execute(`
      CREATE TABLE "SiteSettings_new" (
        "userId"      TEXT NOT NULL PRIMARY KEY,
        "ownerName"   TEXT NOT NULL DEFAULT 'LFen',
        "heroTagline" TEXT NOT NULL DEFAULT '',
        "updatedAt"   DATETIME NOT NULL,
        CONSTRAINT "SiteSettings_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await db.execute({
      sql: `INSERT INTO "SiteSettings_new" ("userId","ownerName","heroTagline","updatedAt")
            SELECT ?,"ownerName","heroTagline","updatedAt" FROM "SiteSettings"`,
      args: [adminId],
    })
    await db.execute(`DROP TABLE "SiteSettings"`)
    await db.execute(`ALTER TABLE "SiteSettings_new" RENAME TO "SiteSettings"`)
    await db.execute(`PRAGMA foreign_keys=ON`)
    console.log("✓  SiteSettings migrated")
  } else {
    console.log("✓  SiteSettings already migrated (skipped)")
  }

  // ── 10. Write admin ID to .env ───────────────────────────────────────────────
  const fs = await import("fs")
  const envPath = "./. env"
  let envContent = ""
  try { envContent = fs.readFileSync("./.env", "utf8") } catch { /* new file */ }
  if (!envContent.includes("ADMIN_USER_ID")) {
    fs.appendFileSync("./.env", `\nADMIN_USER_ID="${adminId}"\n`)
    console.log(`✓  ADMIN_USER_ID=${adminId} written to .env`)
  }

  db.close()
  console.log("\n✅  Migration complete. Run: npx prisma generate")
  console.log(`   Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
}

main().catch((e) => {
  console.error("❌ Migration failed:", e)
  process.exit(1)
})
