import "server-only"
import { createHash } from "node:crypto"

// A protected snapshot of the last successfully-compiled body for a conversation.
// Restyle ("换个模板/主题/配色") reuses this exact body instead of relying on the
// model to re-send it. Never overwritten by an empty / short / structureless body.
export type LastBodySnapshot = {
  bodyLatex: string
  bodyHash: string
  bodyCharCount: number
  sectionCount: number
  sectionTitles: string[]
  templateId: string
  compiledAt: string
}

export function extractSectionTitles(body: string): string[] {
  const titles: string[] = []
  const re = /\\(?:sub)?section\*?\{([^}]{1,120})\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim()
    if (t) titles.push(t)
  }
  return titles
}

export function countSections(body: string): number {
  return (body.match(/\\section\b/g) ?? []).length
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 16)
}

export function buildBodySnapshot(bodyLatex: string, templateId: string): LastBodySnapshot {
  return {
    bodyLatex,
    bodyHash: hashBody(bodyLatex),
    bodyCharCount: bodyLatex.length,
    sectionCount: countSections(bodyLatex),
    sectionTitles: extractSectionTitles(bodyLatex).slice(0, 40),
    templateId,
    compiledAt: new Date().toISOString(),
  }
}

// A snapshot is reusable for restyle only if it actually holds structured content.
export function isReusableSnapshot(snap: LastBodySnapshot | null): snap is LastBodySnapshot {
  return Boolean(snap && snap.bodyLatex.trim() && snap.sectionCount > 0)
}

// Whether a compile must be blocked because the template/theme/palette options
// were never loaded (list_latex_templates) before the first PDF in a session.
// Pure / unit-testable.
export function requiresTemplateLoad(opts: {
  usedBodySource: "provided" | "last_compiled_body"
  hasConversation: boolean
  hasExistingSnapshot: boolean
  templatesLoaded: boolean
  explicitChoice: boolean
}): boolean {
  return opts.usedBodySource === "provided"
    && opts.hasConversation
    && !opts.hasExistingSnapshot
    && !opts.templatesLoaded
    && !opts.explicitChoice
}

export type BodyResolution =
  | { ok: true, bodyLatex: string, usedBodySource: "provided" | "last_compiled_body", baseSnapshot: LastBodySnapshot | null }
  | { ok: false, error: string, reason: string, guidance?: string[] }

// Decide the body to compile from explicit inputs (pure / unit-testable). No
// implicit "empty means reuse": restyle must opt in with reuseLastBody, an empty
// body without the flag is rejected, and a restyle with no reusable snapshot fails.
export function resolveBodySource(
  params: { bodyLatex?: string, reuseLastBody?: boolean },
  snapshot: LastBodySnapshot | null,
): BodyResolution {
  if (params.reuseLastBody === true) {
    if (!isReusableSnapshot(snapshot)) {
      return {
        ok: false,
        error: "未找到可复用的上次正文，不能只换模板/样式生成。请重新提供完整正文，或重新生成完整 PDF。",
        reason: "missing_last_body_for_restyle",
        guidance: ["未找到可复用正文，不能只换模板生成；请重新提供正文或重新生成完整 PDF。"],
      }
    }
    return { ok: true, bodyLatex: snapshot.bodyLatex, usedBodySource: "last_compiled_body", baseSnapshot: snapshot }
  }
  if (!(params.bodyLatex ?? "").trim()) {
    return {
      ok: false,
      error: "未提供正文。只换样式/主题/配色而内容不变时，请设置 reuseLastBody=true 以复用上次正文；要改内容时请提供完整 bodyLatex。",
      reason: "empty_body_without_reuse_flag",
      guidance: [
        "只换样式不改内容：把 reuseLastBody 设为 true（复用上次正文）",
        "要改内容：提供完整 bodyLatex（含各级 \\section 与全部内容）",
      ],
    }
  }
  return { ok: true, bodyLatex: params.bodyLatex as string, usedBodySource: "provided", baseSnapshot: null }
}
