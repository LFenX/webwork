import "server-only"
import { toolGranted } from "@/lib/ai/tools/helpers"
import { getLastRunMetadata } from "@/lib/ai/service"

export const getLastRunMetadataTool = {
  name: "get_last_run_metadata",
  title: "查看上一轮运行的真实元数据",
  description:
    "返回本会话最近一次【已完成】助手运行的真实运行时元数据：注入了哪些技能（activeSkills，含 id/name/version/triggerReason），以及最近一次 PDF 生成的元数据（usedBodySource/sectionCount/pdfPageCount/templatesLoaded/selectedTemplate/selectedTheme/selectedPalette）。\n" +
    "当用户问“你刚才有没有用 PDF skill / 用了哪些技能 / 用了哪个模板/主题”时，【必须】先调用本工具，并严格依据返回结果如实回答；【禁止】凭记忆或自我复盘声称“我用了 xx skill”。若返回 activeSkills 为空，就如实说本轮未注入技能，或提示用户查看执行轨迹中的“技能注入”。",
  inputSchemaSummary: "无需输入",
  sensitivity: "low" as const,
  auditLabel: "get_last_run_metadata",
  whenToUse: "当用户询问上一轮是否/激活了哪些技能、用了什么模板/主题/配色、或上次 PDF 的元数据时。",
  whenNotToUse: "不要用它替代实际生成 PDF（用 compile_latex_pdf）。",
  argumentHints: [],
  returns: "runId、activeSkills（id/name/version/triggerReason）、lastPdf（PDF 元数据或 null）。",
  parameterSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async ({ userId, conversationId }: { userId: string, conversationId?: string }) => {
    if (!conversationId) {
      return toolGranted("当前不在会话上下文，无历史运行元数据。", { runId: null, activeSkills: [], lastPdf: null })
    }
    const meta = await getLastRunMetadata(userId, conversationId)
    const skillNames = meta.activeSkills.length
      ? meta.activeSkills.map((s) => `${s.name}（${s.triggerReason}）`).join("、")
      : "无"
    return toolGranted(`上一轮已注入技能：${skillNames}。`, meta)
  },
}
