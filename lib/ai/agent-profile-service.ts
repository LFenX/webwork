import "server-only"
import { prisma } from "@/lib/db"
import { DEFAULT_AGENT_PROFILE } from "@/lib/ai/agent-profile-defaults"

export interface AgentPersonaContext {
  rules: string
  identity: string
  soul: string
  userContext: string
}

export async function getOrCreateAgentProfile(userId: string) {
  const existing = await prisma.agentProfile.findUnique({ where: { userId } })
  if (existing) return existing

  return prisma.agentProfile.create({
    data: {
      userId,
      ...DEFAULT_AGENT_PROFILE,
    },
  })
}

export async function loadAgentPersonaContext(userId: string): Promise<AgentPersonaContext> {
  const profile = await getOrCreateAgentProfile(userId)

  if (!profile.enabled) {
    return {
      rules: DEFAULT_AGENT_PROFILE.rulesContent,
      identity: "你是蝶灵（SoulWing），当前用户的专属 AI 助手。",
      soul: DEFAULT_AGENT_PROFILE.soulContent,
      userContext: "",
    }
  }

  return {
    rules: profile.rulesContent || DEFAULT_AGENT_PROFILE.rulesContent,
    identity: profile.identityContent || DEFAULT_AGENT_PROFILE.identityContent,
    soul: profile.soulContent || DEFAULT_AGENT_PROFILE.soulContent,
    userContext: profile.userContextContent || DEFAULT_AGENT_PROFILE.userContextContent,
  }
}

export function buildAgentPersonaPrompt(persona: AgentPersonaContext): string {
  const sections: string[] = []

  if (persona.identity.trim()) {
    sections.push(`[蝶灵身份 IDENTITY]\n${persona.identity.trim()}`)
  }
  if (persona.soul.trim()) {
    sections.push(`[蝶灵性格 SOUL]\n${persona.soul.trim()}`)
  }
  if (persona.userContext.trim()) {
    sections.push(`[用户认知 USER]\n${persona.userContext.trim()}`)
  }
  if (persona.rules.trim()) {
    sections.push(`[用户规则 RULES]\n${persona.rules.trim()}`)
  }

  return sections.join("\n\n")
}

export async function updateAgentProfile(
  userId: string,
  input: {
    soulContent?: string
    identityContent?: string
    userContextContent?: string
    rulesContent?: string
    enabled?: boolean
    restoreDefaults?: boolean
    avatarUrl?: string | null
  },
) {
  await getOrCreateAgentProfile(userId)

  if (input.restoreDefaults) {
    return prisma.agentProfile.update({
      where: { userId },
      data: {
        soulContent: DEFAULT_AGENT_PROFILE.soulContent,
        identityContent: DEFAULT_AGENT_PROFILE.identityContent,
        userContextContent: DEFAULT_AGENT_PROFILE.userContextContent,
        rulesContent: DEFAULT_AGENT_PROFILE.rulesContent,
        enabled: input.enabled ?? true,
      },
    })
  }

  const data: Record<string, unknown> = {}
  if (input.soulContent !== undefined) data.soulContent = input.soulContent
  if (input.identityContent !== undefined) data.identityContent = input.identityContent
  if (input.userContextContent !== undefined) data.userContextContent = input.userContextContent
  if (input.rulesContent !== undefined) data.rulesContent = input.rulesContent
  if (input.enabled !== undefined) data.enabled = input.enabled
  if (input.avatarUrl !== undefined) {
    const trimmed = input.avatarUrl?.trim() ?? ""
    data.avatarUrl = trimmed ? trimmed : null
  }

  return prisma.agentProfile.update({
    where: { userId },
    data,
  })
}

// ── Section-level mutations (for AI tool use) ────────────────────────────

export type AgentProfileSection = "identity" | "soul" | "user" | "rules"
export type AgentProfileOperation = "append" | "replace_section" | "rewrite"

const SECTION_FIELD_MAP: Record<AgentProfileSection, { content: string; version: string }> = {
  identity: { content: "identityContent", version: "identityVersion" },
  soul:     { content: "soulContent",     version: "soulVersion" },
  user:     { content: "userContextContent", version: "userContextVersion" },
  rules:    { content: "rulesContent",    version: "rulesVersion" },
}

export async function applyAgentProfileMutation(
  userId: string,
  section: AgentProfileSection,
  operation: AgentProfileOperation,
  content: string,
) {
  const profile = await getOrCreateAgentProfile(userId)
  const fields = SECTION_FIELD_MAP[section]
  const currentContent = (profile as Record<string, unknown>)[fields.content] as string

  let newContent: string

  switch (operation) {
    case "append":
      newContent = currentContent
        ? `${currentContent.trimEnd()}\n${content.trim()}`
        : content.trim()
      break
    case "replace_section":
      newContent = content.trim()
      break
    case "rewrite":
      newContent = content.trim()
      break
  }

  const newVersion = ((profile as Record<string, unknown>)[fields.version] as number) + 1

  await prisma.agentProfile.update({
    where: { userId },
    data: {
      [fields.content]: newContent,
      [fields.version]: newVersion,
    },
  })

  return {
    section,
    operation,
    newContent: newContent.slice(0, 200),
    version: newVersion,
  }
}

export function getAgentProfileSectionPreview(content: string, maxLen = 120): string {
  const trimmed = content.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 3)}...`
}
