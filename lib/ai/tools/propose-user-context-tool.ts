import "server-only"
import {
  getOrCreateAgentProfile,
  applyAgentProfileMutation,
  getAgentProfileSectionPreview,
} from "@/lib/ai/agent-profile-service"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

export const proposeSaveUserContextTool = {
  name: "propose_save_user_context",
  title: "提议保存用户背景",
  description:
    "从对话中抽取用户的长期项目、偏好或背景信息，提议写入 AgentProfile 的 USER 段。不会自动写入，只返回预览供用户确认。触发语：用户聊到自己的项目、工作、学习、习惯等长期信息时。",
  scope: "self" as const,
  inputSchemaSummary: "text: string, section?: user|identity",
  sensitivity: "medium" as const,
  auditLabel: "propose_user_context",
  whenToUse:
    "当用户在对话中透露了长期背景（在做某个项目、学习某个方向、有某些习惯偏好）且当前 USER 段可能缺这些信息时，主动提议保存。",
  whenNotToUse:
    "不要为每条聊天都提议。不要保存临时话题、具体聊天内容或个人敏感信息。用户没同意的不要写。",
  argumentHints: [
    "text：要提议写入的上下文文本",
    "section：默认 user，也可以提议写 identity",
  ],
  returns: "提议预览、当前 USER 段内容、need_confirmation 标记",
  parameterSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to propose saving to the USER section." },
      section: { type: "string", enum: ["user", "identity"], description: "Section to save to, defaults to user." },
    },
    required: ["text"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    text,
    section,
  }: {
    userId: string
    text: string
    section?: string
  }) => {
    const resolvedSection = (section || "user") as "user" | "identity"
    if (!["user", "identity"].includes(resolvedSection)) {
      return toolForbidden("section 仅支持 user 或 identity。", "invalid_section")
    }

    if (!text?.trim()) {
      return toolForbidden("提议内容不能为空。", "content_required")
    }

    const profile = await getOrCreateAgentProfile(userId)
    const currentContent =
      resolvedSection === "user"
        ? ((profile as Record<string, unknown>).userContextContent as string) || ""
        : ((profile as Record<string, unknown>).identityContent as string) || ""

    const preview = getAgentProfileSectionPreview(currentContent)

    // For identity section changes, require confirmedByUser (high impact)
    if (resolvedSection === "identity") {
      return toolForbidden(
        `即将提议修改蝶灵的 identity 配置。当前内容预览：「${preview}」\n提议新增：\n${text.trim()}\n请确认是否执行。确认后请调用 update_agent_profile 并设置 confirmedByUser 为 true。`,
        "identity_proposal_needs_confirmation",
        {
          need_confirmation: true,
          section: resolvedSection,
          proposedText: text.trim(),
          currentPreview: preview,
          hint: "请向用户展示提议内容，确认后调用 update_agent_profile 工具执行。",
        },
      )
    }

    // For user section: propose with auto-save option
    const result = await applyAgentProfileMutation(userId, resolvedSection, "append", text.trim())

    return toolGranted(
      `已将以下信息追加到蝶灵的 ${resolvedSection} 配置（版本：${result.version}）：\n${text.trim()}\n\n更新前预览：「${preview}」`,
      {
        updated: true,
        section: result.section,
        operation: result.operation,
        preview: result.newContent,
        version: result.version,
      },
    )
  },
}
