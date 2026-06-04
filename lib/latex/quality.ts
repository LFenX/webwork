import "server-only"

// Pre-compile quality gate. A soft check that catches the classic weak-model
// failure: a long wall of plain prose with no structure, or a long-form document
// with no sections. It is CONTENT-TYPE AWARE so short/structured documents
// (cards, briefings, one-pagers) are never falsely rejected. The result is fed
// back to the model as a tool error with actionable guidance, and the runtime
// loop lets it self-repair — it does not abort the task.

export type BodyQuality =
  | { ok: true }
  | { ok: false; code: "body_low_quality"; message: string; guidance: string[] }

// Content types that legitimately may have no \section / structure (a single
// designed page). Empty today — every current content type is expected to be
// structured — but reserved for future resume / poster / card / certificate
// types so the no-structure check skips them.
const SHORT_TYPES = new Set<string>([])

// Long-form content types that should carry explicit \section structure.
const LONG_FORM_TYPES = new Set([
  "academic-paper",
  "modern-report",
  "knowledge-handbook",
  "course-notes",
  "project-proposal",
  "reading-notes",
  "general-document",
])

// Any of: a heading, a structural/layout environment, or a structural macro —
// i.e. the body is organized rather than a flat paragraph dump. Layout envs
// (center/minipage/multicols…) let deliberately-designed short docs (cards,
// invitations, posters) count as structured.
const STRUCTURE_RE =
  /\\(section|subsection|chapter)\b|\\begin\{(itemize|enumerate|prettytable|tblr|longtblr|tabular|table|mistake|factbox|definition|theorem|example|note|tip|success|warning|danger|callout|keypoint|infocard|quotebox|code|abstract|summary|center|flushright|minipage|multicols|tcolorbox|verse|description)\}|\\(statcard|callout|keypoint|infocard|milestone|fact|field|lead)\b/

// Rough count of real prose, excluding headings and LaTeX commands.
function proseLength(body: string): number {
  return body
    .replace(/\\(sub)?section\*?\{[^}]*\}/g, "")
    .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, "")
    .replace(/[{}[\]\\]/g, "")
    .replace(/\s+/g, "")
    .length
}

function sectionCount(body: string): number {
  return (body.match(/\\section\b/g) ?? []).length
}

export function assessBody(body: string, templateId: string): BodyQuality {
  const prose = proseLength(body)
  // Tiny bodies are handled by the earlier body_incomplete check (prose < 150).
  // Anything past that line is substantial enough to deserve some structure.
  if (prose < 150) return { ok: true }
  // Designed single-page types are exempt from the structure requirement.
  if (SHORT_TYPES.has(templateId)) return { ok: true }

  if (!STRUCTURE_RE.test(body)) {
    return {
      ok: false,
      code: "body_low_quality",
      message: "正文是一大段未分块的纯文字，缺少结构，编译出的 PDF 会很简陋。请重写为结构化正文后再编译。",
      guidance: [
        "拆成 3–7 个 \\section（必要时加 \\subsection）",
        "首节用 \\lead{导语} 或 \\dropcap{首}字下沉开篇",
        "关键要点用 callout / keypoint 突出（每节至多一个）",
        "表格型数据用 prettytable，并列条目用 itemize / enumerate",
      ],
    }
  }

  if (LONG_FORM_TYPES.has(templateId) && prose > 1500 && sectionCount(body) < 2) {
    return {
      ok: false,
      code: "body_low_quality",
      message: "这是长文档，但几乎没有章节结构。请补足 \\section 层级后再编译。",
      guidance: [
        "至少分成 3–7 个 \\section，按逻辑组织",
        "用组件给内容断句：要点 callout、数据 prettytable、提示 note",
        "首节用 \\lead 或 \\dropcap 开篇",
      ],
    }
  }

  return { ok: true }
}
