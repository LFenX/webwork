/**
 * One-time script: reads MDX files from content/ and inserts them into the DB.
 * Run: npx tsx scripts/migrate-content-to-db.ts
 */
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../app/generated/prisma/client"

const adapter = new PrismaLibSql({ url: "file:./dev.db" })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

const contentRoot = path.join(process.cwd(), "content")

async function migrateType(type: "blog" | "daily" | "reflections") {
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
      where: { type_slug: { type, slug } },
      update: { title, summary, tags, content, date },
      create: { type, slug, title, summary, tags, content, date },
    })
    console.log(`✓ ${type}/${slug}`)
  }
}

async function migrateResume() {
  const mdxPath = path.join(contentRoot, "resume.mdx")
  const mdPath = path.join(contentRoot, "resume.md")
  const p = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null
  if (!p) return

  const raw = fs.readFileSync(p, "utf8")
  const { content } = matter(raw)

  await prisma.resume.upsert({
    where: { id: "singleton" },
    update: { content, mode: "markdown" },
    create: { id: "singleton", content, mode: "markdown" },
  })
  console.log("✓ resume")
}

async function initSettings() {
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  })
  console.log("✓ site settings initialized")
}

async function main() {
  await migrateType("blog")
  await migrateType("daily")
  await migrateType("reflections")
  await migrateResume()
  await initSettings()
  console.log("\n✅ Migration complete")
}

main().catch(console.error).finally(() => prisma.$disconnect())
