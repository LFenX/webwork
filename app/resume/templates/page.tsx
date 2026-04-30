import fs from "node:fs"
import path from "node:path"
import { requireAuth } from "@/lib/auth"
import { getResumeContent } from "@/lib/mdx"
import { getAvailableResumeThemes, getDefaultResumeTheme } from "@/lib/resume/themes"
import { prisma } from "@/lib/db"
import { ResumeTemplatesClient } from "./templates-client"

export const metadata = { title: "模板中心 — My Space" }
export const dynamic = "force-dynamic"

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "resume-theme-snapshots")

// 将体积较小的 snapshot（≤ 60 KB）直接嵌入 SSR 响应，节省客户端请求
const INLINE_SNAPSHOT_MAX_BYTES = 60 * 1024

function loadInlineSnapshots(slugs: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const slug of slugs) {
    try {
      const fp = path.join(SNAPSHOT_DIR, `${slug}.html`)
      if (!fs.existsSync(fp)) continue
      const stat = fs.statSync(fp)
      if (stat.size <= INLINE_SNAPSHOT_MAX_BYTES) {
        result[slug] = fs.readFileSync(fp, "utf8")
      }
    } catch { /* 忽略单个主题失败 */ }
  }
  return result
}

export default async function ResumeTemplatesPage() {
  const { userId } = await requireAuth()
  const [resume, themes, user] = await Promise.all([
    getResumeContent(userId),
    getAvailableResumeThemes(),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ])

  // Fetch DB template configs for category / visibility
  let dbConfigs: Record<string, { category: string; sortOrder: number; enabled: boolean }> = {}
  try {
    const rows = await prisma.resumeTemplateConfig.findMany({
      select: { slug: true, category: true, sortOrder: true, enabled: true },
    })
    for (const row of rows) {
      dbConfigs[row.slug] = row
    }
  } catch {
    dbConfigs = {}
  }

  // 只展示 verified 可用且业务启用的主题
  const available = themes.filter((t) => {
    if (!t.available) return false
    const db = dbConfigs[t.slug]
    if (db && db.enabled === false) return false
    return true
  })

  const categoryMap: Record<string, string> = {}
  const sortOrderMap: Record<string, number> = {}
  for (const t of available) {
    categoryMap[t.slug] = dbConfigs[t.slug]?.category || "en"
    sortOrderMap[t.slug] = dbConfigs[t.slug]?.sortOrder ?? 0
  }

  const currentTheme = resume.selectedTheme
    ? available.find((t) => t.slug === resume.selectedTheme) ?? getDefaultResumeTheme(available)
    : getDefaultResumeTheme(available)

  // 注入小尺寸 snapshot，大尺寸主题由客户端按需拉取
  const snapshots = loadInlineSnapshots(available.map((t) => t.slug))

  return (
    <ResumeTemplatesClient
      themes={available}
      categoryMap={categoryMap}
      sortOrderMap={sortOrderMap}
      currentThemeSlug={currentTheme?.slug ?? null}
      isOwner={user?.role === "owner"}
      snapshots={snapshots}
    />
  )
}
