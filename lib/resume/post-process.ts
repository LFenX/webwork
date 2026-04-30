import "server-only"
import type { ResumeThemeAdapter, EffectiveResumeConfig } from "./adapters/types"

export function postProcessHtml(
  html: string,
  adapter: ResumeThemeAdapter,
  effectiveConfig: EffectiveResumeConfig
): string {
  let result = html

  // 1. Sanitize
  switch (adapter.sanitizeLevel) {
    case "standard":
      result = sanitizeStandard(result)
      break
    case "minimal":
      result = sanitizeMinimal(result)
      break
    case "none":
    default:
      break
  }

  // 2. Adapter-specific HTML patch
  if (
    adapter.capabilities.customOutputLabelSupport === "htmlPatch" &&
    typeof adapter.patchHtml === "function"
  ) {
    result = adapter.patchHtml(result, effectiveConfig)
  }

  // 3. Appearance wrapper fallback
  if (adapter.capabilities.appearanceSupport === "wrapperFallback") {
    result = wrapAppearance(result, effectiveConfig.appearance)
  }

  // 4. Inject <base target="_blank"> so links open in new tabs, not inside the iframe
  result = injectBaseTarget(result)

  return result
}

function sanitizeStandard(html: string): string {
  // Remove script tags and their contents
  let result = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
  // Remove on* event handlers
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
  // Remove javascript: URLs
  result = result.replace(/(href|src|action)\s*=\s*["']javascript:[^"']*["']/gi, '$1=""')
  return result
}

function sanitizeMinimal(html: string): string {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
}

function wrapAppearance(html: string, appearance: "system" | "light" | "dark"): string {
  const scheme = appearance === "system" ? "light dark" : appearance
  return `<div style="color-scheme: ${scheme}; background-color: canvas; min-height: 100vh;">${html}</div>`
}

function injectBaseTarget(html: string): string {
  if (/<base\b[^>]*target=/i.test(html)) return html
  const headClose = html.match(/<head[^>]*>/i)
  if (headClose) {
    return html.replace(headClose[0], `${headClose[0]}<base target="_blank">`)
  }
  return `<base target="_blank">${html}`
}
