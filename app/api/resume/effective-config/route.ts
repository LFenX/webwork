import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { resolveAdapterWithDb } from "@/lib/resume/template-config"
import { mergeEffectiveConfig } from "@/lib/resume/adapters/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug") || undefined

  try {
    const resume = await prisma.resume.findUnique({
      where: { userId: session.userId },
      select: {
        selectedTheme: true,
        resumeLocale: true,
        resumeAppearance: true,
        resumeConfig: true,
      },
    })

    const selectedSlug = slug || resume?.selectedTheme || "stackoverflow"

    const adapter = await resolveAdapterWithDb(selectedSlug)
    const effective = mergeEffectiveConfig(adapter, {
      resumeLocale: resume?.resumeLocale,
      resumeAppearance: resume?.resumeAppearance as "system" | "light" | "dark" | null | undefined,
      resumeConfig: (resume?.resumeConfig as Record<string, unknown>) ?? null,
    })

    return NextResponse.json({
      slug: selectedSlug,
      effectiveConfig: effective,
      capabilities: {
        localeTitleSupport: adapter.capabilities.localeTitleSupport,
        customOutputLabelSupport: adapter.capabilities.customOutputLabelSupport,
        sectionOrderSupport: adapter.capabilities.sectionOrderSupport,
        appearanceSupport: adapter.capabilities.appearanceSupport,
        metaThemeSupport: adapter.capabilities.metaThemeSupport,
        pdfSupport: adapter.capabilities.pdfSupport,
        supportsChangeLanguage: adapter.capabilities.supportsChangeLanguage,
        builtInLocales: adapter.capabilities.builtInLocales,
        supportsDarkMode: adapter.capabilities.supportsDarkMode,
      },
    }, { headers: NO_STORE })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "获取失败", detail: message }, { status: 500, headers: NO_STORE })
  }
}
