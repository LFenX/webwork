import "server-only"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import type { ResumeThemeInfo } from "./types"
import { RESUME_THEME_METADATA } from "./themes-metadata"
import {
  isThemeVerified,
  isThemeDisabled,
  getThemeDisabledReason,
  DEFAULT_THEME_PREFERENCE_ORDER,
} from "./theme-compat"

// 必须与 next.config.js 中的同名正则保持一致
export const RESUME_THEME_NAME_REGEX = /^jsonresume-theme-[a-z0-9][a-z0-9-]*$/

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"))

let cache: { at: number; themes: ResumeThemeInfo[] } | null = null
const CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60_000 : 5_000

function readMainPackageJson(): { dependencies?: Record<string,string>; devDependencies?: Record<string,string> } {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"))
  } catch { return {} }
}

function discoverCandidates(): string[] {
  const pkg = readMainPackageJson()
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  return Object.keys(all).filter((n) => RESUME_THEME_NAME_REGEX.test(n))
}

// 不执行 require、不执行 render——仅通过 allowlist / force-disabled 判断可用性
function loadThemeInfo(pkgName: string): ResumeThemeInfo {
  const slug = pkgName.replace(/^jsonresume-theme-/, "")
  const meta = RESUME_THEME_METADATA[slug] ?? {}
  let version = ""; let description = ""
  let available = false; let reason: string | undefined

  // 读取 package.json 元信息（不用 require，只读 JSON 文件）
  try {
    const resolved = requireFromRoot.resolve(pkgName)
    let dir = path.dirname(resolved)
    while (dir !== path.dirname(dir)) {
      const pj = path.join(dir, "package.json")
      if (fs.existsSync(pj)) {
        const p = JSON.parse(fs.readFileSync(pj, "utf8"))
        if (p.name === pkgName) { version = p.version || ""; description = p.description || ""; break }
      }
      dir = path.dirname(dir)
    }
  } catch (err) {
    available = false
    reason = `模块解析失败：${err instanceof Error ? err.message : String(err)}`
    return {
      slug, pkg: pkgName, version, available, unavailableReason: reason,
      description: meta.description ?? description ?? "",
      label: meta.label ?? slug,
      tags: meta.tags ?? [],
      recommendedFor: meta.recommendedFor,
      sortKey: meta.sort ?? 9999,
    }
  }

  // 判断可用性：disabled > verified > unverified
  // 只有 verified 主题才是 available=true
  if (isThemeDisabled(slug)) {
    available = false
    reason = getThemeDisabledReason(slug) ?? "该主题已被禁用"
  } else if (isThemeVerified(slug)) {
    available = true
  } else {
    available = false
    reason = "该主题尚未验证服务端渲染兼容性，请等待管理员验证"
  }

  return {
    slug, pkg: pkgName, version, available, unavailableReason: reason,
    description: meta.description ?? description ?? "",
    label: meta.label ?? slug,
    tags: meta.tags ?? [],
    recommendedFor: meta.recommendedFor,
    sortKey: meta.sort ?? 9999,
  }
}

export function getAvailableResumeThemes(opts?: { force?: boolean }): ResumeThemeInfo[] {
  if (!opts?.force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.themes
  const themes = discoverCandidates().map(loadThemeInfo)
  themes.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
    // verified 主题优先
    const aSafe = a.available ? 0 : 1
    const bSafe = b.available ? 0 : 1
    if (aSafe !== bSafe) return aSafe - bSafe
    // 偏好顺序
    const aPref = DEFAULT_THEME_PREFERENCE_ORDER.indexOf(a.slug)
    const bPref = DEFAULT_THEME_PREFERENCE_ORDER.indexOf(b.slug)
    if (aPref !== -1 && bPref === -1) return -1
    if (aPref === -1 && bPref !== -1) return 1
    if (aPref !== -1 && bPref !== -1 && aPref !== bPref) return aPref - bPref
    return a.slug.localeCompare(b.slug)
  })
  cache = { at: Date.now(), themes }
  return themes
}

export function resolveResumeTheme(slug: string | null | undefined):
  | { ok: true; theme: ResumeThemeInfo; fallback: boolean }
  | { ok: false; code: "no_themes"; error: string } {
  const all = getAvailableResumeThemes().filter((t) => t.available)
  if (all.length === 0) return { ok: false, code: "no_themes", error: "没有可用的简历主题" }

  if (slug) {
    const want = all.find((t) => t.slug === slug)
    if (want) return { ok: true, theme: want, fallback: false }
  }
  const def = getDefaultResumeTheme(all)
  return { ok: true, theme: def, fallback: !!slug }
}

export function getDefaultResumeTheme(available: ResumeThemeInfo[]): ResumeThemeInfo {
  for (const pref of DEFAULT_THEME_PREFERENCE_ORDER) {
    const found = available.find((t) => t.slug === pref)
    if (found) return found
  }
  return available[0]
}

export function loadThemeModule(pkgName: string): unknown {
  return requireFromRoot(pkgName)
}
