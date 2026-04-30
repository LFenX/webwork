import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { parseResumeJson } from "@/lib/resume/schema"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { renderResumeHtmlWithAdapter } from "@/lib/resume/adapter-renderer"
import { getAvailableResumeThemes } from "@/lib/resume/themes"
import { checkResumeBuildReadiness } from "@/lib/resume/build-readiness"
import { revalidatePath } from "next/cache"
import { publishUserPageChanged } from "@/lib/realtime-events"
import type { ResumeJson } from "@/lib/resume/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

function friendlyRenderError(raw: string): string {
  if (raw.includes("超时")) return "主题渲染超时，建议切换其他主题后重试"
  if (raw.includes("render 函数")) return "主题格式不兼容，建议切换其他主题"
  if (raw.includes("浏览器环境")) return "此主题不支持服务端渲染，请选择其他主题"
  return "渲染失败，建议切换主题后重试"
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => ({}))
  const resumeJson = body?.resumeJson
  const selectedTheme = typeof body?.selectedTheme === "string" ? body.selectedTheme : null

  if (resumeJson === undefined || resumeJson === null) {
    return NextResponse.json({ ok: false, error: "缺少 resumeJson" }, { status: 400, headers: NO_STORE })
  }

  const validated = parseResumeJson(resumeJson)
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: "简历数据校验失败", issues: validated.issues },
      { status: 400, headers: NO_STORE },
    )
  }

  // Server-side readiness check (guards against direct API calls bypassing client check)
  const readiness = checkResumeBuildReadiness(validated.data as ResumeJson, selectedTheme)
  if (!readiness.canBuild) {
    const msgs = readiness.missingRequiredFields.map((f) => f.errorMsg).join("；")
    return NextResponse.json(
      { ok: false, error: msgs, missingRequiredFields: readiness.missingRequiredFields },
      { status: 422, headers: NO_STORE },
    )
  }

  if (selectedTheme) {
    const themes = getAvailableResumeThemes()
    const themeInfo = themes.find((t) => t.slug === selectedTheme)
    if (!themeInfo) {
      return NextResponse.json({ ok: false, error: "未知主题，请重新选择" }, { status: 400, headers: NO_STORE })
    }
    if (!themeInfo.available) {
      return NextResponse.json(
        { ok: false, error: themeInfo.unavailableReason ?? "当前主题不可用，请切换其他主题" },
        { status: 400, headers: NO_STORE },
      )
    }
  }

  // Fetch user config for adapter path
  const resume = await prisma.resume.findUnique({
    where: { userId: session.userId },
    select: {
      resumeLocale: true,
      resumeAppearance: true,
      resumeConfig: true,
      selectedTheme: true,
    },
  })

  const selectedSlug = selectedTheme ?? resume?.selectedTheme ?? "stackoverflow"

  const userConfig = {
    resumeLocale: resume?.resumeLocale,
    resumeAppearance: resume?.resumeAppearance as "system" | "light" | "dark" | null,
    resumeConfig: (resume?.resumeConfig as Record<string, unknown>) ?? null,
  }

  // Stage 5: try adapter path first, fallback to legacy renderer
  let html: string
  let usedThemeSlug: string
  let configHash: string | null = null
  let fallback = false

  const adapterResult = await renderResumeHtmlWithAdapter({
    resumeJson: validated.data as ResumeJson,
    selectedTheme: selectedSlug,
    userConfig,
  })

  if (adapterResult.ok) {
    html = adapterResult.html
    usedThemeSlug = adapterResult.slug
    configHash = adapterResult.configHash
  } else {
    const legacyResult = await renderResumeHtml({
      resumeJson: validated.data as ResumeJson,
      selectedTheme: selectedSlug,
      allowFallback: true,
    })
    if (!legacyResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: friendlyRenderError(legacyResult.error),
          detail: legacyResult.error,
          code: legacyResult.code,
        },
        { status: 400, headers: NO_STORE },
      )
    }
    html = legacyResult.html
    usedThemeSlug = legacyResult.usedTheme.slug
    fallback = legacyResult.fallback
  }

  // 持久化：JSON 数据 + 渲染结果一并保存，展示页直接读缓存
  const updateData: Record<string, unknown> = {
    mode: "json",
    resumeJson: validated.data,
    renderedHtml: html,
    lastBuiltAt: new Date(),
    lastBuiltTheme: usedThemeSlug,
    lastBuiltConfigHash: configHash,
  }
  if (selectedTheme) updateData.selectedTheme = selectedTheme

  await prisma.resume.upsert({
    where: { userId: session.userId },
    update: updateData,
    create: { userId: session.userId, ...updateData },
  })

  revalidatePath("/resume")
  revalidatePath("/resume/edit")
  await publishUserPageChanged(session.userId, "resume")

  return NextResponse.json({
    ok: true,
    usedTheme: usedThemeSlug,
    fallback,
  }, { headers: NO_STORE })
}
