import "server-only"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"
import { getDraft, setDraft } from "@/lib/latex/doc-config-service"
import { createDraft, revisePlan, upsertSection, findPlanTitle, draftStatus, assembleDraftBody } from "@/lib/latex/draft"
import { hasHardTruncation } from "@/lib/latex/completeness"
import { compileLatexForUser } from "@/lib/latex/service"
import { LATEX_TEMPLATE_IDS } from "@/lib/latex/templates"
import { LATEX_THEME_IDS } from "@/lib/latex/themes"
import { LATEX_PALETTE_IDS } from "@/lib/latex/palettes"

export const startLatexDraftTool = {
  name: "start_latex_draft",
  title: "新建 / 修订长文档草稿大纲（分章写入）",
  description:
    "为超长 / 多章 PDF（几十页甚至上百页）开启或修订分章草稿，避免把超长正文塞进一次 compile_latex_pdf 导致被截断。先用本工具声明【完整章节大纲】plan（全部一级章节标题，按顺序），然后用 append_latex_draft_section 逐章写入，用 get_latex_draft_status 查看进度，最后用 compile_latex_draft 组装并编译。" +
    "【增量修订（重要）】若本会话已有草稿，本工具不会清空已写内容：plan 里标题与已写章节匹配的会原样保留正文并按新顺序重排，只有【新增的章节】才需要补写——所以当文档篇幅不够要加章节时，请直接用包含【原有全部标题 + 新增标题】的完整 plan 再调用一次本工具，然后只 append 新增章节，切勿从零重写已写好的章节。重命名章节时用 rename 映射（旧标题→新标题）让正文跟随。仅当确实要丢弃旧稿重做时才设 reset=true。",
  inputSchemaSummary: "plan（章节标题数组，必填）, title?, rename?（旧→新标题映射）, reset?（true=丢弃旧稿）",
  sensitivity: "low" as const,
  auditLabel: "start_latex_draft",
  whenToUse: "要生成很长 / 多章 / 上百页 PDF，或篇幅不足需要在已有草稿上新增 / 重排 / 重命名章节时（默认保留已写内容）。",
  whenNotToUse: "短文档直接用 compile_latex_pdf 即可，不必走草稿。",
  argumentHints: [
    "plan 必填：完整的一级章节标题列表，按最终顺序（修订时也要带上原有标题，否则会被移除）",
    "title 可选：文档标题",
    "rename 可选：{旧标题: 新标题}，让已写正文跟随重命名的章节",
    "reset 可选：true 时丢弃旧草稿从零重建（默认 false，保留已写章节）",
  ],
  returns: "草稿状态（plan/各节是否写入/缺失章节）；修订时附保留 / 新增 / 移除的章节数。",
  parameterSchema: {
    type: "object",
    properties: {
      plan: { type: "array", items: { type: "string" }, minItems: 1 },
      title: { type: "string" },
      rename: { type: "object", additionalProperties: { type: "string" }, description: "旧标题→新标题映射，让已写正文跟随重命名的章节。" },
      reset: { type: "boolean", description: "true 时丢弃已有草稿从零重建。默认 false（保留已写章节）。" },
    },
    required: ["plan"],
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, plan, title, rename, reset }: { userId: string, conversationId?: string, plan?: string[], title?: string, rename?: Record<string, string>, reset?: boolean }) => {
    if (!conversationId) return toolForbidden("当前不在会话上下文，无法创建草稿。", "no_conversation")
    const clean = (plan ?? []).filter((t) => typeof t === "string" && t.trim())
    if (clean.length < 1) return toolForbidden("plan 不能为空，请先列出完整章节大纲。", "empty_plan")

    // Incremental revision: re-planning an existing draft preserves chapters
    // already written (matched by title, or by the rename map), so adding a few
    // chapters because the doc is too short never wipes the work done so far.
    const existing = reset ? null : await getDraft(userId, conversationId)
    if (existing) {
      const { draft, reused, added, removed } = revisePlan(existing, clean, { rename, title })
      await setDraft(userId, conversationId, draft)
      const st = draftStatus(draft)
      const summaryParts = [`保留已写 ${reused.length} 章`]
      if (added.length) summaryParts.push(`新增 ${added.length} 章待写`)
      if (removed.length) summaryParts.push(`移除 ${removed.length} 章`)
      const tail = st.missing.length > 0
        ? `只需补写：${st.missing.join("、")}。已写章节无需重写。`
        : `所有章节均已就绪，可直接 compile_latex_draft。`
      return toolGranted(`已更新草稿《${draft.title}》大纲（${summaryParts.join("，")}）。${tail}`, st)
    }

    const draft = createDraft(clean, title ?? "")
    await setDraft(userId, conversationId, draft)
    const st = draftStatus(draft)
    return toolGranted(`已创建草稿《${draft.title}》，共 ${st.totalCount} 章。请用 append_latex_draft_section 逐章写入：${st.missing.join("、")}。`, st)
  },
}

export const appendLatexDraftSectionTool = {
  name: "append_latex_draft_section",
  title: "写入草稿的一章正文",
  description:
    "把某一章的【完整】正文写入草稿。sectionId 用该章标题（或序号，如 s3 / 3）。bodyLatex 只写该章正文内容，【不要】写 \\section 标题（系统按大纲自动加），可用 \\subsection 与各类组件。该章必须写到自然收尾，不能停在“包括：”“分别为：”或逗号处（会被拒绝 section_truncated）。逐章调用，直到所有章节写齐。",
  inputSchemaSummary: "sectionId（章节标题或序号）, bodyLatex（该章正文）",
  sensitivity: "low" as const,
  auditLabel: "append_latex_draft_section",
  whenToUse: "在 start_latex_draft 之后，为每一章写入完整正文。",
  whenNotToUse: "没有草稿时先 start_latex_draft。",
  argumentHints: ["sectionId：大纲里的章节标题或序号", "bodyLatex：该章完整正文（不含 \\section 标题），写到自然收尾"],
  returns: "更新后的草稿状态（已完成/待写章节）。",
  parameterSchema: {
    type: "object",
    properties: {
      sectionId: { type: "string" },
      bodyLatex: { type: "string" },
    },
    required: ["sectionId", "bodyLatex"],
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, sectionId, bodyLatex }: { userId: string, conversationId?: string, sectionId?: string, bodyLatex?: string }) => {
    if (!conversationId) return toolForbidden("当前不在会话上下文。", "no_conversation")
    const draft = await getDraft(userId, conversationId)
    if (!draft) return toolForbidden("未找到草稿，请先调用 start_latex_draft 声明章节大纲。", "no_draft")
    const planTitle = sectionId ? findPlanTitle(draft, sectionId) : null
    if (!planTitle) {
      return toolForbidden(`章节 “${sectionId ?? ""}” 不在大纲中。可用章节：${draft.plan.join("、")}`, "section_not_in_plan", { plan: draft.plan })
    }
    if (!bodyLatex || !bodyLatex.trim()) return toolForbidden("该章正文不能为空。", "empty_section")
    if (hasHardTruncation(bodyLatex)) {
      return toolForbidden(
        `「${planTitle}」似乎在中途被截断（结尾不完整或括号/环境未闭合），请把该章写到自然收尾后再写入。`,
        "section_truncated",
        { guidance: ["把该章正文补全到自然结束（不要停在冒号/逗号/列表引导词），并确保 \\begin/\\end 与括号配对。"] },
      )
    }
    const next = upsertSection(draft, planTitle, bodyLatex)
    await setDraft(userId, conversationId, next)
    const st = draftStatus(next)
    const tail = st.missing.length > 0
      ? `已完成 ${st.filledCount}/${st.totalCount} 章，待写：${st.missing.join("、")}。`
      : `全部 ${st.totalCount} 章已写齐，可调用 compile_latex_draft 编译。`
    return toolGranted(`已写入「${planTitle}」。${tail}`, st)
  },
}

export const getLatexDraftStatusTool = {
  name: "get_latex_draft_status",
  title: "查看长文档草稿进度",
  description: "返回当前会话草稿的进度：标题、章节大纲、每章是否已写入及字数、尚缺哪些章节、总字数。用于决定还要写哪些章、是否可以编译。",
  inputSchemaSummary: "无需输入",
  sensitivity: "low" as const,
  auditLabel: "get_latex_draft_status",
  whenToUse: "写作过程中查看还差哪些章节，或编译前确认是否写齐。",
  whenNotToUse: "—",
  argumentHints: [],
  returns: "exists 与草稿状态（plan/filledCount/missing/totalChars）。",
  parameterSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async ({ userId, conversationId }: { userId: string, conversationId?: string }) => {
    if (!conversationId) return toolGranted("当前不在会话上下文，无草稿。", { exists: false })
    const draft = await getDraft(userId, conversationId)
    if (!draft) return toolGranted("当前会话没有草稿。", { exists: false })
    return toolGranted("当前草稿进度。", { exists: true, ...draftStatus(draft) })
  },
}

export const compileLatexDraftTool = {
  name: "compile_latex_draft",
  title: "编译长文档草稿为 PDF",
  description:
    "把已写齐的草稿按大纲顺序组装成完整正文并编译成 PDF（自动带完整性校验与 PDF 反查）。只有所有章节都已写入才能编译；若仍有缺章会返回 draft_incomplete。可传 template/theme/palette/cjkFont 等样式参数。成功后只能依据返回的实际 sectionCount/pdfPageCount 如实汇报。",
  inputSchemaSummary: "template?, theme?, palette?, cjkFont?, title?, subtitle?, author?",
  sensitivity: "high" as const,
  auditLabel: "compile_latex_draft",
  whenToUse: "草稿所有章节写齐后，生成最终长文档 PDF。",
  whenNotToUse: "还有章节未写入时先 append_latex_draft_section 补齐。",
  argumentHints: ["template/theme/palette 可选（同 list_latex_templates）", "title 可选，默认用草稿标题"],
  returns: "uploadId/filename/downloadUrl 与 sectionCount/pdfPageCount 等已校验元数据。",
  parameterSchema: {
    type: "object",
    properties: {
      template: { type: "string", enum: [...LATEX_TEMPLATE_IDS] },
      theme: { type: "string", enum: [...LATEX_THEME_IDS] },
      palette: { type: "string", enum: [...LATEX_PALETTE_IDS] },
      cjkFont: { type: "string", enum: ["auto", "songti", "heiti", "kaiti", "fangsong", "dengxian", "yahei", "shsong", "shhei"] },
      title: { type: "string" },
      subtitle: { type: "string" },
      author: { type: "string" },
    },
    additionalProperties: false,
  },
  execute: async (input: {
    userId: string
    conversationId?: string
    activeSkills?: Array<{ id: string, name: string, version: string, triggerReason: string }>
    template?: string
    theme?: string
    palette?: string
    cjkFont?: string
    title?: string
    subtitle?: string
    author?: string
  }) => {
    const { userId, conversationId } = input
    if (!conversationId) return toolForbidden("当前不在会话上下文。", "no_conversation")
    const draft = await getDraft(userId, conversationId)
    if (!draft) return toolForbidden("未找到草稿，请先 start_latex_draft。", "no_draft")
    const st = draftStatus(draft)
    if (st.missing.length > 0) {
      return toolForbidden(
        `还有 ${st.missing.length} 章未写入：${st.missing.join("、")}。请先用 append_latex_draft_section 补齐所有章节再编译。`,
        "draft_incomplete",
        { guidance: [`补齐缺失章节：${st.missing.join("、")}`], missing: st.missing },
      )
    }
    const body = assembleDraftBody(draft)
    const outcome = await compileLatexForUser(userId, {
      conversationId,
      bodyLatex: body,
      expectedSections: draft.plan,
      title: input.title ?? draft.title,
      subtitle: input.subtitle,
      author: input.author,
      template: input.template,
      theme: input.theme,
      palette: input.palette,
      cjkFont: input.cjkFont,
    })
    if (!outcome.ok) return toolForbidden(outcome.error, outcome.reason, outcome.guidance ? { guidance: outcome.guidance } : null)
    return toolGranted(
      `已生成并通过完整性校验 PDF《${outcome.data.filename}》：实际 ${outcome.data.sectionCount} 章、${outcome.data.pdfPageCount} 页。只能据此如实汇报。`,
      { ...outcome.data, activeSkills: input.activeSkills ?? [] },
    )
  },
}
