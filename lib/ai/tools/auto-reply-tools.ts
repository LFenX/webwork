import "server-only"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden, toolNotFound } from "@/lib/ai/tools/helpers"

const AUTO_REPLY_ENABLED = process.env.SOULWING_AUTO_REPLY_ENABLED === "true"

const VALID_REPLY_MODES = ["away_notice", "template", "hybrid", "semantic"]
const VALID_TRIGGER_MODES = ["manual"]

function formatAutoReplySetting(s: Record<string, unknown>) {
  return {
    id: s.id,
    enabled: s.enabled,
    scope: s.scope,
    chatType: s.chatType ?? null,
    conversationId: s.conversationId ?? null,
    triggerMode: s.triggerMode,
    replyMode: s.replyMode,
    templateText: s.templateText ?? null,
    customInstruction: s.customInstruction ?? null,
    discloseAsAutoReply: s.discloseAsAutoReply,
    allowGroupReply: s.allowGroupReply,
    cooldownMinutes: s.cooldownMinutes,
    maxRepliesPerDay: s.maxRepliesPerDay,
    createdAt: s.createdAt,
  }
}

export const getAutoReplySettingsTool = {
  name: "get_auto_reply_settings",
  title: "读取自动回复设置",
  description:
    "读取当前用户的自动回复配置。触发语：'我的自动回复怎么设置的''帮我看看自动回复''我有哪些自动回复规则'。",
  scope: "self" as const,
  inputSchemaSummary: "无需输入",
  sensitivity: "medium" as const,
  auditLabel: "read_auto_reply_settings",
  whenToUse:
    "当用户询问自动回复设置、想了解当前自动回复状态时使用。",
  whenNotToUse: "不要用于修改设置或读取聊天消息。",
  argumentHints: [],
  returns: "自动回复设置列表、featureEnabled 状态",
  parameterSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: async ({ userId }: { userId: string }) => {
    const items = await prisma.autoReplySetting.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    return toolGranted(
      items.length === 0
        ? "你还没有创建自动回复配置。当前功能状态：" + (AUTO_REPLY_ENABLED ? "已开放。" : "尚未开放，即使创建配置也不会发送。")
        : `共 ${items.length} 条自动回复配置。功能状态：${AUTO_REPLY_ENABLED ? "已开放" : "尚未开放，配置不会实际生效"}。`,
      {
        items: items.map(formatAutoReplySetting),
        featureEnabled: AUTO_REPLY_ENABLED,
      },
    )
  },
}

export const updateAutoReplySettingsTool = {
  name: "update_auto_reply_settings",
  title: "更新自动回复设置",
  description:
    "更新当前用户的一条自动回复配置。可修改 enabled/replyMode/templateText/customInstruction/discloseAsAutoReply/allowGroupReply/cooldownMinutes/maxRepliesPerDay。触发语：'帮我打开自动回复''关闭自动回复''设置自动回复模板''调整冷却时间'。",
  scope: "self" as const,
  inputSchemaSummary:
    "settingId?: string, enabled?: boolean, replyMode?: string, templateText?: string, customInstruction?: string, discloseAsAutoReply?: boolean, allowGroupReply?: boolean, cooldownMinutes?: number, maxRepliesPerDay?: number, confirmedByUser?: boolean",
  sensitivity: "high" as const,
  auditLabel: "update_auto_reply_settings",
  whenToUse:
    "当用户明确要求修改自动回复设置（开关、模板、回复方式、冷却、上限）时使用。",
  whenNotToUse:
    "不要在没有用户明确指令时修改设置。不要读取聊天消息或修改其他用户设置。",
  argumentHints: [
    "settingId：可选，不传则操作第一条（通常是 global 设置）。若没有设置需要先创建。",
    "enabled=true 需要 confirmedByUser=true（高风险：启用后蝶灵会以用户身份发送消息）",
    "replyMode=semantic 也需要 confirmedByUser=true（潜在内容风险）",
    "replyMode 可选：away_notice/template/hybrid/semantic",
    "cooldownMinutes 范围 5-480",
    "maxRepliesPerDay 范围 1-100",
  ],
  returns: "更新后的设置",
  parameterSchema: {
    type: "object",
    properties: {
      settingId: { type: "string", description: "Setting id. If omitted, operates on the first setting found." },
      enabled: { type: "boolean", description: "Enable or disable auto-reply." },
      replyMode: { type: "string", enum: VALID_REPLY_MODES, description: "Reply mode." },
      templateText: { type: "string", description: "Template text when replyMode is template." },
      customInstruction: { type: "string", description: "Custom instruction for hybrid/semantic modes." },
      discloseAsAutoReply: { type: "boolean", description: "Whether to disclose that this is an auto-reply." },
      allowGroupReply: { type: "boolean", description: "Whether to allow auto-reply in group chats." },
      cooldownMinutes: { type: "integer", minimum: 5, maximum: 480, description: "Cooldown in minutes between auto-replies." },
      maxRepliesPerDay: { type: "integer", minimum: 1, maximum: 100, description: "Max auto-replies per day." },
      confirmedByUser: { type: "boolean", description: "Required true when enabling auto-reply or switching to semantic mode." },
    },
    additionalProperties: false,
  },
  execute: async (input: {
    userId: string
    settingId?: string
    enabled?: boolean
    replyMode?: string
    templateText?: string
    customInstruction?: string
    discloseAsAutoReply?: boolean
    allowGroupReply?: boolean
    cooldownMinutes?: number
    maxRepliesPerDay?: number
    confirmedByUser?: boolean
  }) => {
    const { userId, settingId, confirmedByUser, ...fields } = input

    // Find the setting
    let setting: Record<string, unknown> | null = null
    if (settingId) {
      setting = await prisma.autoReplySetting.findFirst({
        where: { id: settingId, userId },
      }) as Record<string, unknown> | null
    } else {
      setting = await prisma.autoReplySetting.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }) as Record<string, unknown> | null
    }

    if (!setting) {
      return toolNotFound(
        "未找到自动回复配置。请先调用 get_auto_reply_settings 查看，或建议用户前往设置中心创建。",
        "setting_not_found",
      )
    }

    // Validate replyMode
    if (fields.replyMode && !VALID_REPLY_MODES.includes(fields.replyMode)) {
      return toolForbidden(
        `无效的回复方式 "${fields.replyMode}"，可选值：${VALID_REPLY_MODES.join("、")}。`,
        "invalid_reply_mode",
      )
    }

    // Validate cooldown
    if (fields.cooldownMinutes !== undefined) {
      if (fields.cooldownMinutes < 5 || fields.cooldownMinutes > 480) {
        return toolForbidden("冷却时间必须在 5-480 分钟之间。", "invalid_cooldown")
      }
    }

    // Validate daily limit
    if (fields.maxRepliesPerDay !== undefined) {
      if (fields.maxRepliesPerDay < 1 || fields.maxRepliesPerDay > 100) {
        return toolForbidden("每日上限必须在 1-100 之间。", "invalid_daily_limit")
      }
    }

    // High-risk operations need confirmation
    const isEnabling = fields.enabled === true && setting.enabled !== true
    const isSwitchingToSemantic = fields.replyMode === "semantic" && setting.replyMode !== "semantic"

    if ((isEnabling || isSwitchingToSemantic) && !confirmedByUser) {
      const risks: string[] = []
      if (isEnabling) risks.push("启用后蝶灵将以你的身份自动发送消息，对方可能无法区分是否为本人")
      if (isSwitchingToSemantic) risks.push("语义模式会理解聊天内容后生成回复，存在内容不确定性")

      return toolForbidden(
        `即将修改自动回复设置：${risks.join("；")}\n请确认是否执行。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        "high_risk_needs_confirmation",
        {
          need_confirmation: true,
          proposed: fields,
          risks,
        },
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    // Enforce feature gate
    if (!AUTO_REPLY_ENABLED) {
      if (updateData.enabled === true) updateData.enabled = false
      if (updateData.allowGroupReply === true) updateData.allowGroupReply = false
    }

    if (Object.keys(updateData).length === 0) {
      return toolForbidden("没有提供任何要修改的字段。", "no_fields")
    }

    const updated = await prisma.autoReplySetting.update({
      where: { id: setting.id as string },
      data: updateData,
    })

    const changes = Object.keys(updateData).map((k) => `${k}: ${String(updateData[k])}`).join(", ")

    return toolGranted(
      `已更新自动回复设置。修改项：${changes}。`,
      {
        ...formatAutoReplySetting(updated as unknown as Record<string, unknown>),
        featureEnabled: AUTO_REPLY_ENABLED,
      },
    )
  },
}
