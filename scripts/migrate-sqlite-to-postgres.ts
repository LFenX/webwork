import "dotenv/config"
import { createClient } from "@libsql/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const SQLITE_DATABASE_URL = process.env.SQLITE_DATABASE_URL ?? "file:./dev.db"
const POSTGRES_DATABASE_URL = process.env.DATABASE_URL
const ALLOW_OVERWRITE = process.argv.includes("--truncate") || process.env.MIGRATION_ALLOW_OVERWRITE === "true"

const TABLES = [
  "User",
  "RegistrationRequest",
  "UserActivity",
  "PasswordChangeRequest",
  "UserSession",
  "SiteSettings",
  "Resume",
  "ArticleFolder",
  "Post",
  "ResumeVersion",
  "JobApplication",
  "InterviewRecord",
  "ModuleVisibility",
  "VisitLog",
  "Comment",
  "FriendRequest",
  "Friendship",
  "ChatMessage",
  "ChatAttachment",
  "GuestbookMessage",
  "Upload",
  "UpdateLogOverride",
] as const

const TRUNCATE_TABLES = [...TABLES].reverse()

type Row = Record<string, unknown>
type ModelDelegate = {
  createMany(args: { data: Row[] }): Promise<unknown>
}
type Target = InstanceType<typeof PrismaClient> & Record<string, ModelDelegate>

if (!POSTGRES_DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required for the target PostgreSQL database")
}

const sqlite = createClient({ url: SQLITE_DATABASE_URL })
const adapter = new PrismaPg({ connectionString: POSTGRES_DATABASE_URL })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any) as unknown as Target

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`)
  return value
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value)
}

function asInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isInteger(n)) throw new Error(`${field} must be an integer, got ${String(value)}`)
  return n
}

function nullableInt(value: unknown, field: string): number | null {
  return value == null ? null : asInt(value, field)
}

function asBool(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "bigint") return value !== BigInt(0)
  if (typeof value === "string") {
    if (["1", "true", "TRUE"].includes(value)) return true
    if (["0", "false", "FALSE"].includes(value)) return false
  }
  throw new Error(`${field} must be boolean-like, got ${String(value)}`)
}

function asDate(value: unknown, field: string): Date {
  if (value instanceof Date) return value
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${field} must be date-like, got ${String(value)}`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${field} has invalid date value: ${String(value)}`)
  return date
}

function nullableDate(value: unknown, field: string): Date | null {
  return value == null ? null : asDate(value, field)
}

function validateJsonArray(value: unknown, field: string): string {
  const text = value == null ? "[]" : String(value)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${field} contains invalid JSON: ${text}`)
  }
  if (!Array.isArray(parsed)) throw new Error(`${field} must contain a JSON array`)
  return text
}

function rowId(row: Row) {
  return String(row.id ?? row.userId ?? row.hash ?? "unknown")
}

async function readTable(table: (typeof TABLES)[number]): Promise<Row[]> {
  const result = await sqlite.execute(`SELECT * FROM "${table}"`)
  return result.rows as Row[]
}

async function countSqlite(table: string): Promise<number> {
  const result = await sqlite.execute(`SELECT COUNT(*) AS count FROM "${table}"`)
  return Number(result.rows[0]?.count ?? 0)
}

async function countPostgres(table: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
    `SELECT COUNT(*) AS count FROM "${table}"`
  )
  return Number(result[0]?.count ?? 0)
}

async function assertTargetIsEmpty() {
  const counts = await Promise.all(TABLES.map(async (table) => [table, await countPostgres(table)] as const))
  const nonEmpty = counts.filter(([, count]) => count > 0)
  if (nonEmpty.length === 0) return

  if (!ALLOW_OVERWRITE) {
    const details = nonEmpty.map(([table, count]) => `${table}=${count}`).join(", ")
    throw new Error(`Target PostgreSQL database is not empty (${details}). Re-run with --truncate only after backing it up.`)
  }

  console.log("Target database is not empty; --truncate requested, clearing application tables.")
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TRUNCATE_TABLES.map((table) => `"${table}"`).join(", ")} CASCADE`)
}

async function insertMany(model: string, data: Row[]) {
  if (data.length === 0) return
  await prisma[model].createMany({ data })
}

const modelName: Record<(typeof TABLES)[number], string> = {
  User: "user",
  RegistrationRequest: "registrationRequest",
  UserActivity: "userActivity",
  PasswordChangeRequest: "passwordChangeRequest",
  UserSession: "userSession",
  SiteSettings: "siteSettings",
  Resume: "resume",
  ArticleFolder: "articleFolder",
  Post: "post",
  ResumeVersion: "resumeVersion",
  JobApplication: "jobApplication",
  InterviewRecord: "interviewRecord",
  ModuleVisibility: "moduleVisibility",
  VisitLog: "visitLog",
  Comment: "comment",
  FriendRequest: "friendRequest",
  Friendship: "friendship",
  ChatMessage: "chatMessage",
  ChatAttachment: "chatAttachment",
  GuestbookMessage: "guestbookMessage",
  Upload: "upload",
  UpdateLogOverride: "updateLogOverride",
}

function transform(table: (typeof TABLES)[number], rows: Row[]): Row[] {
  return rows.map((row) => {
    try {
      switch (table) {
        case "User":
          return {
            id: asString(row.id, "User.id"),
            email: asString(row.email, "User.email"),
            passwordHash: asString(row.passwordHash, "User.passwordHash"),
            displayName: String(row.displayName ?? ""),
            bio: String(row.bio ?? ""),
            avatarText: String(row.avatarText ?? ""),
            avatarUrl: nullableString(row.avatarUrl),
            location: String(row.location ?? ""),
            role: String(row.role ?? "user"),
            lastLoginAt: nullableDate(row.lastLoginAt, "User.lastLoginAt"),
            createdAt: asDate(row.createdAt, "User.createdAt"),
            updatedAt: asDate(row.updatedAt, "User.updatedAt"),
          }
        case "RegistrationRequest":
          return {
            id: asString(row.id, "RegistrationRequest.id"),
            email: asString(row.email, "RegistrationRequest.email"),
            passwordHash: asString(row.passwordHash, "RegistrationRequest.passwordHash"),
            displayName: asString(row.displayName, "RegistrationRequest.displayName"),
            status: String(row.status ?? "pending"),
            approveToken: asString(row.approveToken, "RegistrationRequest.approveToken"),
            createdAt: asDate(row.createdAt, "RegistrationRequest.createdAt"),
            updatedAt: asDate(row.updatedAt, "RegistrationRequest.updatedAt"),
            approvedAt: nullableDate(row.approvedAt, "RegistrationRequest.approvedAt"),
          }
        case "UserActivity":
          return {
            id: asString(row.id, "UserActivity.id"),
            userId: nullableString(row.userId),
            action: asString(row.action, "UserActivity.action"),
            detail: String(row.detail ?? ""),
            ipAddress: String(row.ipAddress ?? ""),
            geoLocation: String(row.geoLocation ?? ""),
            deviceInfo: String(row.deviceInfo ?? ""),
            createdAt: asDate(row.createdAt, "UserActivity.createdAt"),
          }
        case "PasswordChangeRequest":
          return {
            id: asString(row.id, "PasswordChangeRequest.id"),
            userId: asString(row.userId, "PasswordChangeRequest.userId"),
            passwordHash: asString(row.passwordHash, "PasswordChangeRequest.passwordHash"),
            status: String(row.status ?? "pending"),
            requestedAt: asDate(row.requestedAt, "PasswordChangeRequest.requestedAt"),
            respondedAt: nullableDate(row.respondedAt, "PasswordChangeRequest.respondedAt"),
            approvedById: nullableString(row.approvedById),
          }
        case "UserSession":
          return {
            id: asString(row.id, "UserSession.id"),
            sessionId: asString(row.sessionId, "UserSession.sessionId"),
            userId: asString(row.userId, "UserSession.userId"),
            status: String(row.status ?? "active"),
            ipAddress: String(row.ipAddress ?? ""),
            geoLocation: String(row.geoLocation ?? ""),
            deviceInfo: String(row.deviceInfo ?? ""),
            replacedByLocation: String(row.replacedByLocation ?? ""),
            replacedByDevice: String(row.replacedByDevice ?? ""),
            lastSeenAt: asDate(row.lastSeenAt, "UserSession.lastSeenAt"),
            lastActiveAt: asDate(row.lastActiveAt, "UserSession.lastActiveAt"),
            lastForegroundAt: asDate(row.lastForegroundAt, "UserSession.lastForegroundAt"),
            expiresAt: asDate(row.expiresAt, "UserSession.expiresAt"),
            createdAt: asDate(row.createdAt, "UserSession.createdAt"),
            updatedAt: asDate(row.updatedAt, "UserSession.updatedAt"),
          }
        case "SiteSettings":
          return {
            userId: asString(row.userId, "SiteSettings.userId"),
            ownerName: String(row.ownerName ?? "LFen"),
            heroTagline: String(row.heroTagline ?? ""),
            updatedAt: asDate(row.updatedAt, "SiteSettings.updatedAt"),
          }
        case "Resume":
          return {
            userId: asString(row.userId, "Resume.userId"),
            mode: String(row.mode ?? "markdown"),
            content: String(row.content ?? ""),
            pdfPath: nullableString(row.pdfPath),
            updatedAt: asDate(row.updatedAt, "Resume.updatedAt"),
          }
        case "ArticleFolder":
          return {
            id: asString(row.id, "ArticleFolder.id"),
            userId: asString(row.userId, "ArticleFolder.userId"),
            type: asString(row.type, "ArticleFolder.type"),
            name: asString(row.name, "ArticleFolder.name"),
            description: String(row.description ?? ""),
            coverImageUrl: String(row.coverImageUrl ?? ""),
            coverPositionX: asInt(row.coverPositionX, "ArticleFolder.coverPositionX"),
            coverPositionY: asInt(row.coverPositionY, "ArticleFolder.coverPositionY"),
            coverOpacity: asInt(row.coverOpacity, "ArticleFolder.coverOpacity"),
            coverFitMode: String(row.coverFitMode ?? "auto"),
            coverScale: asInt(row.coverScale, "ArticleFolder.coverScale"),
            createdAt: asDate(row.createdAt, "ArticleFolder.createdAt"),
            updatedAt: asDate(row.updatedAt, "ArticleFolder.updatedAt"),
          }
        case "Post":
          return {
            id: asString(row.id, "Post.id"),
            userId: asString(row.userId, "Post.userId"),
            folderId: nullableString(row.folderId),
            type: asString(row.type, "Post.type"),
            slug: asString(row.slug, "Post.slug"),
            title: asString(row.title, "Post.title"),
            summary: String(row.summary ?? ""),
            tags: validateJsonArray(row.tags, "Post.tags"),
            content: String(row.content ?? ""),
            visibility: String(row.visibility ?? "private"),
            date: asDate(row.date, "Post.date"),
            createdAt: asDate(row.createdAt, "Post.createdAt"),
            updatedAt: asDate(row.updatedAt, "Post.updatedAt"),
          }
        case "ResumeVersion":
          return {
            id: asString(row.id, "ResumeVersion.id"),
            userId: asString(row.userId, "ResumeVersion.userId"),
            name: asString(row.name, "ResumeVersion.name"),
            pdfPath: asString(row.pdfPath, "ResumeVersion.pdfPath"),
            originalName: asString(row.originalName, "ResumeVersion.originalName"),
            size: asInt(row.size, "ResumeVersion.size"),
            createdAt: asDate(row.createdAt, "ResumeVersion.createdAt"),
          }
        case "JobApplication":
          return {
            id: asString(row.id, "JobApplication.id"),
            userId: asString(row.userId, "JobApplication.userId"),
            company: asString(row.company, "JobApplication.company"),
            position: asString(row.position, "JobApplication.position"),
            channel: String(row.channel ?? "Other"),
            appliedAt: asDate(row.appliedAt, "JobApplication.appliedAt"),
            status: String(row.status ?? "submitted"),
            repliedAt: nullableDate(row.repliedAt, "JobApplication.repliedAt"),
            notes: nullableString(row.notes),
            baseLocation: nullableString(row.baseLocation),
            hrContact: nullableString(row.hrContact),
            link: nullableString(row.link),
            createdAt: asDate(row.createdAt, "JobApplication.createdAt"),
            updatedAt: asDate(row.updatedAt, "JobApplication.updatedAt"),
          }
        case "InterviewRecord":
          return {
            id: asString(row.id, "InterviewRecord.id"),
            userId: asString(row.userId, "InterviewRecord.userId"),
            jobId: nullableString(row.jobId),
            company: asString(row.company, "InterviewRecord.company"),
            position: asString(row.position, "InterviewRecord.position"),
            round: String(row.round ?? "interview"),
            format: String(row.format ?? "video"),
            scheduledAt: asDate(row.scheduledAt, "InterviewRecord.scheduledAt"),
            interviewers: nullableString(row.interviewers),
            questions: nullableString(row.questions),
            selfRating: nullableInt(row.selfRating, "InterviewRecord.selfRating"),
            result: String(row.result ?? "pending"),
            feedback: nullableString(row.feedback),
            createdAt: asDate(row.createdAt, "InterviewRecord.createdAt"),
            updatedAt: asDate(row.updatedAt, "InterviewRecord.updatedAt"),
          }
        case "ModuleVisibility":
          return {
            id: asString(row.id, "ModuleVisibility.id"),
            userId: asString(row.userId, "ModuleVisibility.userId"),
            module: asString(row.module, "ModuleVisibility.module"),
            visibility: String(row.visibility ?? "private"),
            updatedAt: asDate(row.updatedAt, "ModuleVisibility.updatedAt"),
          }
        case "VisitLog":
          return {
            id: asString(row.id, "VisitLog.id"),
            ownerId: asString(row.ownerId, "VisitLog.ownerId"),
            visitorId: nullableString(row.visitorId),
            module: asString(row.module, "VisitLog.module"),
            path: asString(row.path, "VisitLog.path"),
            postId: nullableString(row.postId),
            createdAt: asDate(row.createdAt, "VisitLog.createdAt"),
          }
        case "Comment":
          return {
            id: asString(row.id, "Comment.id"),
            postId: asString(row.postId, "Comment.postId"),
            authorId: asString(row.authorId, "Comment.authorId"),
            content: asString(row.content, "Comment.content"),
            createdAt: asDate(row.createdAt, "Comment.createdAt"),
          }
        case "FriendRequest":
          return {
            id: asString(row.id, "FriendRequest.id"),
            fromUserId: asString(row.fromUserId, "FriendRequest.fromUserId"),
            toUserId: asString(row.toUserId, "FriendRequest.toUserId"),
            status: String(row.status ?? "pending"),
            createdAt: asDate(row.createdAt, "FriendRequest.createdAt"),
            respondedAt: nullableDate(row.respondedAt, "FriendRequest.respondedAt"),
          }
        case "Friendship":
          return {
            id: asString(row.id, "Friendship.id"),
            userAId: asString(row.userAId, "Friendship.userAId"),
            userBId: asString(row.userBId, "Friendship.userBId"),
            createdAt: asDate(row.createdAt, "Friendship.createdAt"),
          }
        case "ChatMessage":
          return {
            id: asString(row.id, "ChatMessage.id"),
            senderId: asString(row.senderId, "ChatMessage.senderId"),
            receiverId: asString(row.receiverId, "ChatMessage.receiverId"),
            text: String(row.text ?? ""),
            readAt: nullableDate(row.readAt, "ChatMessage.readAt"),
            createdAt: asDate(row.createdAt, "ChatMessage.createdAt"),
          }
        case "ChatAttachment":
          return {
            id: asString(row.id, "ChatAttachment.id"),
            messageId: asString(row.messageId, "ChatAttachment.messageId"),
            uploaderId: asString(row.uploaderId, "ChatAttachment.uploaderId"),
            filename: asString(row.filename, "ChatAttachment.filename"),
            originalName: asString(row.originalName, "ChatAttachment.originalName"),
            mimeType: asString(row.mimeType, "ChatAttachment.mimeType"),
            size: asInt(row.size, "ChatAttachment.size"),
            storagePath: asString(row.storagePath, "ChatAttachment.storagePath"),
            createdAt: asDate(row.createdAt, "ChatAttachment.createdAt"),
          }
        case "GuestbookMessage":
          return {
            id: asString(row.id, "GuestbookMessage.id"),
            ownerId: asString(row.ownerId, "GuestbookMessage.ownerId"),
            authorId: asString(row.authorId, "GuestbookMessage.authorId"),
            content: asString(row.content, "GuestbookMessage.content"),
            createdAt: asDate(row.createdAt, "GuestbookMessage.createdAt"),
          }
        case "Upload":
          return {
            id: asString(row.id, "Upload.id"),
            userId: asString(row.userId, "Upload.userId"),
            filename: asString(row.filename, "Upload.filename"),
            originalName: asString(row.originalName, "Upload.originalName"),
            mimeType: asString(row.mimeType, "Upload.mimeType"),
            size: asInt(row.size, "Upload.size"),
            url: asString(row.url, "Upload.url"),
            postId: nullableString(row.postId),
            createdAt: asDate(row.createdAt, "Upload.createdAt"),
          }
        case "UpdateLogOverride":
          return {
            hash: asString(row.hash, "UpdateLogOverride.hash"),
            customMessage: nullableString(row.customMessage),
            useOriginal: asBool(row.useOriginal, "UpdateLogOverride.useOriginal"),
            hidden: asBool(row.hidden, "UpdateLogOverride.hidden"),
            updatedById: nullableString(row.updatedById),
            updatedAt: asDate(row.updatedAt, "UpdateLogOverride.updatedAt"),
            createdAt: asDate(row.createdAt, "UpdateLogOverride.createdAt"),
          }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${table} row ${rowId(row)} failed conversion: ${message}`)
    }
  })
}

async function validateSource() {
  const fkCheck = await sqlite.execute("PRAGMA foreign_key_check")
  if (fkCheck.rows.length > 0) {
    throw new Error(`SQLite foreign_key_check failed: ${JSON.stringify(fkCheck.rows)}`)
  }
}

async function validateTargetCounts(sourceCounts: Map<string, number>) {
  console.log("\nRow count comparison")
  for (const table of TABLES) {
    const source = sourceCounts.get(table) ?? 0
    const target = await countPostgres(table)
    const status = source === target ? "ok" : "mismatch"
    console.log(`${table}: sqlite=${source} postgres=${target} ${status}`)
    if (source !== target) throw new Error(`${table} row count mismatch`)
  }
}

async function validateTargetRelations() {
  const checks: Array<[string, string]> = [
    ["Post.userId", `SELECT COUNT(*)::int AS count FROM "Post" p LEFT JOIN "User" u ON u.id = p."userId" WHERE u.id IS NULL`],
    ["Post.folderId", `SELECT COUNT(*)::int AS count FROM "Post" p LEFT JOIN "ArticleFolder" f ON f.id = p."folderId" WHERE p."folderId" IS NOT NULL AND f.id IS NULL`],
    ["JobApplication.userId", `SELECT COUNT(*)::int AS count FROM "JobApplication" j LEFT JOIN "User" u ON u.id = j."userId" WHERE u.id IS NULL`],
    ["InterviewRecord.jobId", `SELECT COUNT(*)::int AS count FROM "InterviewRecord" i LEFT JOIN "JobApplication" j ON j.id = i."jobId" WHERE i."jobId" IS NOT NULL AND j.id IS NULL`],
    ["ChatAttachment.messageId", `SELECT COUNT(*)::int AS count FROM "ChatAttachment" a LEFT JOIN "ChatMessage" m ON m.id = a."messageId" WHERE m.id IS NULL`],
    ["Comment.postId", `SELECT COUNT(*)::int AS count FROM "Comment" c LEFT JOIN "Post" p ON p.id = c."postId" WHERE p.id IS NULL`],
    ["VisitLog.ownerId", `SELECT COUNT(*)::int AS count FROM "VisitLog" v LEFT JOIN "User" u ON u.id = v."ownerId" WHERE u.id IS NULL`],
  ]

  console.log("\nForeign key sanity checks")
  for (const [name, sql] of checks) {
    const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(sql)
    const count = Number(result[0]?.count ?? 0)
    console.log(`${name}: ${count}`)
    if (count !== 0) throw new Error(`${name} has ${count} orphan rows`)
  }
}

async function runConcurrencySanity() {
  const user = await prisma.user.findFirst({ select: { id: true } })
  if (!user) return

  const now = new Date()
  const sessionIds = Array.from({ length: 5 }, (_, index) => `migration-check-${Date.now()}-${index}`)
  const created = await Promise.all(sessionIds.map((sessionId) =>
    prisma.userSession.create({
      data: {
        sessionId,
        userId: user.id,
        status: "migration_check",
        lastSeenAt: now,
        lastActiveAt: now,
        lastForegroundAt: now,
        expiresAt: new Date(now.getTime() + 60000),
      },
      select: { id: true },
    })
  ))

  await Promise.all(created.map((session) =>
    prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
  ))
  await prisma.userSession.deleteMany({ where: { sessionId: { in: sessionIds } } })
  console.log("\nConcurrency sanity: userSession parallel create/update/delete ok")
}

async function main() {
  console.log(`SQLite source: ${SQLITE_DATABASE_URL}`)
  console.log("PostgreSQL target: DATABASE_URL")

  await validateSource()
  await assertTargetIsEmpty()

  const sourceCounts = new Map<string, number>()
  for (const table of TABLES) {
    sourceCounts.set(table, await countSqlite(table))
  }

  console.log("\nMigrating tables")
  for (const table of TABLES) {
    const rows = await readTable(table)
    const data = transform(table, rows)
    await insertMany(modelName[table], data)
    console.log(`${table}: ${data.length}`)
  }

  await validateTargetCounts(sourceCounts)
  await validateTargetRelations()
  await runConcurrencySanity()
  console.log("\nSQLite to PostgreSQL migration completed successfully.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    sqlite.close()
    await prisma.$disconnect()
  })
