import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getResumeContent } from "@/lib/mdx"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { buildDefaultResumeJson } from "@/lib/resume/default-resume"
import { parseResumeJson } from "@/lib/resume/schema"
import { getAvailableResumeThemes } from "@/lib/resume/themes"
import type { ResumeJson } from "@/lib/resume/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

// 此 API 仅供站点 owner 调试使用
// 普通模板预览请使用 /api/resume/themes/snapshot（静态快照）
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })
  if (user?.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "此接口仅供管理员调试，普通预览请使用模板中心" },
      { status: 403, headers: NO_STORE },
    )
  }

  const body = await req.json().catch(() => ({}))
  const themeSlug = typeof body?.themeSlug === "string" ? body.themeSlug : null

  if (!themeSlug) {
    return NextResponse.json({ error: "缺少 themeSlug" }, { status: 400, headers: NO_STORE })
  }

  const themes = getAvailableResumeThemes()
  const themeInfo = themes.find((t) => t.slug === themeSlug)
  if (!themeInfo) {
    return NextResponse.json({ error: "未知主题" }, { status: 400, headers: NO_STORE })
  }
  if (!themeInfo.available) {
    return NextResponse.json({
      ok: false, code: "theme_unavailable",
      error: themeInfo.unavailableReason ?? "主题不可用",
    }, { headers: NO_STORE })
  }

  const allowFallback = body.allowFallback !== false

  let resumeJson: ResumeJson | null = null
  if (body.resumeJson !== undefined && body.resumeJson !== null) {
    const validated = parseResumeJson(body.resumeJson)
    if (!validated.ok) {
      return NextResponse.json({ error: "resumeJson 校验失败", issues: validated.issues }, { status: 400, headers: NO_STORE })
    }
    resumeJson = validated.data
  }

  if (!resumeJson) {
    const resume = await getResumeContent(session.userId)
    resumeJson = (resume.resumeJson ?? null) as ResumeJson | null
  }

  if (!resumeJson) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true, email: true, bio: true, location: true },
    })
    resumeJson = buildDefaultResumeJson(dbUser ?? {})
  }

  const result = await renderResumeHtml({ resumeJson, selectedTheme: themeSlug, allowFallback })
  return NextResponse.json(result, { headers: NO_STORE })
}
