/**
 * Compile preview thumbnails and render page 1 to PNGs under public/latex-previews/:
 *   - <templateId>.png        — each content type under its default theme
 *   - themes/<themeId>.png     — a representative content type under each theme
 * Doubles as a compile smoke-test.
 *
 * Run with: NODE_OPTIONS=--conditions=react-server npx tsx scripts/generate-latex-previews.ts
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, copyFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { listLatexTemplates, renderLatexDocument, getTemplateSampleBody, applyTemplateDefaults } from "@/lib/latex/templates"
import { listLatexThemes } from "@/lib/latex/themes"
import { DEFAULT_DOC_CONFIG, type LatexDocConfig } from "@/lib/latex/config-schema"

const root = process.cwd()
const outDir = path.join(root, "public", "latex-previews")
const themeOutDir = path.join(outDir, "themes")
const buildRoot = path.join(root, "tmp", "latex-preview-build")
const python = path.join(root, ".venv-pdf", "Scripts", "python.exe")

mkdirSync(outDir, { recursive: true })
mkdirSync(themeOutDir, { recursive: true })
rmSync(buildRoot, { recursive: true, force: true })

let ok = 0
let fail = 0

// Render a config to a page-1 PNG. Returns true on success.
function renderToPng(id: string, config: LatexDocConfig, outPng: string): boolean {
  const tex = renderLatexDocument(config, getTemplateSampleBody(config.templateId))
  if (!tex) {
    console.error(`RENDER FAIL ${id}`)
    return false
  }
  const dir = path.join(buildRoot, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "main.tex"), tex, "utf8")
  const pdf = path.join(dir, "main.pdf")
  const backup = path.join(dir, "main.pass1.pdf")
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1 && existsSync(pdf)) copyFileSync(pdf, backup)
    const r = spawnSync("xelatex", ["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "main.tex"], {
      cwd: dir,
      env: { ...process.env, PYTHONUTF8: "1" },
      encoding: "utf8",
    })
    // XeLaTeX truncates main.pdf on each run; restore the good first pass if the
    // second fails to produce a valid PDF.
    if (pass === 1 && !existsSync(pdf) && existsSync(backup)) copyFileSync(backup, pdf)
    if (pass === 1 && r.status !== 0 && existsSync(backup)) copyFileSync(backup, pdf)
  }
  if (!existsSync(pdf)) {
    const log = existsSync(path.join(dir, "main.log")) ? readFileSync(path.join(dir, "main.log"), "utf8") : ""
    const err = log.split(/\r?\n/).filter((l) => l.startsWith("!")).slice(0, 2).join(" | ")
    console.error(`COMPILE FAIL ${id}: ${err}`)
    return false
  }
  const pyCode = `import fitz; d=fitz.open(r'${pdf}'); p=d[0].get_pixmap(dpi=110); p.save(r'${outPng}')`
  const pr = spawnSync(python, ["-c", pyCode], { encoding: "utf8" })
  if (pr.status !== 0) {
    console.error(`PNG FAIL ${id}: ${pr.stderr}`)
    return false
  }
  return true
}

// 1) One thumbnail per content type, under its default theme.
for (const t of listLatexTemplates()) {
  const base = applyTemplateDefaults(
    { ...DEFAULT_DOC_CONFIG, title: t.name, subtitle: "样式预览", author: "蝶灵", date: "2026" },
    t.id,
  )
  // Thumbnails show the content/components on page 1 (skip cover + TOC pages).
  const config = { ...base, cover: false, toc: false }
  if (renderToPng(t.id, config, path.join(outDir, `${t.id}.png`))) {
    console.log(`OK  type ${t.id}`)
    ok++
  } else {
    fail++
  }
}

// 2) One thumbnail per visual theme, using a component-rich content type so the
//    fonts/headings/box styling are all visible.
const themeSample = "knowledge-handbook"
for (const th of listLatexThemes()) {
  const config: LatexDocConfig = {
    ...DEFAULT_DOC_CONFIG,
    templateId: themeSample,
    theme: th.id,
    title: th.name,
    subtitle: "样式预览",
    author: "蝶灵",
    date: "2026",
    cover: false,
    toc: false,
  }
  if (renderToPng(`theme-${th.id}`, config, path.join(themeOutDir, `${th.id}.png`))) {
    console.log(`OK  theme ${th.id}`)
    ok++
  } else {
    fail++
  }
}

rmSync(buildRoot, { recursive: true, force: true })
console.log(`\nDone: ${ok} ok, ${fail} fail`)
if (fail > 0) process.exit(1)
