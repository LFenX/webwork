import "server-only"

// Completeness gates for long PDF bodies — the missing guarantee on top of the
// structure-only quality gate. They catch the failure where a model truncates a
// long bodyLatex mid-way, LaTeX still compiles, and a half-finished PDF is
// returned while the model claims "all 10 chapters written".
//
// Two layers:
//   assessCompleteness(body, expectedOutline?) — SOURCE check before compile.
//   verifyCompiledPdf(inspection, …)            — RENDERED check after compile.

export type CompletenessResult =
  | { ok: true; sectionCount: number; sectionTitles: string[] }
  | {
      ok: false
      reason: "body_incomplete_by_outline" | "probable_truncation"
      message: string
      guidance: string[]
      sectionCount: number
      sectionTitles: string[]
      missing: string[]
    }

// Top-level \section titles only (outline granularity).
export function topSectionTitles(body: string): string[] {
  const titles: string[] = []
  const re = /\\section\*?\{([^}]{1,120})\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim()
    if (t) titles.push(t)
  }
  return titles
}

// A body that ends on a list-introducer / colon / comma, or with unbalanced
// environments/braces, or without sentence-final punctuation, is almost
// certainly cut off mid-thought.
const TRUNCATION_TAIL = /(包括|如下|分别为|分别是|分别有|例如|有以下|有如下|以下|为)\s*[:：]?\s*$|[:：，,、；;]\s*$/
const ENDS_CLEAN = /[。！？.!?）)\]】»”"』」]\s*$|\\end\{[^}]+\}\s*$|\\\]\s*$|[}]\s*$|\\dividerline\s*$/

// Strong-signal-only truncation (no "doesn't end with a period" heuristic), for
// per-chapter checks where a clean-but-unpunctuated ending is acceptable.
export function hasHardTruncation(body: string): boolean {
  const trimmed = body.trimEnd()
  if (!trimmed) return false
  if (TRUNCATION_TAIL.test(trimmed)) return true
  if ((body.match(/\\begin\{/g) ?? []).length !== (body.match(/\\end\{/g) ?? []).length) return true
  if ((body.match(/{/g) ?? []).length !== (body.match(/}/g) ?? []).length) return true
  return false
}

export function detectTruncation(body: string): { truncated: boolean; tail: string } {
  const trimmed = body.trimEnd()
  if (!trimmed) return { truncated: false, tail: "" }
  const tail = trimmed.slice(-24)
  if (TRUNCATION_TAIL.test(trimmed)) return { truncated: true, tail }
  if ((body.match(/\\begin\{/g) ?? []).length !== (body.match(/\\end\{/g) ?? []).length) return { truncated: true, tail }
  if ((body.match(/{/g) ?? []).length !== (body.match(/}/g) ?? []).length) return { truncated: true, tail }
  if (!ENDS_CLEAN.test(trimmed)) return { truncated: true, tail }
  return { truncated: false, tail }
}

function normTitle(t: string): string {
  return t.replace(/\s+/g, "").replace(/[\d.、：:．，,（）()【】\[\]]/g, "")
}

export function assessCompleteness(bodyLatex: string, expectedOutline?: string[]): CompletenessResult {
  const sectionTitles = topSectionTitles(bodyLatex)
  const sectionCount = sectionTitles.length

  const trunc = detectTruncation(bodyLatex)
  if (trunc.truncated) {
    return {
      ok: false,
      reason: "probable_truncation",
      message: `正文疑似在中途被截断（结尾为“…${trunc.tail.trim()}”），可能未写完。请补全所有内容与章节后再编译。`,
      guidance: [
        "正文似乎在句中或列表引导词后被截断，请补全剩余内容。",
        "提供包含全部计划章节、且每节内容完整收尾的 bodyLatex，不要中途停笔。",
      ],
      sectionCount,
      sectionTitles,
      missing: [],
    }
  }

  const outline = (expectedOutline ?? []).map((s) => s.trim()).filter(Boolean)
  if (outline.length > 0) {
    const bodyNorm = sectionTitles.map(normTitle)
    const missing = outline.filter((exp) => {
      const e = normTitle(exp)
      return e.length > 0 && !bodyNorm.some((bt) => bt.includes(e) || e.includes(bt))
    })
    const tooFew = sectionCount < Math.ceil(outline.length * 0.9)
    if (missing.length > 0 || tooFew) {
      return {
        ok: false,
        reason: "body_incomplete_by_outline",
        message: `计划了 ${outline.length} 个章节，但正文只写了 ${sectionCount} 个 \\section${missing.length ? `，缺少：${missing.join("、")}` : "（数量不足）"}。请补齐所有章节的完整内容后再编译。`,
        guidance: [
          `按计划补齐全部 ${outline.length} 个章节：${outline.join("、")}`,
          missing.length ? `当前缺失：${missing.join("、")}` : "当前章节数量不足，疑似中途截断。",
          "把所有章节的完整内容一次性放入 bodyLatex；若内容太长易被截断，请用草稿/分章方式逐节写入后再编译。",
        ],
        sectionCount,
        sectionTitles,
        missing,
      }
    }
  }
  return { ok: true, sectionCount, sectionTitles }
}

// ---- Post-compile rendered verification ----
export type PdfVerifyResult =
  | { ok: true }
  | { ok: false; reason: "compiled_pdf_incomplete"; detail: string; message: string; guidance: string[] }

function compact(text: string): string {
  return text.replace(/\s+/g, "")
}

function missingTitles(text: string, titles: string[]): string[] {
  const c = compact(text)
  return titles.filter((t) => {
    const k = compact(t)
    return k.length > 1 && !c.includes(k)
  })
}

// Verify the RENDERED PDF text against the expected outline / authored titles.
// Catches "??" unresolved refs (LastPage / TOC) and missing sections (truncation
// that still compiled).
export function verifyCompiledPdf(
  inspection: { text: string; pageCount: number },
  opts: { bodyTitles: string[]; expectedOutline?: string[] },
): PdfVerifyResult {
  const text = inspection.text
  if (/\?\?/.test(text)) {
    return {
      ok: false,
      reason: "compiled_pdf_incomplete",
      detail: "unresolved_references",
      message: "PDF 中出现未解析的交叉引用（“??”，通常是“共 ?? 页”或目录页码未生成），视为不完整。",
      guidance: ["需要再编译一遍以解析交叉引用；若仍出现 ?? 请检查 \\pageref/\\ref 与目录。"],
    }
  }
  const outline = (opts.expectedOutline ?? []).filter(Boolean)
  if (outline.length > 0) {
    const miss = missingTitles(text, outline)
    if (miss.length > Math.floor(outline.length * 0.2)) {
      return {
        ok: false,
        reason: "compiled_pdf_incomplete",
        detail: "sections_missing_in_pdf",
        message: `编译后的 PDF 缺少 ${miss.length} 个计划章节（共 ${outline.length}）：${miss.join("、")}，疑似正文被截断或未渲染完整。`,
        guidance: ["补齐缺失章节的完整内容后重新编译，确保 PDF 实际包含全部计划章节。"],
      }
    }
  }
  if (opts.bodyTitles.length > 0) {
    const miss = missingTitles(text, opts.bodyTitles)
    if (miss.length > Math.ceil(opts.bodyTitles.length * 0.4)) {
      return {
        ok: false,
        reason: "compiled_pdf_incomplete",
        detail: "body_titles_missing_in_pdf",
        message: `编译后的 PDF 与正文章节不一致，缺少约 ${miss.length} 个章节标题，疑似渲染不完整（可能有未闭合环境吞掉了后段）。`,
        guidance: ["检查正文是否有未闭合的 \\begin/\\end 或括号，补全后重新编译。"],
      }
    }
  }
  return { ok: true }
}
