import type { ResumeJson } from "../types"
import type {
  BuildRenderInputArgs,
  RenderArgs,
  ResumeThemeAdapter,
} from "./types"
import { withThemeLock } from "../render-lock"

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Common buildRenderInput implementation.
 *
 * Rules:
 * - Deep-clone resumeJson; never mutate the caller's object.
 * - Remove hiddenSections from the temporary clone only.
 * - basics is mandatory and cannot be hidden.
 * - Inject meta.locale = effectiveConfig.locale.
 * - Inject meta.theme.sectionOrder only if adapter supports it.
 * - Inject meta.theme.headings only if adapter supports custom output labels via meta.
 * - Inject meta.theme.colorScheme = effectiveConfig.appearance (preserves "system").
 * - Shallow-merge metaTheme: adapter.defaults < user overrides.
 * - NEVER stuff hidden data into _meta._hidden.
 * - NEVER mutate the original resumeJson stored in DB.
 */
export function commonBuildRenderInput({
  resumeJson,
  effectiveConfig,
  adapter,
}: BuildRenderInputArgs): ResumeJson {
  // 1. Deep clone so the original resumeJson is untouched
  const renderResumeJson = deepClone(resumeJson)

  // 2. Remove hidden sections from the temporary object only
  for (const section of effectiveConfig.hiddenSections) {
    if (section === "basics") continue // mandatory
    if (section in renderResumeJson) {
      delete (renderResumeJson as Record<string, unknown>)[section]
    }
  }

  // 3. Ensure meta object exists
  if (!renderResumeJson.meta || typeof renderResumeJson.meta !== "object") {
    renderResumeJson.meta = {}
  }
  const meta = renderResumeJson.meta as Record<string, unknown>

  // 4. Inject meta.locale (always write as a safety net)
  meta.locale = effectiveConfig.locale

  // 5. Ensure meta.theme exists
  if (!meta.theme || typeof meta.theme !== "object") {
    meta.theme = {}
  }
  const metaTheme = meta.theme as Record<string, unknown>

  // 6. Inject sectionOrder if adapter supports it via meta
  if (
    adapter.capabilities.sectionOrderSupport === "metaSectionOrder" &&
    effectiveConfig.sectionOrder.length > 0
  ) {
    metaTheme.sectionOrder = effectiveConfig.sectionOrder
  }

  // 7. Inject headings if adapter supports custom output labels via meta.theme.headings
  if (
    adapter.capabilities.customOutputLabelSupport === "metaHeadings" &&
    effectiveConfig.fieldLabelMap.sections &&
    Object.keys(effectiveConfig.fieldLabelMap.sections).length > 0
  ) {
    metaTheme.headings = effectiveConfig.fieldLabelMap.sections
  }

  // 8. Inject colorScheme (preserve "system" value; do not resolve here)
  metaTheme.colorScheme = effectiveConfig.appearance

  // 9. Shallow-merge metaTheme overrides
  // Priority: user effectiveConfig.metaTheme > adapter.defaults.metaTheme
  const mergedMetaTheme = {
    ...adapter.defaults.metaTheme,
    ...effectiveConfig.metaTheme,
  }
  for (const [key, value] of Object.entries(mergedMetaTheme)) {
    metaTheme[key] = value
  }

  return renderResumeJson
}

/**
 * Common render implementation for standard jsonresume-theme-* packages.
 *
 * - Acquires per-package mutex via withThemeLock.
 * - Handles changeLanguage if adapter declares localeTitleSupport === "changeLanguage".
 * - Supports module shapes: mod.render / mod.default.render / mod.default.
 * - Returns HTML string.
 */
export async function commonRender({
  resumeJson,
  effectiveConfig,
  adapter,
}: RenderArgs): Promise<string> {
  return withThemeLock(adapter.pkg, async () => {
    const { createRequire } = await import("node:module")
    const path = await import("node:path")
    const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"))
    const mod = requireFromRoot(adapter.pkg) as Record<string, unknown>

    // Pick render function
    let renderFn: (j: unknown) => string | Promise<string>
    if (typeof mod.render === "function") {
      renderFn = mod.render as (j: unknown) => string | Promise<string>
    } else {
      const def = mod.default as Record<string, unknown> | undefined
      if (def && typeof def.render === "function") {
        renderFn = def.render as (j: unknown) => string | Promise<string>
      } else if (typeof mod.default === "function") {
        renderFn = mod.default as (j: unknown) => string | Promise<string>
      } else {
        throw new Error(
          `主题 ${adapter.templateId} (${adapter.pkg}) 未导出 render 函数`
        )
      }
    }

    // Apply changeLanguage if supported and locale is built-in
    if (adapter.capabilities.localeTitleSupport === "changeLanguage") {
      const resolvedLocale = effectiveConfig.locale
      if (adapter.capabilities.builtInLocales.includes(resolvedLocale)) {
        const changeLanguage = (mod as Record<string, unknown>).changeLanguage
        if (typeof changeLanguage === "function") {
          ;(changeLanguage as (locale: string) => void)(resolvedLocale)
        }
      }
    }

    const html = await Promise.resolve(renderFn(resumeJson))
    if (typeof html !== "string") {
      throw new Error(
        `主题 ${adapter.templateId} 渲染结果类型为 ${typeof html}，期望 string`
      )
    }
    return html
  })
}
