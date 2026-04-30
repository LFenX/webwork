import "server-only"
import { prisma } from "@/lib/db"
import type { ResumeThemeAdapter, FieldLabelMap } from "./adapters/types"
import { getBuiltinAdapter, createFallbackAdapter } from "./adapters/builtin"
import { isThemeVerified, isThemeDisabled } from "./theme-compat"
import type { TemplateConfigOverride } from "./adapters/registry"

/** 根据 slug / pkg 推断分类，供 ensure 和 seed 复用 */
export function inferTemplateCategory(slug: string, pkg: string): "zh" | "en" {
  const s = `${slug} ${pkg}`.toLowerCase()
  if (
    s.includes("zh") ||
    s.includes("cn") ||
    s.includes("chinese") ||
    s.includes("hant") ||
    s.includes("hans") ||
    s.includes("tw") ||
    s.includes("papercn") ||
    s.includes("paper_cn") ||
    s.includes("mix") ||
    s.includes("apage")
  ) {
    return "zh"
  }
  return "en"
}

export interface ResumeTemplateConfigDb {
  slug: string
  pkg: string
  enabled: boolean
  category: string
  sortOrder: number
  displayName: string | null
  description: string | null
  defaultLocale: string | null
  defaultAppearance: string | null
  defaultConfig: unknown | null
}

async function getTemplateConfigFromDb(slug: string): Promise<ResumeTemplateConfigDb | null> {
  try {
    const row = await prisma.resumeTemplateConfig.findUnique({ where: { slug } })
    if (!row) return null
    return row as ResumeTemplateConfigDb
  } catch {
    // If table doesn't exist yet (migration not applied), return null safely
    return null
  }
}

export async function getAllTemplateConfigs(): Promise<ResumeTemplateConfigDb[]> {
  try {
    const rows = await prisma.resumeTemplateConfig.findMany()
    return rows as ResumeTemplateConfigDb[]
  } catch {
    return []
  }
}

function dbRowToOverride(row: ResumeTemplateConfigDb): TemplateConfigOverride {
  const defaultConfig = (row.defaultConfig ?? {}) as {
    sectionOrder?: string[]
    fieldLabelMap?: FieldLabelMap
    metaTheme?: Record<string, string>
  }

  return {
    slug: row.slug,
    displayName: row.displayName,
    category: row.category as "zh" | "en" | null,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    defaultLocale: row.defaultLocale,
    defaultAppearance: row.defaultAppearance as "system" | "light" | "dark" | null,
    defaultConfig: {
      sectionOrder: defaultConfig.sectionOrder,
      fieldLabelMap: defaultConfig.fieldLabelMap,
      metaTheme: defaultConfig.metaTheme,
    },
  }
}

/**
 * Resolve adapter merged with DB config.
 *
 * Stage 3: reads ResumeTemplateConfig from DB and merges into builtin/fallback adapter.
 */
export async function resolveAdapterWithDb(slug: string): Promise<ResumeThemeAdapter> {
  const builtin = getBuiltinAdapter(slug)
  const base = builtin ?? createFallbackAdapter(slug, `jsonresume-theme-${slug}`)

  const dbRow = await getTemplateConfigFromDb(slug)
  if (!dbRow) return base

  const override = dbRowToOverride(dbRow)

  // Merge override into base adapter
  const mergedDefaults = {
    ...base.defaults,
    locale: override.defaultLocale ?? base.defaults.locale,
    appearance: override.defaultAppearance ?? base.defaults.appearance,
    sectionOrder: override.defaultConfig?.sectionOrder ?? base.defaults.sectionOrder,
    fieldLabelMap: {
      sections: {
        ...base.defaults.fieldLabelMap.sections,
        ...override.defaultConfig?.fieldLabelMap?.sections,
      },
      fields: {
        ...base.defaults.fieldLabelMap.fields,
        ...override.defaultConfig?.fieldLabelMap?.fields,
      },
      ui: {
        ...base.defaults.fieldLabelMap.ui,
        ...override.defaultConfig?.fieldLabelMap?.ui,
      },
    },
    metaTheme: {
      ...base.defaults.metaTheme,
      ...override.defaultConfig?.metaTheme,
    },
  }

  const merged: ResumeThemeAdapter = {
    ...base,
    templateName: override.displayName ?? base.templateName,
    category: override.category ?? base.category,
    sortOrder: override.sortOrder ?? base.sortOrder,
    enabled: override.enabled ?? base.enabled,
    defaults: mergedDefaults,
  }

  return merged
}

/**
 * Ensure a ResumeTemplateConfig row exists for the given slug.
 *
 * - If the row already exists, returns it immediately.
 * - If not, creates one with inferred defaults.
 * - Safe to call concurrently (handles race-condition via findUnique fallback).
 * - Does NOT overwrite any existing admin customizations.
 */
export async function ensureResumeTemplateConfig(
  slug: string,
  updatedById?: string | null
): Promise<ResumeTemplateConfigDb> {
  const existing = await getTemplateConfigFromDb(slug)
  if (existing) return existing

  const pkg = `jsonresume-theme-${slug}`
  const category = inferTemplateCategory(slug, pkg)
  const defaultLocale = category === "zh" ? "zh-CN" : "en-gb"

  try {
    const created = await prisma.resumeTemplateConfig.create({
      data: {
        slug,
        pkg,
        enabled: true,
        category,
        sortOrder: 9999,
        displayName: null,
        description: null,
        defaultLocale,
        defaultAppearance: "system",
        defaultConfig: {},
        updatedById: updatedById ?? null,
      },
    })
    return created as ResumeTemplateConfigDb
  } catch {
    // Race condition: another concurrent request already created it
    const row = await prisma.resumeTemplateConfig.findUnique({ where: { slug } })
    if (row) return row as ResumeTemplateConfigDb
    throw new Error(`无法为模板 ${slug} 创建默认配置`)
  }
}

/**
 * Final visibility condition:
 * compat.verified === true
 * AND compat.disabled !== true
 * AND templateConfig.enabled === true
 */
export function isThemeVisible(slug: string, templateEnabled: boolean): boolean {
  return isThemeVerified(slug) && !isThemeDisabled(slug) && templateEnabled
}
