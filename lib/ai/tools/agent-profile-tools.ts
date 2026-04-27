import "server-only"
import {
  getOrCreateAgentProfile,
  applyAgentProfileMutation,
  getAgentProfileSectionPreview,
} from "@/lib/ai/agent-profile-service"
import type { AgentProfileSection, AgentProfileOperation } from "@/lib/ai/agent-profile-service"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

const VALID_SECTIONS: AgentProfileSection[] = ["identity", "soul", "user", "rules"]
const VALID_OPERATIONS: AgentProfileOperation[] = ["append", "replace_section", "rewrite"]

// Platform hard rules that must never be overridden by user-level RULES
const PLATFORM_HARD_RULES = [
  "PLATFORM_HARD_RULE: 你绝对不能跨用户读取、修改或删除其他用户的数据。",
  "PLATFORM_HARD_RULE: 你绝对不能执行删除文章、删除文件夹等破坏性操作。",
  "PLATFORM_HARD_RULE: 你绝对不能允许模型或前端传入的 userId 覆盖会话 userId。",
]

function containsDangerousRule(content: string): string | null {
  const lower = content.toLowerCase()
  if (
    /不要.?确认/.test(lower) ||
    /跳过.?确认/.test(lower) ||
    /直接.?执行/.test(lower) ||
    /不要.?问我/.test(lower) ||
    /不需.?确认/.test(lower)
  ) {
    return "该规则试图削弱或绕过确认机制，可能降低安全边界。平台硬规则要求高风险操作必须确认。"
  }
  if (
    /可以跨.?用户/.test(lower) ||
    /访问.?其他.?用户/.test(lower) ||
    /读取.?别人/.test(lower) ||
    /修改.?别人/.test(lower)
  ) {
    return "该规则试图允许跨用户数据访问，违反平台硬规则。"
  }
  if (
    /删.?所有/.test(lower) ||
    /批量.?删除/.test(lower) ||
    /清空/.test(lower)
  ) {
    return "该规则暗示允许破坏性操作，平台禁止删除和批量删除。"
  }
  if (/(身份证|住址|密码|银行卡|健康档案|病历|体检|报告单)/.test(content)) {
    return "该内容可能包含敏感个人信息，不应存入人格配置。请改用 save_user_memory 并标记为 sensitive。"
  }
  return null
}

function checkHighImpact(section: AgentProfileSection, operation: AgentProfileOperation, content: string): boolean {
  if (section === "rules") return true
  if (operation === "rewrite") return true
  if (content.length > 2000) return true
  return false
}

// ---------------------------------------------------------------------------
// update_agent_profile
// ---------------------------------------------------------------------------

export const updateAgentProfileTool = {
  name: "update_agent_profile",
  title: "更新蝶灵人格配置",
  description:
    "当用户明确要求修改蝶灵的身份(identity)、性格表达(soul)、对用户的认识(user)或行为规则(rules)时，更新当前用户的 AgentProfile。这不是普通记忆，是蝶灵的长期人格配置。",
  execute: async ({
    userId,
    section,
    operation,
    content,
    reason,
    confirmedByUser,
  }: {
    userId: string
    section: string
    operation?: string
    content: string
    reason?: string
    confirmedByUser?: boolean
  }) => {
    if (!VALID_SECTIONS.includes(section as AgentProfileSection)) {
      return toolForbidden(
        `无效的人格配置分区 "${section}"，可选值：identity/soul/user/rules。`,
        "invalid_section",
      )
    }
    const resolvedSection = section as AgentProfileSection

    const resolvedOp = (operation || "append") as AgentProfileOperation
    if (!VALID_OPERATIONS.includes(resolvedOp)) {
      return toolForbidden(
        `无效的操作类型 "${operation}"，可选值：append/replace_section/rewrite。`,
        "invalid_operation",
      )
    }

    if (!content?.trim()) {
      return toolForbidden("内容不能为空。", "content_required")
    }

    // Check dangerous rules
    if (resolvedSection === "rules") {
      const danger = containsDangerousRule(content.trim())
      if (danger) {
        return toolForbidden(
          `无法写入该规则：${danger} 平台硬规则始终优先，${PLATFORM_HARD_RULES.join("；")}`,
          "dangerous_rule_blocked",
          { blocked: true, reason: danger },
        )
      }
    }

    // High impact checks need confirmation
    const isHighImpact = checkHighImpact(resolvedSection, resolvedOp, content.trim())

    if (isHighImpact && !confirmedByUser) {
      const profile = await getOrCreateAgentProfile(userId)
      const preview = getAgentProfileSectionPreview(
        (profile as Record<string, unknown>)[
          resolvedSection === "user" ? "userContextContent" : `${resolvedSection}Content`
        ] as string || "",
      )
      return toolForbidden(
        `即将修改蝶灵的 ${resolvedSection} 配置（操作：${resolvedOp}）。当前内容预览：「${preview}」\n修改原因：${reason || "用户要求"}\n请确认是否执行。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        "high_impact_needs_confirmation",
        {
          need_confirmation: true,
          section: resolvedSection,
          operation: resolvedOp,
          proposedContent: content.trim(),
          currentPreview: preview,
          reason: reason || "用户要求",
        },
      )
    }

    // Execute mutation
    const result = await applyAgentProfileMutation(userId, resolvedSection, resolvedOp, content.trim())

    return toolGranted(
      `已更新蝶灵的 ${section} 配置（操作：${result.operation}，版本：${result.version}）。修改原因：${reason || "用户要求"}。`,
      {
        updated: true,
        section: result.section,
        operation: result.operation,
        preview: result.newContent,
        version: result.version,
        reason: reason || "",
      },
    )
  },
}
