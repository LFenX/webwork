import "server-only"
import fs from "node:fs"
import path from "node:path"
import {
  BUILT_IN_VERIFIED_THEMES,
  BUILT_IN_DISABLED_THEMES,
  DEFAULT_THEME_PREFERENCE_ORDER,
} from "./theme-compat-defaults"

export {
  BUILT_IN_VERIFIED_THEMES,
  BUILT_IN_DISABLED_THEMES,
  DEFAULT_THEME_PREFERENCE_ORDER,
}

// ---- 类型 ----

export type ThemeCompatEntry = {
  pkg: string
  version?: string
  /** 仅 disabled/failed 时有值 */
  reason?: string
  /** 仅 verified 时有值 */
  verifiedAt?: string
  /** 仅 disabled/failed 时有值 */
  checkedAt?: string
  /** 仅 verified 时有值 */
  htmlLength?: number
}

export type ThemeCompatFile = {
  verified: Record<string, ThemeCompatEntry>
  disabled: Record<string, ThemeCompatEntry>
}

// ---- 内部状态 ----

const DATA_FILE = path.join(process.cwd(), "data", "resume-theme-compat.json")

let _fileCache: ThemeCompatFile | null = null
let _fileCacheAt = 0
const FILE_CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 60_000 : 3_000

function readCompatFile(): ThemeCompatFile {
  if (_fileCache && Date.now() - _fileCacheAt < FILE_CACHE_TTL_MS) return _fileCache
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8")
      const parsed = JSON.parse(raw)
      _fileCache = {
        verified: parsed.verified ?? {},
        disabled: parsed.disabled ?? {},
      }
    } else {
      _fileCache = { verified: {}, disabled: {} }
    }
  } catch {
    _fileCache = { verified: {}, disabled: {} }
  }
  _fileCacheAt = Date.now()
  return _fileCache
}

function writeCompatFile(data: ThemeCompatFile): void {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8")
    _fileCache = data
    _fileCacheAt = Date.now()
  } catch (err) {
    console.error("[theme-compat] 无法写入 compat 文件:", err instanceof Error ? err.message : String(err))
    throw new Error("无法写入主题兼容配置文件，请检查文件系统权限")
  }
}

// ---- 查询 API ----

/** 返回合并后的 verified 集合（built-in + 文件） */
export function getVerifiedThemes(): Record<string, ThemeCompatEntry> {
  const merged: Record<string, ThemeCompatEntry> = {}
  // built-in verified
  for (const [slug, entry] of Object.entries(BUILT_IN_VERIFIED_THEMES)) {
    merged[slug] = { ...entry }
  }
  // 文件 verified（覆盖/补充）
  const file = readCompatFile()
  for (const [slug, entry] of Object.entries(file.verified)) {
    merged[slug] = { ...merged[slug], ...entry }
  }
  return merged
}

/** 返回合并后的 disabled 集合（built-in + 文件） */
export function getDisabledThemes(): Record<string, ThemeCompatEntry> {
  const merged: Record<string, ThemeCompatEntry> = {}
  // built-in disabled
  for (const [slug, entry] of Object.entries(BUILT_IN_DISABLED_THEMES)) {
    merged[slug] = { ...entry }
  }
  // 文件 disabled（覆盖/补充）
  const file = readCompatFile()
  for (const [slug, entry] of Object.entries(file.disabled)) {
    merged[slug] = { ...merged[slug], ...entry }
  }
  return merged
}

/** 判断某个 slug 是否 verified */
export function isThemeVerified(slug: string): boolean {
  return slug in getVerifiedThemes()
}

/** 判断某个 slug 是否 disabled */
export function isThemeDisabled(slug: string): boolean {
  return slug in getDisabledThemes()
}

/** 获取某个 slug 的状态 */
export function getThemeCompatStatus(slug: string): "verified" | "disabled" | "unverified" {
  if (isThemeVerified(slug)) return "verified"
  if (isThemeDisabled(slug)) return "disabled"
  return "unverified"
}

/** 获取某个 slug 的 disabled reason */
export function getThemeDisabledReason(slug: string): string | undefined {
  return getDisabledThemes()[slug]?.reason
}

/** 获取所有已验证 slug 集合 */
export function getVerifiedSlugs(): Set<string> {
  return new Set(Object.keys(getVerifiedThemes()))
}

// ---- 写 API（仅管理员调用） ----

/** 将主题标记为 verified */
export function markThemeVerified(slug: string, entry: Omit<ThemeCompatEntry, "pkg"> & { pkg?: string }): void {
  const file = readCompatFile()
  const pkg = entry.pkg ?? `jsonresume-theme-${slug}`
  file.verified[slug] = { ...entry, pkg }
  // 从 disabled 中移除
  delete file.disabled[slug]
  writeCompatFile(file)
}

/** 将主题标记为 disabled */
export function markThemeDisabled(slug: string, entry: Omit<ThemeCompatEntry, "pkg"> & { pkg?: string }): void {
  const file = readCompatFile()
  const pkg = entry.pkg ?? `jsonresume-theme-${slug}`
  file.disabled[slug] = { ...entry, pkg }
  // 从 verified 中移除
  delete file.verified[slug]
  writeCompatFile(file)
}

/** 将主题从未验证状态移除（如果它不在 built-in 中） */
export function removeThemeCompatEntry(slug: string): void {
  const file = readCompatFile()
  delete file.verified[slug]
  delete file.disabled[slug]
  writeCompatFile(file)
}

/** 重新加载缓存（外部验证脚本写入文件后调用） */
export function invalidateCompatCache(): void {
  _fileCache = null
  _fileCacheAt = 0
}
