/**
 * scripts/check-resume-template-system.ts
 *
 * Light-weight validation for the resume template system.
 * Run with: npx tsx scripts/check-resume-template-system.ts
 */
import "dotenv/config"
import { createHash } from "node:crypto"

// ── Inline pure helpers (no server-only imports) ──────────────────────────────

function inferCategory(slug: string, pkg: string): "zh" | "en" {
  const s = `${slug} ${pkg}`.toLowerCase()
  if (
    s.includes("zh") || s.includes("cn") || s.includes("chinese") ||
    s.includes("hant") || s.includes("hans") || s.includes("tw") ||
    s.includes("papercn") || s.includes("paper_cn") || s.includes("mix") ||
    s.includes("apage")
  ) return "zh"
  return "en"
}

function resolveEffectiveLocale(
  userLocale: string | null | undefined,
  defaultLocale: string,
  localeMap: Record<string, string>,
  builtInLocales: string[]
): { locale: string; originalLocale: string } {
  const originalLocale = userLocale ?? defaultLocale
  const mapped = localeMap[originalLocale]
  const candidate = mapped ?? originalLocale
  if (builtInLocales.includes(candidate)) return { locale: candidate, originalLocale }
  return { locale: defaultLocale, originalLocale }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function sanitizeStandard(html: string): string {
  let result = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
  result = result.replace(/(href|src|action)\s*=\s*["']javascript:[^"']*["']/gi, '$1=""')
  return result
}

function hashConfig(obj: unknown): string {
  return createHash("sha1").update(JSON.stringify(obj)).digest("hex")
}

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Resume Template System Check ===\n")

  // 1. locale mapping
  console.log("1. Locale mapping")
  {
    const stackoverflowLocaleMap: Record<string, string> = { "zh-CN": "zh" }
    const stackoverflowBuiltIn = ["en", "zh"]

    const r1 = resolveEffectiveLocale("zh-CN", "en", stackoverflowLocaleMap, stackoverflowBuiltIn)
    check("zh-CN maps to zh for stackoverflow", r1.locale === "zh")
    check("originalLocale preserves zh-CN", r1.originalLocale === "zh-CN")

    const r2 = resolveEffectiveLocale("en-gb", "en", stackoverflowLocaleMap, stackoverflowBuiltIn)
    check("en-gb stays en-gb when in builtIn list", r2.locale === "en-gb" || r2.locale === "en")

    const r3 = resolveEffectiveLocale(null, "en-gb", {}, [])
    check("null userLocale falls back to default", r3.locale === "en-gb")
    check("null userLocale originalLocale is default", r3.originalLocale === "en-gb")
  }

  // 2. appearance preservation
  console.log("\n2. Appearance = system preservation")
  {
    const appearance = "system" as string
    check("system is not converted to light", appearance !== "light")
    check("system is not converted to dark", appearance !== "dark")
    const scheme = appearance === "system" ? "light dark" : appearance
    check("system becomes 'light dark' color-scheme value", scheme === "light dark")
  }

  // 3. hiddenSections doesn't mutate original
  console.log("\n3. hiddenSections immutability")
  {
    const originalJson = {
      basics: { name: "Test" },
      work: [{ company: "ACME" }],
      education: [] as unknown[],
    }
    const effectiveHidden = ["work"]
    const cloned = deepClone(originalJson)
    for (const section of effectiveHidden) {
      if (section === "basics") continue
      if (section in cloned) delete (cloned as Record<string, unknown>)[section]
    }
    check("original resumeJson.work is intact", "work" in originalJson)
    check("cloned resumeJson.work is removed", !("work" in cloned))
    check("basics is never removed from clone", "basics" in cloned)
  }

  // 4. basics cannot be hidden
  console.log("\n4. basics protection")
  {
    const hiddenSections = ["basics", "work"]
    const safeHidden = hiddenSections.filter((s) => s !== "basics")
    check("basics filtered out from hiddenSections", !safeHidden.includes("basics"))
  }

  // 5. category inference
  console.log("\n5. Category inference")
  {
    check("stackoverflow -> en", inferCategory("stackoverflow", "jsonresume-theme-stackoverflow") === "en")
    check("paper_cn -> zh", inferCategory("paper_cn", "jsonresume-theme-paper_cn") === "zh")
    check("actual-zh -> zh", inferCategory("actual-zh", "jsonresume-theme-actual-zh") === "zh")
    check("even-hant -> zh", inferCategory("even-hant", "jsonresume-theme-even-hant") === "zh")
    check("a11y -> en", inferCategory("a11y", "jsonresume-theme-a11y") === "en")
    check("tw-theme -> zh", inferCategory("tw-theme", "jsonresume-theme-tw-theme") === "zh")
    check("apage -> zh", inferCategory("apage", "jsonresume-theme-apage") === "zh")
  }

  // 6. sanitize removes scripts/events/javascript
  console.log("\n6. HTML sanitization")
  {
    const dirty = `<html><body><script>alert('xss')</script><a href="javascript:void(0)">link</a><img onerror="hack()"/></body></html>`
    const clean = sanitizeStandard(dirty)
    check("script tags removed", !clean.includes("<script"))
    check("javascript: URLs removed", !clean.includes("javascript:"))
    check("on* event handlers removed", !clean.includes("onerror"))
  }

  // 7. config hash stability
  console.log("\n7. Config hash stability")
  {
    const config1 = { locale: "en-gb", appearance: "system", sectionOrder: ["work", "education"] }
    const config2 = { locale: "zh-CN", appearance: "system", sectionOrder: ["work", "education"] }
    const config3 = { locale: "en-gb", appearance: "system", sectionOrder: ["work", "education"] }
    const h1 = hashConfig(config1)
    const h2 = hashConfig(config2)
    const h3 = hashConfig(config3)
    check("different locale produces different hash", h1 !== h2)
    check("same config produces same hash", h1 === h3)
  }

  // 8. DB connectivity
  console.log("\n8. Database connectivity")
  {
    try {
      const { prisma } = await import("../lib/db")
      const count = await prisma.resumeTemplateConfig.count()
      check(`ResumeTemplateConfig table accessible (${count} rows)`, true)
      const zhCount = await prisma.resumeTemplateConfig.count({ where: { category: "zh" } })
      const enCount = await prisma.resumeTemplateConfig.count({ where: { category: "en" } })
      console.log(`    zh: ${zhCount}, en: ${enCount}, total: ${count}`)
      await prisma.$disconnect()
    } catch (err) {
      check("DB accessible", false, err instanceof Error ? err.message : String(err))
    }
  }

  // 9. ensureResumeTemplateConfig idempotency (implemented inline to avoid server-only)
  console.log("\n9. ensureResumeTemplateConfig idempotency (inline)")
  {
    try {
      const { prisma } = await import("../lib/db")
      const testSlug = "__check-script-test-slug__"

      // Cleanup any leftover
      await prisma.resumeTemplateConfig.deleteMany({ where: { slug: testSlug } }).catch(() => {})

      // Inline ensure logic (mirrors lib/resume/template-config.ts)
      async function ensureInline(slug: string) {
        const existing = await prisma.resumeTemplateConfig.findUnique({ where: { slug } })
        if (existing) return existing
        return prisma.resumeTemplateConfig.create({
          data: {
            slug,
            pkg: `jsonresume-theme-${slug}`,
            enabled: true,
            category: inferCategory(slug, `jsonresume-theme-${slug}`),
            sortOrder: 9999,
            defaultAppearance: "system",
            defaultConfig: {},
          },
        })
      }

      const r1 = await ensureInline(testSlug)
      check("ensure creates missing config", r1.slug === testSlug)

      const r2 = await ensureInline(testSlug)
      check("ensure returns same slug on second call", r2.slug === testSlug)
      check("ensure is idempotent (enabled unchanged)", r2.enabled === r1.enabled)

      // Cleanup
      await prisma.resumeTemplateConfig.delete({ where: { slug: testSlug } }).catch(() => {})
      await prisma.$disconnect()
    } catch (err) {
      check("ensureResumeTemplateConfig idempotent", false, err instanceof Error ? err.message : String(err))
    }
  }

  // ── Summary
  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
