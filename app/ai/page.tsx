import { AIAssistantClient } from "@/components/ai/assistant-client"
import { requireAuth } from "@/lib/auth"
import { getUserAdminInfo, normalizeUserRole } from "@/lib/admin"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

function extractAgentIdentityNames(identityContent?: string | null) {
  const text = identityContent || ""
  const read = (patterns: RegExp[], fallback: string) => {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      const value = match?.[1]?.trim()
      if (value) return value.replace(/^[\s"'“”‘’]+|[\s"'“”‘’，,。.;；]+$/g, "").slice(0, 40) || fallback
    }
    return fallback
  }

  return {
    chineseName: read([
      /(?:中文名|中文名称|中文名字)\s*[:：]\s*([^\n\r]+)/i,
      /(?:Chinese\s*name)\s*[:：]\s*([^\n\r]+)/i,
    ], "蝶灵"),
    englishName: read([
      /(?:英文名|英文名称|英文名字)\s*[:：]\s*([^\n\r]+)/i,
      /(?:English\s*name)\s*[:：]\s*([^\n\r]+)/i,
    ], "SoulWing"),
  }
}

export default async function AIPage() {
  const session = await requireAuth()
  const [user, viewer, agentProfile] = await Promise.all([
    getUserAdminInfo(session.userId),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        displayName: true,
        avatarText: true,
        avatarUrl: true,
      },
    }),
    prisma.agentProfile.findUnique({
      where: { userId: session.userId },
      select: {
        identityContent: true,
        avatarUrl: true,
      },
    }),
  ])
  const normalizedUser = user ? await normalizeUserRole(user) : null
  const agentIdentity = extractAgentIdentityNames(agentProfile?.identityContent)

  return (
    <div className="soulwing-chat-page mobile-chat-viewport h-[calc(var(--app-viewport-height)-3.5rem)] overflow-hidden bg-[#f4f7fb] text-slate-950 md:h-[calc(100vh-3.5rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1760px] flex-col px-0 py-0 sm:px-4 md:px-6 md:pb-5 md:pt-4 xl:px-8">
        <div className="min-h-0 flex-1">
          <AIAssistantClient
            canManageAI={Boolean(normalizedUser?.permissions.manageAI)}
            viewer={{
              name: viewer?.displayName || viewer?.email || session.email || "SoulWing",
              email: viewer?.email || session.email || null,
              avatarText: viewer?.avatarText || null,
              avatarUrl: viewer?.avatarUrl || null,
            }}
            agentProfile={{
              chineseName: agentIdentity.chineseName,
              englishName: agentIdentity.englishName,
              avatarUrl: agentProfile?.avatarUrl || null,
            }}
          />
        </div>
      </div>
    </div>
  )
}
