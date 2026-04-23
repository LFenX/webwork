/**
 * One-time script: reads MDX files from content/ and inserts them into the DB.
 * Run: npx tsx scripts/migrate-content-to-db.ts
 * Requires at least one user to exist (created by migrate-multiuser.ts).
 */
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL env var is required for PostgreSQL")
}

const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const contentRoot = path.join(process.cwd(), "content")

async function migrateType(type: "blog" | "daily" | "reflections", userId: string) {
  const dir = path.join(contentRoot, type)
  if (!fs.existsSync(dir)) return

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
  for (const file of files) {
    const slug = file.replace(/\.(mdx|md)$/, "")
    const raw = fs.readFileSync(path.join(dir, file), "utf8")
    const { data, content } = matter(raw)
    const title = String(data.title ?? slug)
    const summary = String(data.summary ?? "")
    const tags = JSON.stringify(Array.isArray(data.tags) ? data.tags : [])
    const date = data.date ? new Date(String(data.date)) : new Date()

    await prisma.post.upsert({
      where: { userId_type_slug: { userId, type, slug } },
      update: { title, summary, tags, content, date },
      create: { userId, type, slug, title, summary, tags, content, date },
    })
    console.log(`✓ ${type}/${slug}`)
  }
}

async function migrateResume(userId: string) {
  const mdxPath = path.join(contentRoot, "resume.mdx")
  const mdPath = path.join(contentRoot, "resume.md")
  const p = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null
  if (!p) return

  const raw = fs.readFileSync(p, "utf8")
  const { content } = matter(raw)

  await prisma.resume.upsert({
    where: { userId },
    update: { content, mode: "markdown" },
    create: { userId, content, mode: "markdown" },
  })
  console.log("✓ resume")
}

async function initSettings(userId: string) {
  await prisma.siteSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
  console.log("✓ site settings initialized")
}

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) {
    console.error("No users found. Run migrate-multiuser.ts first.")
    process.exit(1)
  }
  const userId = user.id
  console.log(`Migrating content for user: ${user.email} (${userId})`)

  await migrateType("blog", userId)
  await migrateType("daily", userId)
  await migrateType("reflections", userId)
  await migrateResume(userId)
  await initSettings(userId)
  console.log("\n✅ Migration complete")
}

main().catch(console.error).finally(() => prisma.$disconnect())
