import "server-only"
import { createHash } from "node:crypto"
import type {
  ResumeThemeAdapter,
  EffectiveResumeConfig,
  FieldLabelMap,
  ThemeDefaultConfig,
} from "./types"
import { getBuiltinAdapter, createFallbackAdapter } from "./builtin"

// ── Placeholder types for future DB integration (Stage 3) ─────────────────────

export interface TemplateConfigOverride {
  slug: string
  displayName?: string | null
  category?: "zh" | "en" | null
  sortOrder?: number | null
  enabled?: boolean | null
  defaultLocale?: string | null
  defaultAppearance?: "system" | "light" | "dark" | null
  defaultConfig?: {
    sectionOrder?: string[]
    fieldLabelMap?: FieldLabelMap
    metaTheme?: Record<string, string>
  } | null
}

export interface UserResumeConfig {
  resumeLocale?: string | null
  resumeAppearance?: "system" | "light" | "dark" | null
  resumeConfig?: {
    sectionOrder?: string[]
    hiddenSections?: string[]
    fieldLabelMap?: FieldLabelMap
    metaTheme?: Record<string, string>
  } | null
}

// ── Adapter resolution ────────────────────────────────────────────────────────

/**
 * Resolve a theme adapter by slug.
 *
 * Priority:
 * 1. Built-in adapter (explicitly declared in builtin/)
 * 2. Fallback adapter (generated from metadata + field profiles)
 *
 * Stage 3 will merge dbOverride on top of the builtin/fallback adapter.
 */
export function resolveAdapter(
  slug: string,
  dbOverride?: TemplateConfigOverride | null
): ResumeThemeAdapter {
  const builtin = getBuiltinAdapter(slug)
  const base =
    builtin ?? createFallbackAdapter(slug, `jsonresume-theme-${slug}`)

  if (!dbOverride) return base

  // Merge DB override into base adapter
  const mergedDefaults: ThemeDefaultConfig = {
    ...base.defaults,
    locale: dbOverride.defaultLocale ?? base.defaults.locale,
    appearance: dbOverride.defaultAppearance ?? base.defaults.appearance,
    sectionOrder:
      dbOverride.defaultConfig?.sectionOrder ?? base.defaults.sectionOrder,
    fieldLabelMap: mergeFieldLabelMap(
      base.defaults.fieldLabelMap,
      dbOverride.defaultConfig?.fieldLabelMap ?? {},
      {}
    ),
    metaTheme: mergeMetaTheme(
      base.defaults.metaTheme,
      dbOverride.defaultConfig?.metaTheme ?? {},
      {}
    ),
  }

  const merged: ResumeThemeAdapter = {
    ...base,
    templateName: dbOverride.displayName ?? base.templateName,
    category: dbOverride.category ?? base.category,
    sortOrder: dbOverride.sortOrder ?? base.sortOrder,
    enabled: dbOverride.enabled ?? base.enabled,
    defaults: mergedDefaults,
  }

  return merged
}

// ── Config merge helpers ──────────────────────────────────────────────────────

function mergeFieldLabelMap(
  base: FieldLabelMap,
  template: FieldLabelMap,
  user: FieldLabelMap
): FieldLabelMap {
  return {
    sections: { ...base.sections, ...template.sections, ...user.sections },
    fields: { ...base.fields, ...template.fields, ...user.fields },
    ui: { ...base.ui, ...template.ui, ...user.ui },
  }
}

function mergeMetaTheme(
  base: Record<string, string>,
  template: Record<string, string>,
  user: Record<string, string>
): Record<string, string> {
  return { ...base, ...template, ...user }
}

function resolveEffectiveLocale(
  userLocale: string | null | undefined,
  adapter: ResumeThemeAdapter
): { locale: string; originalLocale: string } {
  const originalLocale = userLocale ?? adapter.defaults.locale

  // Apply adapter localeMap
  const mapped = adapter.capabilities.localeMap[originalLocale]
  const candidate = mapped ?? originalLocale

  // Check if candidate is in builtInLocales
  if (adapter.capabilities.builtInLocales.includes(candidate)) {
    return { locale: candidate, originalLocale }
  }

  // Fallback to adapter default
  return { locale: adapter.defaults.locale, originalLocale }
}

// ── Effective config merge ────────────────────────────────────────────────────

/**
 * Merge three-layer config into a single EffectiveResumeConfig.
 *
 * Layers:
 * - System builtin (adapter.defaults + adapter.capabilities)
 * - Template default (dbOverride, placeholder for Stage 3)
 * - User resume level (userConfig, from Resume table fields)
 */
export function mergeEffectiveConfig(
  adapter: ResumeThemeAdapter,
  userConfig?: UserResumeConfig | null
): EffectiveResumeConfig {
  const userLocale = userConfig?.resumeLocale
  const userAppearance = userConfig?.resumeAppearance
  const userSectionOrder = userConfig?.resumeConfig?.sectionOrder
  const userHiddenSections = userConfig?.resumeConfig?.hiddenSections
  const userFieldLabelMap = userConfig?.resumeConfig?.fieldLabelMap
  const userMetaTheme = userConfig?.resumeConfig?.metaTheme

  const { locale, originalLocale } = resolveEffectiveLocale(userLocale, adapter)

  const appearance = userAppearance ?? adapter.defaults.appearance
  const sectionOrder = userSectionOrder ?? adapter.defaults.sectionOrder
  const hiddenSections = userHiddenSections ?? []

  const fieldLabelMap = mergeFieldLabelMap(
    adapter.defaults.fieldLabelMap,
    {},
    userFieldLabelMap ?? {}
  )

  const metaTheme = mergeMetaTheme(
    adapter.defaults.metaTheme,
    {},
    userMetaTheme ?? {}
  )

  return {
    locale,
    originalLocale,
    appearance,
    sectionOrder,
    hiddenSections,
    fieldLabelMap,
    metaTheme,
  }
}

// ── Config hash ───────────────────────────────────────────────────────────────

/**
 * Compute a stable SHA-1 hash of the effective config.
 *
 * Used for lastBuiltConfigHash to detect whether a rebuild is needed.
 */
export function hashEffectiveConfig(
  effective: EffectiveResumeConfig,
  resumeJsonHash?: string
): string {
  const payload = JSON.stringify({
    locale: effective.locale,
    originalLocale: effective.originalLocale,
    appearance: effective.appearance,
    sectionOrder: effective.sectionOrder,
    hiddenSections: effective.hiddenSections,
    fieldLabelMap: effective.fieldLabelMap,
    metaTheme: effective.metaTheme,
    resumeJsonHash,
  })

  return createHash("sha1").update(payload).digest("hex")
}
