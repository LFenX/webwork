import "server-only"
import { mkdir, writeFile, readFile, rm, stat, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import {
  LATEX_MAX_BODY_CHARS,
  LATEX_MAX_PDF_BYTES,
  LATEX_PDF_KIND,
  LATEX_PDF_TTL_MS,
  getLatexBuildDir,
  getLatexUploadDir,
} from "@/lib/latex/config"
import { applyTemplateDefaults, getLatexTemplate, getTemplateSampleBody, renderLatexDocument } from "@/lib/latex/templates"
import { DEFAULT_DOC_CONFIG, normalizeDocConfig, type LatexDocConfig } from "@/lib/latex/config-schema"
import { getDocConfig, getLastBodySnapshot, setLastBodySnapshot, getTemplatesLoaded } from "@/lib/latex/doc-config-service"
import { buildBodySnapshot, resolveBodySource, requiresTemplateLoad } from "@/lib/latex/body-snapshot"
import { inspectPdf, detectRestyleContentLoss } from "@/lib/latex/pdf-inspect"
import { sanitizeLatexBody, scrubLatexLog } from "@/lib/latex/sanitize"
import { runXelatexPass } from "@/lib/latex/compiler-runner"
import { assessBody } from "@/lib/latex/quality"
import { assessCompleteness, verifyCompiledPdf, topSectionTitles } from "@/lib/latex/completeness"

export type CompileLatexParams = {
  conversationId?: string
  // The authored body. Required UNLESS reuseLastBody is true (restyle).
  bodyLatex?: string
  // Explicit restyle: reuse the conversation's last compiled body verbatim and
  // re-render it with the (possibly new) template/theme/palette. No implicit
  // "empty body means reuse" — the caller must opt in.
  reuseLastBody?: boolean
  // The model's planned outline (top-level section titles). Used by the
  // completeness gate to detect a truncated body, and by the post-compile
  // verification to confirm the rendered PDF contains every planned chapter.
  expectedSections?: string[]
  // Optional one-off overrides; otherwise the saved conversation config is used.
  template?: string
  theme?: string
  palette?: string
  cjkFont?: string
  paragraphStyle?: string
  paperSize?: string
  title?: string
  subtitle?: string
  author?: string
}

// Merge the saved conversation config with any per-call overrides into the final
// document config used for rendering.
async function resolveDocConfig(userId: string, params: CompileLatexParams): Promise<LatexDocConfig> {
  const saved = params.conversationId ? await getDocConfig(userId, params.conversationId) : { ...DEFAULT_DOC_CONFIG }
  let base = saved
  if (params.template && params.template !== saved.templateId && getLatexTemplate(params.template)) {
    base = applyTemplateDefaults(saved, params.template)
  }
  const override: Partial<LatexDocConfig> = {}
  if (params.template) override.templateId = params.template
  if (params.theme) override.theme = params.theme
  if (params.palette) override.palette = params.palette
  if (params.cjkFont) override.cjkFont = params.cjkFont as LatexDocConfig["cjkFont"]
  if (params.paragraphStyle) override.paragraphStyle = params.paragraphStyle as LatexDocConfig["paragraphStyle"]
  if (params.paperSize) override.paperSize = params.paperSize as LatexDocConfig["paperSize"]
  if (params.title !== undefined) override.title = params.title
  if (params.subtitle !== undefined) override.subtitle = params.subtitle
  if (params.author !== undefined) override.author = params.author
  return normalizeDocConfig({ ...base, ...override }, base)
}

export type CompileLatexResult = {
  uploadId: string
  filename: string
  downloadUrl: string
  sizeBytes: number
  // Truthful metadata for the model to report from (never self-claimed).
  usedBodySource: "provided" | "last_compiled_body"
  bodyHash: string
  bodyCharCount: number
  sectionCount: number
  sectionTitles: string[]
  expectedSectionCount: number
  pdfPageCount: number
  templatesLoaded: boolean
  selectedTemplate: string
  selectedTheme: string
  selectedPalette: string
}

export type CompileLatexOutcome =
  | { ok: true, data: CompileLatexResult }
  | { ok: false, error: string, reason: string, guidance?: string[] }

// Pull the meaningful "! ..." error lines out of the LaTeX log, scrubbed of any
// local paths, so the user sees a short friendly summary while the full log goes
// to the server console only.
function summarizeLatexError(log: string): string {
  const lines = scrubLatexLog(log).split(/\r?\n/)
  const errors: string[] = []
  for (const line of lines) {
    if (line.startsWith("!")) {
      errors.push(line.replace(/\s+/g, " ").trim())
      if (errors.length >= 2) break
    }
  }
  const detail = errors.length > 0 ? errors.join(" / ") : "未知编译错误"
  return `LaTeX 编译失败：${detail}`.slice(0, 280)
}

// Rough count of real prose in a body, ignoring section headers and LaTeX
// commands. Used to spot a "skeleton" body — section titles but (almost) no
// content — which would otherwise compile into a near-empty PDF (cover + blank
// table of contents). A genuine document scores in the thousands; a skeleton of
// bare \section lines scores close to zero.
const MIN_BODY_PROSE = 200

function bodyProseLength(body: string): number {
  return body
    .replace(/\\(sub)?section\*?\{[^}]*\}/g, "") // drop heading titles
    .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, "") // drop commands and their optional args
    .replace(/[{}[\]\\]/g, "")
    .replace(/\s+/g, "")
    .length
}

function pdfFilename() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `${date}-${randomBytes(4).toString("hex")}.pdf`
}

function downloadFilename(title: string) {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "document"
  return `${cleaned}.pdf`
}

// Delete the files of generated PDFs older than the TTL (rows are kept as
// tombstones so an expired link can still show a friendly "已清除" message).
// Runs opportunistically on each compile, so no cron job is required.
export async function cleanupExpiredLatexPdfs(userId: string) {
  const cutoff = new Date(Date.now() - LATEX_PDF_TTL_MS)
  const expired = await prisma.upload.findMany({
    where: { userId, kind: LATEX_PDF_KIND, createdAt: { lt: cutoff }, storagePath: { not: null } },
    select: { id: true, storagePath: true },
  })
  for (const item of expired) {
    if (item.storagePath) {
      await rm(path.join(process.cwd(), item.storagePath), { force: true }).catch(() => undefined)
    }
    await prisma.upload.update({ where: { id: item.id }, data: { storagePath: null, size: 0 } }).catch(() => undefined)
  }
}

export async function compileLatexForUser(userId: string, params: CompileLatexParams): Promise<CompileLatexOutcome> {
  await cleanupExpiredLatexPdfs(userId).catch(() => undefined)
  const config = await resolveDocConfig(userId, params)
  const template = getLatexTemplate(config.templateId)
  if (!template) return { ok: false, error: `模板 ${config.templateId} 不存在。`, reason: "invalid_template" }
  if (!config.title.trim()) return { ok: false, error: "缺少文档标题，请先设置标题。", reason: "title_required" }

  // ---- Body source resolution (EXPLICIT — no implicit "empty means reuse") ----
  const existingSnapshot = params.conversationId
    ? await getLastBodySnapshot(userId, params.conversationId).catch(() => null)
    : null
  const resolution = resolveBodySource(params, existingSnapshot)
  if (!resolution.ok) {
    return { ok: false, error: resolution.error, reason: resolution.reason, guidance: resolution.guidance }
  }
  const { bodyLatex, usedBodySource, baseSnapshot } = resolution

  if (bodyLatex.length > LATEX_MAX_BODY_CHARS) {
    return { ok: false, error: "正文过长，超出编译上限。", reason: "body_too_long" }
  }

  // list_latex_templates gate: the first PDF in a conversation must be preceded by
  // loading the template/theme/palette options — unless the user explicitly chose
  // one (those are still validated by the enum schema + resolveDocConfig).
  const explicitChoice = Boolean(params.template || params.theme || params.palette)
  const templatesLoadedFlag = params.conversationId
    ? await getTemplatesLoaded(userId, params.conversationId).catch(() => false)
    : false
  if (requiresTemplateLoad({
    usedBodySource,
    hasConversation: Boolean(params.conversationId),
    hasExistingSnapshot: Boolean(existingSnapshot),
    templatesLoaded: templatesLoadedFlag,
    explicitChoice,
  })) {
    return {
      ok: false,
      error: "首次生成 PDF 前请先调用 list_latex_templates 了解可用模板、主题与配色，再选择合适配置后生成。",
      reason: "template_options_not_loaded",
      guidance: ["首次 PDF 生成前请先调用 list_latex_templates，了解可用模板、主题和配色，再选择合适配置。"],
    }
  }
  const templatesLoaded = templatesLoadedFlag || explicitChoice || Boolean(existingSnapshot)

  // Provided bodies must be complete and structured. Reused snapshots already
  // passed these checks when first saved, so they skip them.
  if (usedBodySource === "provided") {
    if (bodyProseLength(bodyLatex) < 150) {
      return {
        ok: false,
        error: "正文内容过少（缺少实际内容，或只有章节标题没有正文），可能未写完。请把【完整正文】（含各级 \\section 标题与全部段落内容）放入 bodyLatex；只换样式不改内容请改用 reuseLastBody=true。",
        reason: "body_incomplete",
        guidance: [
          "提供完整 bodyLatex（含各级 \\section 与全部内容）",
          "若只是换样式/主题/配色：设置 reuseLastBody=true 复用上次正文",
        ],
      }
    }
    const quality = assessBody(bodyLatex, config.templateId)
    if (!quality.ok) {
      return { ok: false, error: quality.message, reason: quality.code, guidance: quality.guidance }
    }
    // Completeness gate: catch a truncated / outline-incomplete long body BEFORE
    // compiling, so we never produce a half-finished PDF the model calls complete.
    const completeness = assessCompleteness(bodyLatex, params.expectedSections)
    if (!completeness.ok) {
      return { ok: false, error: completeness.message, reason: completeness.reason, guidance: completeness.guidance }
    }
  }

  const safe = sanitizeLatexBody(bodyLatex)
  if (!safe.ok) {
    return { ok: false, error: `正文包含不允许的命令（${safe.label}），请移除后重试。`, reason: "unsafe_body" }
  }

  const tex = renderLatexDocument(config, bodyLatex)
  if (!tex) return { ok: false, error: `模板 ${config.templateId} 不存在。`, reason: "invalid_template" }

  const jobId = randomUUID()
  const buildDir = getLatexBuildDir(userId, jobId)
  await mkdir(buildDir, { recursive: true })

  try {
    await writeFile(path.join(buildDir, "main.tex"), tex, "utf8")
    const pdfPath = path.join(buildDir, "main.pdf")
    const backupPath = path.join(buildDir, "main.pass1.pdf")

    // One extra XeLaTeX pass on the SAME build dir / aux file. XeLaTeX truncates
    // main.pdf at the start of each run, so back up a good PDF and restore it if a
    // later pass fails to produce a valid one.
    const runPass = async (): Promise<void> => {
      if (existsSync(pdfPath)) await copyFile(pdfPath, backupPath).catch(() => undefined)
      const r = await runXelatexPass(buildDir, "main.tex").catch(() => null)
      if ((!r || r.code !== 0) && existsSync(backupPath)) {
        await copyFile(backupPath, pdfPath).catch(() => undefined)
      }
    }
    // ≥2 passes resolve the TOC and \pageref{LastPage}.
    const first = await runXelatexPass(buildDir, "main.tex")
    await runPass()

    if (!existsSync(pdfPath)) {
      const log = await readFile(path.join(buildDir, "main.log"), "utf8").catch(() => "")
      console.error(`[latex] compile failed for user ${userId} job ${jobId} (exit ${first.code}):\n${log.slice(-6000)}`)
      return { ok: false, error: summarizeLatexError(log || first.stdout), reason: "compile_failed" }
    }

    const info = await stat(pdfPath)
    if (info.size > LATEX_MAX_PDF_BYTES) {
      return { ok: false, error: "生成的 PDF 超出大小上限。", reason: "pdf_too_large" }
    }

    // Best-effort reverse-inspection (page count + text) of the rendered PDF.
    let inspection = await inspectPdf(pdfPath).catch(() => null)
    // If cross-references are still unresolved ("共 ?? 页" / "??" in TOC), run a
    // third pass and re-inspect.
    if (inspection && /\?\?/.test(inspection.text)) {
      await runPass()
      const reinspect = await inspectPdf(pdfPath).catch(() => null)
      if (reinspect) inspection = reinspect
    }
    const pdfPageCount = inspection?.pageCount ?? 0

    // Restyle content-preservation guard: if we reused a snapshot but the rendered
    // PDF lost its content (cover/TOC only, or section titles gone), refuse — never
    // return a success card for a hollow restyle.
    if (usedBodySource === "last_compiled_body" && baseSnapshot && inspection) {
      const lossReason = detectRestyleContentLoss(inspection, baseSnapshot)
      if (lossReason) {
        console.error(`[latex] restyle content loss (${lossReason}) for user ${userId} job ${jobId}.`)
        return {
          ok: false,
          error: "换样式后正文明显丢失（疑似只剩封面/目录），已阻止返回。请重新提供完整正文后再生成。",
          reason: "restyle_content_lost",
          guidance: ["复用正文后渲染结果异常；请重新提供完整 bodyLatex 重新生成完整 PDF。"],
        }
      }
    }

    // Rendered-PDF completeness verification (all compiles): the PDF must actually
    // contain the planned/authored sections and have no unresolved "??" refs.
    // Catches a truncated-but-compiled body and unresolved cross-references.
    if (inspection) {
      const bodyTitles = baseSnapshot?.sectionTitles ?? topSectionTitles(bodyLatex)
      const verify = verifyCompiledPdf(inspection, { bodyTitles, expectedOutline: params.expectedSections })
      if (!verify.ok) {
        console.error(`[latex] compiled pdf incomplete (${verify.detail}) for user ${userId} job ${jobId}.`)
        return { ok: false, error: verify.message, reason: verify.reason, guidance: verify.guidance }
      }
    }

    const uploadDir = getLatexUploadDir(userId)
    await mkdir(uploadDir, { recursive: true })
    const filename = pdfFilename()
    const destPath = path.join(uploadDir, filename)
    await copyFile(pdfPath, destPath)

    const buf = await readFile(destPath)
    const sha256 = createHash("sha256").update(buf).digest("hex")
    const storagePath = path.join("storage", "uploads", userId, filename)

    const upload = await prisma.upload.create({
      data: {
        userId,
        filename,
        originalName: downloadFilename(config.title),
        mimeType: "application/pdf",
        size: info.size,
        url: "",
        storagePath,
        sha256,
        kind: LATEX_PDF_KIND,
      },
      select: { id: true },
    })
    const downloadUrl = `/api/uploads/${upload.id}`
    await prisma.upload.update({ where: { id: upload.id }, data: { url: downloadUrl } })

    const finalSnapshot = baseSnapshot ?? buildBodySnapshot(bodyLatex, config.templateId)

    // Persist the snapshot ONLY for a freshly PROVIDED, substantial body — never
    // overwrite a good snapshot with a reused / short / structureless one.
    if (params.conversationId && usedBodySource === "provided"
      && finalSnapshot.sectionCount > 0 && bodyProseLength(bodyLatex) >= MIN_BODY_PROSE) {
      await setLastBodySnapshot(userId, params.conversationId, finalSnapshot).catch(() => undefined)
    }

    return {
      ok: true,
      data: {
        uploadId: upload.id,
        filename: downloadFilename(config.title),
        downloadUrl,
        sizeBytes: info.size,
        usedBodySource,
        bodyHash: finalSnapshot.bodyHash,
        bodyCharCount: finalSnapshot.bodyCharCount,
        sectionCount: finalSnapshot.sectionCount,
        sectionTitles: finalSnapshot.sectionTitles,
        expectedSectionCount: params.expectedSections?.length ?? 0,
        pdfPageCount,
        templatesLoaded,
        selectedTemplate: config.templateId,
        selectedTheme: config.theme,
        selectedPalette: config.palette,
      },
    }
  } catch (error) {
    console.error(`[latex] compile error for user ${userId} job ${jobId}:`, error)
    const message = error instanceof Error && /timed out/i.test(error.message)
      ? "LaTeX 编译超时，文档可能过于复杂。"
      : "LaTeX 编译失败，请稍后重试。"
    return { ok: false, error: message, reason: "compile_error" }
  } finally {
    await rm(buildDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// Compile a template's built-in sample with the given config and return the PDF
// bytes (not persisted). Used by the live preview in the template modal. Safe:
// the body is a fixed sample, config fields are validated/enumerated.
export async function compilePreviewPdf(config: LatexDocConfig): Promise<{ ok: true, pdf: Buffer } | { ok: false, error: string }> {
  const template = getLatexTemplate(config.templateId)
  if (!template) return { ok: false, error: "模板不存在" }
  const cfg: LatexDocConfig = { ...config, title: config.title.trim() || template.name }
  const tex = renderLatexDocument(cfg, getTemplateSampleBody(cfg.templateId))
  if (!tex) return { ok: false, error: "渲染失败" }

  const jobId = randomUUID()
  const buildDir = getLatexBuildDir("_preview", jobId)
  await mkdir(buildDir, { recursive: true })
  try {
    await writeFile(path.join(buildDir, "main.tex"), tex, "utf8")
    const pdfPath = path.join(buildDir, "main.pdf")
    const backupPath = path.join(buildDir, "main.pass1.pdf")
    const first = await runXelatexPass(buildDir, "main.tex")
    if (existsSync(pdfPath)) {
      await copyFile(pdfPath, backupPath).catch(() => undefined)
      const second = await runXelatexPass(buildDir, "main.tex").catch(() => null)
      if ((!second || second.code !== 0) && existsSync(backupPath)) {
        await copyFile(backupPath, pdfPath).catch(() => undefined)
      }
    }
    if (!existsSync(pdfPath)) {
      const log = await readFile(path.join(buildDir, "main.log"), "utf8").catch(() => "")
      console.error(`[latex] preview compile failed (exit ${first.code}):\n${log.slice(-4000)}`)
      return { ok: false, error: summarizeLatexError(log || first.stdout) }
    }
    return { ok: true, pdf: await readFile(pdfPath) }
  } catch (error) {
    console.error("[latex] preview compile error:", error)
    return { ok: false, error: "预览编译失败，请稍后重试。" }
  } finally {
    await rm(buildDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
