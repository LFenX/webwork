import type { ResumeJson } from "./types"

const STANDARD_ARRAYS = [
  "work", "volunteer", "education", "awards", "publications",
  "skills", "languages", "interests", "references", "projects",
] as const

// ── Internal helpers ──────────────────────────────────────────────────────────

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function normalizeDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  return s
}

function isValidUrl(v: unknown): boolean {
  if (typeof v !== "string" || !v.trim()) return false
  const s = v.trim()
  try { new URL(s); return true } catch { return false }
}

function cleanUrl(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] === "string" && !isValidUrl(obj[key])) {
    delete obj[key]
  }
}

// ── Default adapter ───────────────────────────────────────────────────────────
// Mirrors the old normalizeForRender, extended with date normalization + URL cleanup.

function applyDefaultAdapter(json: Record<string, unknown>): void {
  // 1. Ensure all standard arrays exist
  for (const key of STANDARD_ARRAYS) {
    if (!Array.isArray(json[key])) json[key] = []
  }

  // 2. Ensure basics is a plain object
  if (!json.basics || typeof json.basics !== "object" || Array.isArray(json.basics)) {
    json.basics = {}
  }
  const basics = json.basics as Record<string, unknown>

  // 3. Ensure basics.profiles is an array
  if (!Array.isArray(basics.profiles)) basics.profiles = []

  // 4. Normalize dates in timeline sections
  for (const key of ["work", "volunteer", "education", "projects"] as const) {
    const arr = json[key]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const sd = normalizeDate(o.startDate)
      if (sd !== undefined) o.startDate = sd; else delete o.startDate
      const ed = normalizeDate(o.endDate)
      if (ed !== undefined) o.endDate = ed; else delete o.endDate
    }
  }

  // Normalize awards.date
  const awards = json.awards
  if (Array.isArray(awards)) {
    for (const item of awards) {
      const o = item as Record<string, unknown>
      const d = normalizeDate(o.date)
      if (d !== undefined) o.date = d; else delete o.date
    }
  }

  // 5. Remove empty/invalid URL strings to prevent broken <a href="">
  cleanUrl(basics, "url")
  cleanUrl(basics, "image")

  if (Array.isArray(basics.profiles)) {
    for (const p of basics.profiles) {
      cleanUrl(p as Record<string, unknown>, "url")
    }
  }

  const work = json.work
  if (Array.isArray(work)) {
    for (const w of work) cleanUrl(w as Record<string, unknown>, "url")
  }
  const education = json.education
  if (Array.isArray(education)) {
    for (const e of education) cleanUrl(e as Record<string, unknown>, "url")
  }
  const projects = json.projects
  if (Array.isArray(projects)) {
    for (const p of projects) cleanUrl(p as Record<string, unknown>, "url")
  }
}

// ── Theme-specific adapters ───────────────────────────────────────────────────

/** Derive startDateYear / endDateYear from startDate / endDate for themes that need them. */
function addDateYearFields(json: Record<string, unknown>): void {
  for (const key of ["work", "education", "projects", "volunteer"] as const) {
    const arr = json[key]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      const o = item as Record<string, unknown>
      if (typeof o.startDate === "string") {
        const m = o.startDate.match(/^(\d{4})/)
        if (m) o.startDateYear = m[1]
      }
      if (typeof o.endDate === "string") {
        const m = o.endDate.match(/^(\d{4})/)
        if (m) o.endDateYear = m[1]
      }
    }
  }
}

// Registry of extra per-theme post-processors
const THEME_EXTRA_ADAPTERS: Record<string, (json: Record<string, unknown>) => void> = {
  kards: addDateYearFields,
  kendall: addDateYearFields,
  "kendall-web": addDateYearFields,
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a rendering-safe copy of the given resumeJson adapted for the theme.
 *
 * - Deep-clones the input; the caller's object is never mutated.
 * - Fills missing standard array fields (same guarantee as old normalizeForRender).
 * - Normalizes dates; removes invalid URL strings.
 * - Applies any theme-specific structural adjustments.
 * - Never adds fabricated resume content.
 */
export function adaptResumeForTheme(resumeJson: ResumeJson, themeSlug: string): ResumeJson {
  const cloned = deepClone(resumeJson) as Record<string, unknown>
  applyDefaultAdapter(cloned)
  const extra = THEME_EXTRA_ADAPTERS[themeSlug]
  if (extra) extra(cloned)
  return cloned as ResumeJson
}
