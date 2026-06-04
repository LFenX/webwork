import "server-only"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"
import { LATEX_TEMPLATE_IDS } from "@/lib/latex/templates"
import { LATEX_THEME_IDS } from "@/lib/latex/themes"
import { LATEX_PALETTE_IDS } from "@/lib/latex/palettes"
import { getDocConfig, setDocConfig } from "@/lib/latex/doc-config-service"
import type { LatexDocConfig } from "@/lib/latex/config-schema"

export const getLatexDocConfigTool = {
  name: "get_latex_doc_config",
  title: "读取当前文档配置",
  description: "读取当前会话的 PDF 文档配置（模板、配色、版式开关、排版密度、文档信息）。",
  inputSchemaSummary: "无需输入",
  sensitivity: "low" as const,
  auditLabel: "get_latex_doc_config",
  whenToUse: "在编译 PDF 或修改文档配置前，了解当前会话已设定的模板与参数。",
  whenNotToUse: "不要用于修改配置（用 set_latex_doc_config）。",
  argumentHints: [],
  returns: "当前会话的文档配置对象。",
  parameterSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async ({ userId, conversationId }: { userId: string, conversationId?: string }) => {
    if (!conversationId) return toolForbidden("当前不在会话上下文，无法读取配置。", "no_conversation")
    const config = await getDocConfig(userId, conversationId)
    return toolGranted("已读取当前文档配置。", { config })
  },
}

export const setLatexDocConfigTool = {
  name: "set_latex_doc_config",
  title: "设置文档配置",
  description:
    "设置/调整当前会话的 PDF 文档配置（内容类型 template、视觉主题 theme、配色、正文中文字体 cjkFont、段落样式 paragraphStyle、纸张 paperSize、是否封面/目录/页眉页脚、字号/页边距/行距、标题/副标题/作者/日期）。视觉主题决定字体/标题/封面/组件外观；cjkFont 可单独覆盖正文中文字体（auto=跟随主题，songti 宋体/heiti 黑体/kaiti 楷体/fangsong 仿宋/dengxian 等线/yahei 雅黑/shsong 思源宋体/shhei 思源黑体）；paragraphStyle 为 indent（首行缩进）或 spaced（段间距）。改动会实时同步到模板弹窗，并作为后续 compile_latex_pdf 的默认配置。只传需要修改的字段。",
  inputSchemaSummary: "template?, theme?, palette?, cjkFont?, paragraphStyle?, paperSize?, cover?, toc?, headerFooter?, fontSize?, margin?, lineSpacing?, title?, subtitle?, author?, date?",
  sensitivity: "medium" as const,
  auditLabel: "set_latex_doc_config",
  whenToUse: "当用户在对话里要求换内容类型、换视觉主题/风格、换配色、加封面/目录、调字号行距、改标题作者等文档外观设定时使用。",
  whenNotToUse: "不要用于编写正文或编译（正文与编译用 compile_latex_pdf）。",
  argumentHints: ["只传要改的字段", "template/theme/palette 取值见 list_latex_templates", "切换内容类型会自动套用其默认版式与建议主题；theme 可单独切换视觉风格"],
  returns: "更新后的完整文档配置。",
  parameterSchema: {
    type: "object",
    properties: {
      template: { type: "string", enum: [...LATEX_TEMPLATE_IDS] },
      theme: { type: "string", enum: [...LATEX_THEME_IDS] },
      palette: { type: "string", enum: [...LATEX_PALETTE_IDS] },
      cjkFont: { type: "string", enum: ["auto", "songti", "heiti", "kaiti", "fangsong", "dengxian", "yahei", "shsong", "shhei"] },
      paragraphStyle: { type: "string", enum: ["indent", "spaced"] },
      paperSize: { type: "string", enum: ["a4", "letter"] },
      cover: { type: "boolean" },
      toc: { type: "boolean" },
      headerFooter: { type: "boolean" },
      fontSize: { type: "integer", enum: [10, 11, 12] },
      margin: { type: "string", enum: ["narrow", "normal", "wide"] },
      lineSpacing: { type: "string", enum: ["compact", "normal", "relaxed"] },
      title: { type: "string" },
      subtitle: { type: "string" },
      author: { type: "string" },
      date: { type: "string" },
    },
    additionalProperties: false,
  },
  execute: async (input: {
    userId: string
    conversationId?: string
    template?: string
    theme?: string
    palette?: string
    cjkFont?: string
    paragraphStyle?: string
    paperSize?: string
    cover?: boolean
    toc?: boolean
    headerFooter?: boolean
    fontSize?: number
    margin?: string
    lineSpacing?: string
    title?: string
    subtitle?: string
    author?: string
    date?: string
  }) => {
    const { userId, conversationId } = input
    if (!conversationId) return toolForbidden("当前不在会话上下文，无法设置配置。", "no_conversation")

    const patch: Partial<LatexDocConfig> = {}
    if (input.template !== undefined) patch.templateId = input.template
    if (input.theme !== undefined) patch.theme = input.theme
    if (input.palette !== undefined) patch.palette = input.palette
    if (input.cjkFont !== undefined) patch.cjkFont = input.cjkFont as LatexDocConfig["cjkFont"]
    if (input.paragraphStyle !== undefined) patch.paragraphStyle = input.paragraphStyle as LatexDocConfig["paragraphStyle"]
    if (input.paperSize !== undefined) patch.paperSize = input.paperSize as LatexDocConfig["paperSize"]
    if (input.cover !== undefined) patch.cover = input.cover
    if (input.toc !== undefined) patch.toc = input.toc
    if (input.headerFooter !== undefined) patch.headerFooter = input.headerFooter
    if (input.fontSize !== undefined) patch.fontSize = input.fontSize as LatexDocConfig["fontSize"]
    if (input.margin !== undefined) patch.margin = input.margin as LatexDocConfig["margin"]
    if (input.lineSpacing !== undefined) patch.lineSpacing = input.lineSpacing as LatexDocConfig["lineSpacing"]
    if (input.title !== undefined) patch.title = input.title
    if (input.subtitle !== undefined) patch.subtitle = input.subtitle
    if (input.author !== undefined) patch.author = input.author
    if (input.date !== undefined) patch.date = input.date

    const config = await setDocConfig(userId, conversationId, patch)
    return toolGranted("已更新文档配置。", { config })
  },
}
