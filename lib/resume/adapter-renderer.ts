import "server-only"
import type { ResumeJson } from "./types"
import type { EffectiveResumeConfig } from "./adapters/types"
import { mergeEffectiveConfig, hashEffectiveConfig } from "./adapters/registry"
import { commonBuildRenderInput } from "./adapters/build-input"
import { resolveAdapterWithDb } from "./template-config"
import { postProcessHtml } from "./post-process"

export interface AdapterRenderOptions {
  resumeJson: ResumeJson
  selectedTheme: string | null | undefined
  userConfig?: {
    resumeLocale?: string | null
    resumeAppearance?: "system" | "light" | "dark" | null
    resumeConfig?: {
      sectionOrder?: string[]
      hiddenSections?: string[]
      fieldLabelMap?: Record<string, unknown>
      metaTheme?: Record<string, string>
    } | null
  } | null
  timeoutMs?: number
}

export type AdapterRenderResult =
  | {
      ok: true
      html: string
      slug: string
      pkg: string
      templateName: string
      effectiveConfig: EffectiveResumeConfig
      configHash: string
    }
  | {
      ok: false
      error: string
      slug?: string
    }

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Adapter-based renderer (production path since Stage 5).
 *
 * Flow:
 *   resolveAdapterWithDb → mergeEffectiveConfig → commonBuildRenderInput → adapter.render → postProcessHtml
 */
export async function renderResumeHtmlWithAdapter(
  options: AdapterRenderOptions
): Promise<AdapterRenderResult> {
  const slug = options.selectedTheme ?? "stackoverflow"

  try {
    // 1. Resolve adapter (builtin + DB override)
    const adapter = await resolveAdapterWithDb(slug)

    // 2. Merge effective config
    const effectiveConfig = mergeEffectiveConfig(adapter, options.userConfig)

    // 3. Build render input (deep-clones, injects meta, handles hiddenSections)
    const renderInput = commonBuildRenderInput({
      resumeJson: options.resumeJson,
      effectiveConfig,
      adapter,
    })

    // 4. Render with timeout
    const renderPromise = adapter.render({
      resumeJson: renderInput,
      effectiveConfig,
      adapter,
    })

    const html = await Promise.race([
      renderPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `渲染超时（>${(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s）`
              )
            ),
          options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        )
      ),
    ])

    // 5. Post-process (sanitize, appearance wrapper, adapter patch)
    const processedHtml = postProcessHtml(html, adapter, effectiveConfig)

    // 6. Compute config hash
    const configHash = hashEffectiveConfig(effectiveConfig)

    return {
      ok: true,
      html: processedHtml,
      slug: adapter.templateId,
      pkg: adapter.pkg,
      templateName: adapter.templateName,
      effectiveConfig,
      configHash,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      slug,
    }
  }
}
