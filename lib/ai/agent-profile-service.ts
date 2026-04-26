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
      rules: "",
      identity: "你是蝶灵（SoulWing），当前用户的专属 AI 助手。",
      soul: "",
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
