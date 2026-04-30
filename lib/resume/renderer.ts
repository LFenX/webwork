import "server-only"
import type { ResumeJson, ResumeRenderResult } from "./types"
import {
  getAvailableResumeThemes, resolveResumeTheme, getDefaultResumeTheme, loadThemeModule,
} from "./themes"
import { adaptResumeForTheme } from "./theme-adapters"
import { renderResumeHtmlWithAdapter } from "./adapter-renderer"
import type { AdapterRenderOptions } from "./adapter-renderer"

const RENDER_TIMEOUT_MS = 10_000

type RenderFn = (j: ResumeJson) => string | Promise<string>

function pickRender(mod: unknown): RenderFn | null {
  if (!mod) return null
  const m = mod as Record<string, unknown>
  if (typeof m.render === "function") return m.render as RenderFn
  const def = m.default as Record<string, unknown> | undefined
  if (def && typeof def.render === "function") return def.render as RenderFn
  if (typeof m.default === "function") return m.default as RenderFn
  return null
}

// 临时隔离第三方主题的 console 输出和 process.emitWarning，防止污染 Next 服务端日志
function suppressOutput(): () => void {
  const noop = () => {}
  const methods = ["log", "warn", "error", "info", "debug"] as const
  const saved: Partial<Record<typeof methods[number], unknown>> = {}
  for (const m of methods) {
    saved[m] = console[m]
    ;(console as unknown as Record<string, unknown>)[m] = noop
  }
  const origEmitWarning = process.emitWarning.bind(process)
  process.emitWarning = noop as typeof process.emitWarning
  return () => {
    for (const m of methods) {
      ;(console as unknown as Record<string, unknown>)[m] = saved[m]
    }
    process.emitWarning = origEmitWarning
  }
}

async function tryRender(slug: string, pkg: string, json: ResumeJson):
  Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const restore = suppressOutput()
  try {
    const mod = loadThemeModule(pkg)
    const renderFn = pickRender(mod)
    if (!renderFn) return { ok: false, error: `主题 ${slug} 未导出 render 函数` }

    const normalized = adaptResumeForTheme(json, slug)
    const html = await Promise.race([
      Promise.resolve(renderFn(normalized)),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`渲染超时（>${RENDER_TIMEOUT_MS / 1000}s），请切换其他主题`)),
          RENDER_TIMEOUT_MS,
        ),
      ),
    ])
    if (typeof html !== "string" || html.length === 0) {
      return { ok: false, error: `主题 ${slug} 渲染结果为空` }
    }
    return { ok: true, html }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    restore()
  }
}

export async function renderResumeHtml(input: {
  resumeJson: ResumeJson;
  selectedTheme: string | null | undefined;
  allowFallback?: boolean;
  userConfig?: AdapterRenderOptions["userConfig"];
}): Promise<ResumeRenderResult> {
  const allowFallback = input.allowFallback !== false

  // Stage 5: try adapter path first when userConfig is present
  if (input.userConfig) {
    const adapterResult = await renderResumeHtmlWithAdapter({
      resumeJson: input.resumeJson,
      selectedTheme: input.selectedTheme,
      userConfig: input.userConfig,
    })

    if (adapterResult.ok) {
      return {
        ok: true,
        html: adapterResult.html,
        usedTheme: {
          slug: adapterResult.slug,
          pkg: adapterResult.pkg,
          label: adapterResult.templateName,
          available: true,
          version: "",
          description: "",
          tags: [],
          sortKey: 0,
        },
        fallback: false,
      }
    }

    if (!allowFallback) {
      return { ok: false, code: "render_failed", error: adapterResult.error }
    }
    // Continue to legacy fallback
  }

  const resolved = resolveResumeTheme(input.selectedTheme)
  if (!resolved.ok) return { ok: false, code: "no_themes", error: resolved.error }
  const usedTheme = resolved.theme
  const fallback = resolved.fallback

  const r = await tryRender(usedTheme.slug, usedTheme.pkg, input.resumeJson)
  if (r.ok) return { ok: true, html: r.html, usedTheme, fallback }

  if (!allowFallback) {
    return { ok: false, code: "render_failed", error: r.error }
  }

  const others = getAvailableResumeThemes().filter((t) => t.available && t.slug !== usedTheme.slug)
  if (others.length > 0) {
    const next = getDefaultResumeTheme(others)
    const r2 = await tryRender(next.slug, next.pkg, input.resumeJson)
    if (r2.ok) return { ok: true, html: r2.html, usedTheme: next, fallback: true }
  }
  return { ok: false, code: "render_failed", error: r.error }
}
