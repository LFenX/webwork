import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { prisma } from "../lib/db"
import {
  BUILT_IN_VERIFIED_THEMES,
  BUILT_IN_DISABLED_THEMES,
} from "../lib/resume/theme-compat-defaults"
import { RESUME_THEME_METADATA } from "../lib/resume/themes-metadata"

const RESUME_THEME_NAME_REGEX = /^jsonresume-theme-[a-z0-9][a-z0-9_-]*$/

function readMainPackageJson(): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"))
  } catch { return {} }
}

function readCompatFile(): { verified: Record<string, unknown>; disabled: Record<string, unknown> } {
  const file = path.join(process.cwd(), "data", "resume-theme-compat.json")
  try {
    const raw = fs.readFileSync(file, "utf8")
    const parsed = JSON.parse(raw)
    return { verified: parsed.verified ?? {}, disabled: parsed.disabled ?? {} }
  } catch {
    return { verified: {}, disabled: {} }
  }
}

function discoverCandidates(): string[] {
  const pkg = readMainPackageJson()
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  return Object.keys(all).filter((n) => RESUME_THEME_NAME_REGEX.test(n))
}

function guessCategory(slug: string, pkg: string): "zh" | "en" {
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

function guessDefaultLocale(category: "zh" | "en"): string {
  return category === "zh" ? "zh-CN" : "en-gb"
}

function isDisabled(slug: string): boolean {
  if (slug in BUILT_IN_DISABLED_THEMES) return true
  const file = readCompatFile()
  return slug in file.disabled
}

async function main() {
  const candidates = discoverCandidates()
  let created = 0
  let updated = 0

  for (const pkgName of candidates) {
    const slug = pkgName.replace(/^jsonresume-theme-/, "")
    const meta = RESUME_THEME_METADATA[slug] ?? {}

    const existing = await prisma.resumeTemplateConfig.findUnique({
      where: { slug },
    })

    const category = guessCategory(slug, pkgName)
    const defaultLocale = guessDefaultLocale(category)
    const enabled = !isDisabled(slug)
    const sortOrder = meta.sort ?? 9999

    if (!existing) {
      await prisma.resumeTemplateConfig.create({
        data: {
          slug,
          pkg: pkgName,
          enabled,
          category,
          sortOrder,
          displayName: meta.label ?? slug,
          description: meta.description ?? "",
          defaultLocale,
          defaultAppearance: "system",
          defaultConfig: {},
        },
      })
      created++
    } else {
      const patch: Record<string, unknown> = {}
      if (existing.pkg !== pkgName) patch.pkg = pkgName
      // Re-categorize from "en" to "zh" if inference says zh and updatedById is null
      // (indicates auto-generated, not manually edited by admin)
      if (!existing.category || existing.category === "") patch.category = category
      else if (existing.category === "en" && category === "zh" && !existing.updatedById) {
        patch.category = "zh"
        patch.defaultLocale = "zh-CN"
      }
      if (existing.sortOrder == null) patch.sortOrder = sortOrder
      if (!existing.displayName) patch.displayName = meta.label ?? slug
      if (!existing.description) patch.description = meta.description ?? ""
      if (!existing.defaultLocale) patch.defaultLocale = defaultLocale
      if (!existing.defaultAppearance) patch.defaultAppearance = "system"

      if (Object.keys(patch).length > 0) {
        await prisma.resumeTemplateConfig.update({
          where: { slug },
          data: patch,
        })
        updated++
      }
    }
  }

  console.log(`Seed complete: created=${created}, updated=${updated}, totalPackages=${candidates.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
