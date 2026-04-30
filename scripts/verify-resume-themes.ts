// 简历主题验证脚本
// 用法：npx tsx scripts/verify-resume-themes.ts [--all] [--slug=xxx] [--include-disabled]
// 每个主题在独立子进程中验证，stdout 只输出结果，日志被 worker 内部捕获。
// 验证成功的主题会在 data/resume-theme-snapshots/<slug>.html 生成预览快照。

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(__dirname, "..") as string
const PKG_PATH = path.join(ROOT, "package.json")
const WORKER = path.join(ROOT, "scripts", "verify-resume-theme-worker.cjs")
const COMPAT_FILE = path.join(ROOT, "data", "resume-theme-compat.json")
const SNAPSHOT_DIR = path.join(ROOT, "data", "resume-theme-snapshots")
const REGEX = /^jsonresume-theme-[a-z0-9][a-z0-9-]*$/

// 硬禁用主题：默认不参与批量验证，且不生成 snapshot
const HARD_DISABLED: Record<string, string> = {
  even:     "依赖 @rbardini/html ESM-only",
  eventide: "依赖 @rbardini/html ESM-only",
  cjean:    "render 返回 object",
  react:    "浏览器环境依赖 / Zod 校验 / window.location",
  github:   "使用 Dart Sass 编译 @primer/css，产生大量 deprecation warning，污染服务端日志",
}

function parseArgs(): { all: boolean; slug: string | null; includeDisabled: boolean } {
  const args = process.argv.slice(2)
  let all = false, slug: string | null = null, includeDisabled = false
  for (const a of args) {
    if (a === "--all") all = true
    else if (a === "--include-disabled") includeDisabled = true
    else if (a.startsWith("--slug=")) slug = a.slice("--slug=".length)
  }
  if (!all && !slug) all = true
  return { all, slug, includeDisabled }
}

function discoverThemes(): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"))
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    return Object.keys(deps).filter((k) => REGEX.test(k)).sort()
  } catch { return [] }
}

function readCompatFile() {
  try { return fs.existsSync(COMPAT_FILE) ? JSON.parse(fs.readFileSync(COMPAT_FILE, "utf8")) : {} } catch { return {} }
}
function writeCompatFile(data: unknown) {
  const dir = path.dirname(COMPAT_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(COMPAT_FILE, JSON.stringify(data, null, 2), "utf8")
}

function ensureSnapshotDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
}

function verifyTheme(pkgName: string): Record<string, unknown> {
  const slug = pkgName.replace(/^jsonresume-theme-/, "")
  let version = ""
  try {
    const pjPath = path.join(ROOT, "node_modules", pkgName, "package.json")
    if (fs.existsSync(pjPath)) version = JSON.parse(fs.readFileSync(pjPath, "utf8")).version || ""
  } catch { /* ignore */ }

  if (slug in HARD_DISABLED) {
    // 如果 snapshot 存在则清除（主题被禁用后不应保留快照）
    const snapPath = path.join(SNAPSHOT_DIR, `${slug}.html`)
    if (fs.existsSync(snapPath)) {
      try { fs.unlinkSync(snapPath) } catch { /* ignore */ }
    }
    return { slug, pkg: pkgName, version, ok: false, error: HARD_DISABLED[slug], skipped: "hard-disabled" }
  }

  const snapshotPath = path.join(SNAPSHOT_DIR, `${slug}.html`)
  const result = spawnSync("node", [WORKER, pkgName, snapshotPath], {
    cwd: ROOT, timeout: 18_000, encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  })

  const stdout = result.stdout?.trim() || ""

  if (result.error || result.status === null) {
    return { slug, pkg: pkgName, version, ok: false, error: result.error?.message || "子进程启动失败" }
  }

  try {
    const parsed = JSON.parse(stdout)
    return { slug, pkg: pkgName, version, ...parsed }
  } catch {
    const lines = stdout.split("\n").filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try { const parsed = JSON.parse(lines[i]); return { slug, pkg: pkgName, version, ...parsed } } catch { /* continue */ }
    }
    const stderr = result.stderr?.trim() || ""
    return { slug, pkg: pkgName, version, ok: false, error: (stderr || stdout).substring(0, 200) }
  }
}

function main() {
  const { all, slug: targetSlug, includeDisabled } = parseArgs()
  const allThemes = discoverThemes()

  let toVerify = allThemes
  if (targetSlug) {
    toVerify = allThemes.filter((t) => t.replace(/^jsonresume-theme-/, "") === targetSlug)
    if (toVerify.length === 0) { console.log(`未找到主题 "${targetSlug}"`); return }
  }

  if (!includeDisabled) {
    toVerify = toVerify.filter((t) => {
      const slug = t.replace(/^jsonresume-theme-/, "")
      return !(slug in HARD_DISABLED)
    })
  }

  if (toVerify.length === 0) {
    console.log("无需要验证的主题（内置禁用主题已跳过，使用 --include-disabled 强制验证）")
    return
  }

  ensureSnapshotDir()
  console.log(`验证 ${toVerify.length} 个主题（快照输出到 data/resume-theme-snapshots/）\n`)

  const results: Array<Record<string, unknown>> = []
  for (const pkgName of toVerify) {
    const slug = pkgName.replace(/^jsonresume-theme-/, "")
    process.stdout.write(`${slug} ... `)
    const r = verifyTheme(pkgName)
    results.push(r)
    if (r.skipped) {
      console.log(`⏭ ${r.skipped}`)
    } else if (r.ok) {
      const extra = []
      if (r.noisy) extra.push("noisy")
      if (r.deprecationCount && Number(r.deprecationCount) > 0) extra.push(`${r.deprecationCount} deprecations`)
      if (r.warnings && (r.warnings as string).length > 0) {
        const wc = (r.warnings as string).split("\n").length
        extra.push(`${wc} warnings`)
      }
      const snapOk = fs.existsSync(path.join(SNAPSHOT_DIR, `${slug}.html`))
      const snapMark = snapOk ? " 📸" : ""
      console.log(`✅ ${r.htmlLength} bytes${extra.length ? " (" + extra.join(", ") + ")" : ""}${snapMark}`)
    } else {
      const err = (r.error as string || "").substring(0, 80)
      console.log(`❌ ${err}`)
    }
  }

  // 写入 compat 文件
  const compat = readCompatFile()
  const verified: Record<string, unknown> = {}
  const disabled: Record<string, unknown> = {}

  // 保留硬禁用主题原有记录
  for (const [slug, info] of Object.entries(compat.disabled || {})) {
    if (slug in HARD_DISABLED) { disabled[slug as string] = info }
  }
  for (const [slug, info] of Object.entries(compat.verified || {})) {
    if (!(slug as string in HARD_DISABLED) && !results.find(r => r.slug === slug && !r.ok)) {
      verified[slug as string] = info
    }
  }

  // 硬禁用主题始终写入 disabled（覆盖可能残留的 verified 条目）
  const now = new Date().toISOString()
  for (const [slug, reason] of Object.entries(HARD_DISABLED)) {
    const pkg = `jsonresume-theme-${slug}`
    let version = ""
    try {
      const pjPath = path.join(ROOT, "node_modules", pkg, "package.json")
      if (fs.existsSync(pjPath)) version = JSON.parse(fs.readFileSync(pjPath, "utf8")).version || ""
    } catch { /* ignore */ }
    disabled[slug] = { pkg, version, reason, checkedAt: now }
    delete verified[slug]
  }

  for (const r of results) {
    if (r.skipped) continue
    const slug = r.slug as string
    if (slug in HARD_DISABLED) continue
    if (r.ok) {
      verified[slug] = {
        pkg: r.pkg, version: r.version, verifiedAt: now,
        htmlLength: r.htmlLength,
        noisy: r.noisy || false,
        deprecationCount: r.deprecationCount || 0,
      }
      // noisy 主题从 verified 降级为 disabled
      if (r.noisy) {
        disabled[slug] = {
          pkg: r.pkg, version: r.version,
          reason: `渲染时产生过多 warning/deprecation（${r.deprecationCount || "?"} 次），已自动降级`,
          checkedAt: now, noisy: true,
        }
        delete verified[slug]
      }
    } else {
      disabled[slug] = {
        pkg: r.pkg, version: r.version,
        reason: r.error || "验证失败", checkedAt: now,
        noisy: r.noisy || false,
      }
    }
  }

  writeCompatFile({ verified, disabled })

  const okCount = results.filter((r) => r.ok && !r.noisy).length
  const noisyCount = results.filter((r) => r.ok && r.noisy).length
  const skipCount = results.filter((r) => r.skipped).length
  const failCount = results.filter((r) => !r.ok && !r.skipped).length
  const snapCount = results.filter((r) => r.ok && !r.noisy && fs.existsSync(path.join(SNAPSHOT_DIR, `${r.slug}.html`))).length
  console.log(`\n通过: ${okCount}  降级(noisy): ${noisyCount}  失败: ${failCount}  跳过: ${skipCount}  快照: ${snapCount}/${okCount}`)
  console.log(`结果已写入 ${path.relative(ROOT, COMPAT_FILE)}`)
  console.log(`快照已存入 ${path.relative(ROOT, SNAPSHOT_DIR)}/`)
}

main()
