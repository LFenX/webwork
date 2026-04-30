import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { getAvailableResumeThemes } from "@/lib/resume/themes"
import { getVerifiedThemes, getDisabledThemes } from "@/lib/resume/theme-compat"
import { resolveAdapter } from "@/lib/resume/adapters/registry"
import type { ResumeThemeInfo } from "@/lib/resume/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireOwner() {
  const session = await getSession()
  if (!session) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })
  if (user?.role !== "owner") return null
  return session
}

export async function GET() {
  const owner = await requireOwner()
  if (!owner) return NextResponse.json({ error: "仅站点所有者可访问" }, { status: 403 })

  const allThemes = getAvailableResumeThemes()
  const verified = getVerifiedThemes()
  const disabled = getDisabledThemes()

  // Fetch all template configs from DB
  let dbConfigs: Record<string, {
    enabled: boolean
    category: string
    sortOrder: number
    displayName: string | null
    description: string | null
    defaultLocale: string | null
    defaultAppearance: string | null
    defaultConfig: unknown
  }> = {}
  try {
    const rows = await prisma.resumeTemplateConfig.findMany()
    for (const row of rows) {
      dbConfigs[row.slug] = row
    }
  } catch {
    // Table may not exist yet if migration hasn't been applied
    dbConfigs = {}
  }

  const list = allThemes.map((t: ResumeThemeInfo) => {
    const vEntry = verified[t.slug]
    const dEntry = disabled[t.slug]
    let status: string
    let reason: string | undefined
    let verifiedAt: string | undefined
    let checkedAt: string | undefined

    if (vEntry) {
      status = "verified"
      reason = undefined
      verifiedAt = vEntry.verifiedAt
    } else if (dEntry) {
      status = "disabled"
      reason = dEntry.reason
      checkedAt = dEntry.checkedAt
    } else {
      status = "unverified"
      reason = "尚未验证"
    }

    const db = dbConfigs[t.slug]
    const adapter = resolveAdapter(t.slug, null)

    const businessEnabled = db?.enabled ?? true
    const visible = status === "verified" && !dEntry && businessEnabled

    return {
      // Original fields (preserved)
      slug: t.slug,
      pkg: t.pkg,
      version: t.version,
      description: db?.description ?? t.description,
      label: db?.displayName ?? t.label,
      available: t.available,
      status,
      reason,
      verifiedAt,
      checkedAt,
      // New fields (Stage 3)
      category: db?.category ?? adapter.category ?? "en",
      sortOrder: db?.sortOrder ?? adapter.sortOrder ?? t.sortKey,
      businessEnabled,
      displayName: db?.displayName ?? null,
      defaultLocale: db?.defaultLocale ?? adapter.defaults.locale ?? null,
      defaultAppearance: db?.defaultAppearance ?? adapter.defaults.appearance ?? null,
      defaultConfig: (db?.defaultConfig ?? {}) as Record<string, unknown>,
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
      visible,
    }
  })

  const counts = {
    total: list.length,
    verified: list.filter((t) => t.status === "verified").length,
    disabled: list.filter((t) => t.status === "disabled").length,
    unverified: list.filter((t) => t.status === "unverified").length,
  }

  return NextResponse.json({ themes: list, counts })
}
