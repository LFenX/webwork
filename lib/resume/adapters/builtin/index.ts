import type { ResumeThemeAdapter, ThemeCapabilities, ThemeDefaultConfig, FieldLabelMap } from "../types"
import { getThemeFieldProfile } from "../../theme-field-profiles"
import { RESUME_THEME_METADATA } from "../../themes-metadata"
import { stackoverflowAdapter } from "./stackoverflow"
import { paperCnAdapter } from "./paper-cn"
import { commonBuildRenderInput, commonRender } from "../build-input"

const BUILTIN_ADAPTERS = new Map<string, ResumeThemeAdapter>([
  ["stackoverflow", stackoverflowAdapter],
  ["paper_cn", paperCnAdapter],
])

export function getBuiltinAdapter(slug: string): ResumeThemeAdapter | undefined {
  return BUILTIN_ADAPTERS.get(slug)
}

export function getAllBuiltinAdapters(): ResumeThemeAdapter[] {
  return Array.from(BUILTIN_ADAPTERS.values())
}

function createFallbackCapabilities(): ThemeCapabilities {
  return {
    localeTitleSupport: "none",
    customOutputLabelSupport: "none",
    sectionOrderSupport: "none",
    appearanceSupport: "wrapperFallback",
    metaThemeSupport: "none",
    pdfSupport: "headlessCompatible",
    supportsChangeLanguage: false,
    builtInLocales: [],
    supportsDarkMode: false,
    builtInSections: [
      "basics",
      "work",
      "education",
      "skills",
      "projects",
      "awards",
      "publications",
      "languages",
      "interests",
      "volunteer",
      "references",
    ],
    localeMap: {},
  }
}

function createFallbackDefaults(): ThemeDefaultConfig {
  return {
    locale: "en-gb",
    appearance: "system",
    sectionOrder: [
      "work",
      "education",
      "projects",
      "skills",
      "awards",
      "publications",
      "languages",
      "interests",
      "volunteer",
      "references",
    ],
    fieldLabelMap: {},
    metaTheme: {},
  }
}

/**
 * Create a fallback adapter for themes that don't have an explicit builtin declaration.
 *
 * The fallback assumes minimal capabilities so the theme can still be rendered
 * without crashing, but advanced features (changeLanguage, sectionOrder, dark mode)
 * will be unavailable.
 */
export function createFallbackAdapter(slug: string, pkg: string): ResumeThemeAdapter {
  const meta = RESUME_THEME_METADATA[slug] ?? {}
  return {
    templateId: slug,
    templateName: meta.label ?? slug,
    pkg,
    category: "en",
    sortOrder: meta.sort ?? 9999,
    enabled: true,
    requiresIsolation: "mutex",
    sanitizeLevel: "standard",
    capabilities: createFallbackCapabilities(),
    defaults: createFallbackDefaults(),
    fieldProfile: getThemeFieldProfile(slug),
    buildRenderInput: commonBuildRenderInput,
    render: commonRender,
  }
}
