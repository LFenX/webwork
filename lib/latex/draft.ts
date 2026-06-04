import "server-only"

// A per-conversation, chunk-built long document. The model declares an outline,
// then writes ONE chapter per tool call (avoiding a single huge bodyLatex
// argument that gets truncated mid-stream), then compiles the assembled body
// through the normal completeness pipeline. This is how 蝶灵 produces dozens-to-
// hundreds of pages reliably. Pure helpers — the storage lives in doc-config-service.

export type DraftSection = { title: string; bodyLatex: string; updatedAt: string }
export type LatexDraft = {
  title: string
  plan: string[] // ordered chapter (\section) titles
  sections: Record<string, DraftSection> // keyed by normalized title
  createdAt: string
  updatedAt: string
}

function keyOf(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase()
}

// Minimal escaping for a title placed into \section{…}.
function escapeTitle(title: string): string {
  return title.replace(/([%&#_$])/g, "\\$1")
}

export function createDraft(plan: string[], title: string): LatexDraft {
  const now = new Date().toISOString()
  const cleanPlan: string[] = []
  const seen = new Set<string>()
  for (const raw of plan) {
    const t = raw.trim()
    if (!t || seen.has(keyOf(t))) continue
    seen.add(keyOf(t))
    cleanPlan.push(t)
  }
  return { title: title.trim() || "未命名文档", plan: cleanPlan, sections: {}, createdAt: now, updatedAt: now }
}

// Resolve a section reference (exact title / "sN" / 1-based index / fuzzy) to a
// plan title, or null if not found.
export function findPlanTitle(draft: LatexDraft, ref: string): string | null {
  const r = ref.trim()
  const k = keyOf(r)
  const exact = draft.plan.find((t) => keyOf(t) === k)
  if (exact) return exact
  const idx = /^s?(\d+)$/i.exec(r)
  if (idx) {
    const i = Number(idx[1]) - 1
    if (i >= 0 && i < draft.plan.length) return draft.plan[i]
  }
  const fuzzy = draft.plan.find((t) => keyOf(t).includes(k) || k.includes(keyOf(t)))
  return fuzzy ?? null
}

// Set a chapter's content. A leading \section heading in the chunk is stripped —
// the canonical heading comes from the plan title at assemble time.
export function upsertSection(draft: LatexDraft, planTitle: string, bodyLatex: string): LatexDraft {
  const content = bodyLatex.replace(/^\s*\\section\*?\{[^}]*\}/, "").trim()
  const now = new Date().toISOString()
  return {
    ...draft,
    sections: { ...draft.sections, [keyOf(planTitle)]: { title: planTitle, bodyLatex: content, updatedAt: now } },
    updatedAt: now,
  }
}

// Revise the outline of an EXISTING draft while keeping work already done —
// the long-document analogue of how a coding agent edits a file in place instead
// of rewriting it. Chapters in the new plan whose (normalized) title matches a
// written chapter keep their content; the optional `rename` map (oldTitle →
// newTitle) lets content follow a renamed chapter. Chapters dropped from the
// plan are removed; brand-new titles come in empty (to be written). Returns the
// merged draft plus which chapters were reused / added / removed for reporting.
export function revisePlan(
  draft: LatexDraft,
  newPlan: string[],
  opts?: { rename?: Record<string, string>; title?: string },
): { draft: LatexDraft; reused: string[]; added: string[]; removed: string[] } {
  const now = new Date().toISOString()

  const cleanPlan: string[] = []
  const seen = new Set<string>()
  for (const raw of newPlan) {
    const t = raw.trim()
    if (!t || seen.has(keyOf(t))) continue
    seen.add(keyOf(t))
    cleanPlan.push(t)
  }

  // Invert the rename map to: new-title-key → old-title-key, so a new chapter can
  // pull content from the old chapter it was renamed from.
  const newKeyToOldKey = new Map<string, string>()
  for (const [oldT, newT] of Object.entries(opts?.rename ?? {})) {
    if (oldT?.trim() && newT?.trim()) newKeyToOldKey.set(keyOf(newT), keyOf(oldT))
  }

  const oldPlanKeys = new Set(draft.plan.map(keyOf))
  const newSections: Record<string, DraftSection> = {}
  const reused: string[] = [] // kept its written content
  const added: string[] = [] // brand-new chapter (not in the old outline)
  const consumedOldKeys = new Set<string>()

  for (const title of cleanPlan) {
    const nk = keyOf(title)
    let src = draft.sections[nk]
    let srcKey = nk
    const renamedFrom = newKeyToOldKey.get(nk)
    if ((!src || !src.bodyLatex.trim()) && renamedFrom && draft.sections[renamedFrom]?.bodyLatex.trim()) {
      src = draft.sections[renamedFrom]
      srcKey = renamedFrom
    }
    if (src && src.bodyLatex.trim()) {
      newSections[nk] = { title, bodyLatex: src.bodyLatex, updatedAt: src.updatedAt }
      consumedOldKeys.add(srcKey)
      reused.push(title)
    } else if (!oldPlanKeys.has(nk) && !(renamedFrom && oldPlanKeys.has(renamedFrom))) {
      // Genuinely new title. A previously-planned-but-unwritten title that stays
      // is neither "added" nor "reused" — it's just still in `missing`.
      added.push(title)
    }
  }

  const removed = draft.plan.filter(
    (t) => draft.sections[keyOf(t)]?.bodyLatex.trim() && !consumedOldKeys.has(keyOf(t)),
  )

  return {
    draft: {
      ...draft,
      title: opts?.title?.trim() || draft.title,
      plan: cleanPlan,
      sections: newSections,
      updatedAt: now,
    },
    reused,
    added,
    removed,
  }
}

export type DraftStatus = {
  title: string
  totalCount: number
  filledCount: number
  totalChars: number
  missing: string[]
  plan: Array<{ title: string; filled: boolean; charCount: number }>
}

export function draftStatus(draft: LatexDraft): DraftStatus {
  const plan = draft.plan.map((title) => {
    const s = draft.sections[keyOf(title)]
    return { title, filled: Boolean(s && s.bodyLatex.trim()), charCount: s?.bodyLatex.length ?? 0 }
  })
  const missing = plan.filter((p) => !p.filled).map((p) => p.title)
  return {
    title: draft.title,
    totalCount: draft.plan.length,
    filledCount: plan.filter((p) => p.filled).length,
    totalChars: plan.reduce((a, p) => a + p.charCount, 0),
    missing,
    plan,
  }
}

// Concatenate the chapters in plan order, each under its canonical \section.
export function assembleDraftBody(draft: LatexDraft): string {
  return draft.plan
    .map((title) => {
      const content = (draft.sections[keyOf(title)]?.bodyLatex ?? "").trim()
      return `\\section{${escapeTitle(title)}}\n${content}`
    })
    .join("\n\n")
}
