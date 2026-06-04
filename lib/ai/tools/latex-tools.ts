import "server-only"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"
import { DEFAULT_LATEX_TEMPLATE, LATEX_TEMPLATE_IDS, listLatexTemplates } from "@/lib/latex/templates"
import { LATEX_THEME_IDS, listLatexThemes } from "@/lib/latex/themes"
import { LATEX_PALETTES, LATEX_PALETTE_IDS } from "@/lib/latex/palettes"
import { markTemplatesLoaded } from "@/lib/latex/doc-config-service"
import { compileLatexForUser } from "@/lib/latex/service"

export const listLatexTemplatesTool = {
  name: "list_latex_templates",
  title: "列出 LaTeX 模板、主题与配色",
  description:
    "列出可用于编译 PDF 的内容类型模板（含正文写法 bodyGuide、默认版式与建议视觉主题）、视觉主题（决定字体/标题/封面/组件外观）以及 10 套配色方案。内容类型决定“写什么”，视觉主题决定“长什么样”，二者可自由组合。",
  inputSchemaSummary: "无需输入",
  sensitivity: "low" as const,
  auditLabel: "list_latex_templates",
  whenToUse: "在 compile_latex_pdf 或 set_latex_doc_config 之前，用来选择内容类型/视觉主题/配色，并了解模板支持的组件与正文写法。",
  whenNotToUse: "不要用于实际编译或改配置。",
  argumentHints: [],
  returns: "templates（id/name/description/defaults/bodyGuide/suggestedTheme）、themes（id/name/description）与 palettes（id/name）。",
  parameterSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async ({ userId, conversationId }: { userId: string, conversationId?: string }) => {
    // Mark templates as loaded for this conversation — the precondition the
    // compile gate checks before a first-time PDF generation.
    if (conversationId) await markTemplatesLoaded(userId, conversationId).catch(() => undefined)
    return toolGranted("已列出可用内容类型、视觉主题与配色。", {
      templates: listLatexTemplates(),
      themes: listLatexThemes(),
      palettes: LATEX_PALETTES.map(({ id, name }) => ({ id, name })),
    })
  },
}

export const compileLatexPdfTool = {
  name: "compile_latex_pdf",
  title: "编译 LaTeX 为 PDF",
  description:
    "用本机 XeLaTeX，把你编写的 LaTeX 正文按当前会话的文档配置（内容类型/视觉主题/配色/版式，来自模板弹窗或 set_latex_doc_config）编译成中文 PDF。导言区、字体、封面与丰富组件由主题提供，你只需提供正文 bodyLatex。\n" +
    "要求：1) 先 list_latex_templates 了解内容类型的 bodyGuide、可用组件与可选视觉主题；2) 整理错题/资料/资讯时先用 search_knowledge_notes / read_my_pdf_document 取真实事实，不得虚构；3) 首次生成时 bodyLatex 必须是【完整】正文：包含各级 \\section/\\subsection 标题与全部内容，一次性写完，不能只给占位或章节骨架（否则会被拒绝）；4) 正文不要写 \\documentclass、导言区或 \\begin{document}，禁止 \\write18/\\input/\\usepackage 等（会被拒绝）；5) 编译成功后用一两句话说明即可，系统会自动在聊天中附上可下载的 PDF 卡片——【不要】在回复里粘贴下载链接或 /api/uploads 地址。\n" +
    "换模板/换主题/换配色/调版式但【内容不变】时：必须设置 reuseLastBody=true，并按需传 template/theme/palette，【不要】再写 bodyLatex——系统会复用本会话上次编译的完整正文用新样式重排。【禁止】用留空 bodyLatex 表示复用；留空且未设 reuseLastBody 会被直接拒绝（不会生成空壳 PDF）。只有要改内容时才提供完整 bodyLatex（此时不要设 reuseLastBody）。\n" +
    "【长文档完整性铁律】生成长教程/深度解析/详细报告/多章文档时：必须先列出计划章节并通过 expectedSections 传入；bodyLatex 必须包含 expectedSections 里的【全部】章节、每节内容完整收尾，绝不能中途截断。系统会在编译前校验正文完整性、编译后反查 PDF 是否真的包含全部章节——不完整会被拒绝（body_incomplete_by_outline / probable_truncation / compiled_pdf_incomplete），你必须按 guidance 补齐后重编。成功后只能依据返回的 sectionCount/pdfPageCount 如实汇报，【禁止】声称比实际更多的章节数。",
  inputSchemaSummary: "bodyLatex?, reuseLastBody?, expectedSections?, title?, template?, theme?, palette?, cjkFont?, subtitle?, author?",
  sensitivity: "high" as const,
  auditLabel: "compile_latex_pdf",
  whenToUse: "当用户要求把内容（错题/资料/资讯/笔记等）编译/导出/生成为 PDF 文档时使用。",
  whenNotToUse: "不要用于解析已有 PDF（用 read_my_pdf_document），也不要用于普通站内文章（用 compose_knowledge_note）。",
  argumentHints: [
    "bodyLatex 是你撰写的正文（不含导言区）；改内容时提供完整正文，长文档严禁中途截断",
    "expectedSections：长文档（多章/教程/深度解析/报告）必填，列出计划的全部一级章节标题，用于完整性校验",
    "reuseLastBody=true：只换样式/主题/配色而内容不变时设置它，复用上次正文（此时不要写 bodyLatex）",
    "title 可选；不传则用会话配置里的标题",
    `template 可选（内容类型），取值见 list_latex_templates，默认 ${DEFAULT_LATEX_TEMPLATE}`,
    "theme 可选（视觉主题，决定字体/标题/封面/组件外观），取值见 list_latex_templates",
    "palette 可选（配色），取值见 list_latex_templates",
    "cjkFont 可选（正文中文字体覆盖）：auto/songti/heiti/kaiti/fangsong/dengxian/yahei/shsong(思源宋体)/shhei(思源黑体)",
  ],
  returns: "uploadId、filename、downloadUrl、sizeBytes，以及 usedBodySource/sectionCount/sectionTitles/pdfPageCount/bodyHash/activeSkills 等元数据（你必须据此如实汇报，不得自行声称内容完整或章节数）；失败时返回友好错误。",
  parameterSchema: {
    type: "object",
    properties: {
      bodyLatex: { type: "string" },
      reuseLastBody: { type: "boolean" },
      expectedSections: { type: "array", items: { type: "string" }, description: "计划的各一级章节标题（长文档必填）；系统据此校验正文是否被截断、PDF 是否包含全部章节。" },
      title: { type: "string" },
      template: { type: "string", enum: [...LATEX_TEMPLATE_IDS] },
      theme: { type: "string", enum: [...LATEX_THEME_IDS] },
      palette: { type: "string", enum: [...LATEX_PALETTE_IDS] },
      cjkFont: { type: "string", enum: ["auto", "songti", "heiti", "kaiti", "fangsong", "dengxian", "yahei", "shsong", "shhei"] },
      subtitle: { type: "string" },
      author: { type: "string" },
    },
    additionalProperties: false,
  },
  execute: async ({
    userId,
    conversationId,
    activeSkills,
    bodyLatex,
    reuseLastBody,
    expectedSections,
    title,
    template,
    theme,
    palette,
    cjkFont,
    subtitle,
    author,
  }: {
    userId: string
    conversationId?: string
    activeSkills?: Array<{ id: string, name: string, version: string, triggerReason: string }>
    bodyLatex?: string
    reuseLastBody?: boolean
    expectedSections?: string[]
    title?: string
    template?: string
    theme?: string
    palette?: string
    cjkFont?: string
    subtitle?: string
    author?: string
  }) => {
    const outcome = await compileLatexForUser(userId, { conversationId, bodyLatex, reuseLastBody, expectedSections, title, template, theme, palette, cjkFont, subtitle, author })
    if (!outcome.ok) return toolForbidden(outcome.error, outcome.reason, outcome.guidance ? { guidance: outcome.guidance } : null)
    const sourceLabel = outcome.data.usedBodySource === "last_compiled_body" ? "复用上次正文" : "本次提供的正文"
    return toolGranted(
      `已生成并通过完整性校验 PDF《${outcome.data.filename}》：实际 ${outcome.data.sectionCount} 个一级章节、${outcome.data.pdfPageCount} 页（来源：${sourceLabel}）。只能据此如实汇报章节数与页数，不得声称更多。`,
      { ...outcome.data, activeSkills: activeSkills ?? [] },
    )
  },
}
