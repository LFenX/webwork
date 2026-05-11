import { Brain, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import { SoulWingSettingsClient } from "@/components/ai/soulwing-settings-client"
import { SoulWingHero, SoulWingPageShell } from "@/components/ai/soulwing-ui"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function SoulWingSettingsPage() {
  const session = await requireAuth()
  const [user, profile, memoryFacts, memorySettings, autoReplyEnabled] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, displayName: true, avatarText: true, avatarUrl: true },
    }),
    prisma.agentProfile.findUnique({ where: { userId: session.userId }, select: { enabled: true, avatarUrl: true } }),
    prisma.memoryFact.count({ where: { userId: session.userId, deletedAt: null } }),
    prisma.memorySettings.findUnique({ where: { userId: session.userId } }),
    prisma.autoReplySetting.count({ where: { userId: session.userId, enabled: true } }),
  ])

  const displayName = user?.displayName || user?.email || session.email
  const agentEnabled = profile?.enabled ?? true
  const memoryEnabled = memorySettings?.enableLongTermMemory ?? true

  return (
    <SoulWingPageShell>
      <div className="space-y-5">
        <SoulWingHero
          name={displayName}
          email={user?.email || session.email}
          avatarText={user?.avatarText}
          avatarUrl={profile?.avatarUrl || user?.avatarUrl}
          metrics={[
            { label: "人格上下文", value: agentEnabled ? "已启用" : "已关闭", description: "决定蝶灵的长期表达与边界", icon: Sparkles, tone: agentEnabled ? "blue" : "slate" },
            { label: "长期记忆", value: memoryFacts, description: memoryEnabled ? "可继续沉淀偏好和项目背景" : "当前已暂停写入", icon: Brain, tone: memoryEnabled ? "green" : "slate" },
            { label: "自动回复", value: autoReplyEnabled, description: "已启用的自动回复配置", icon: MessageCircle, tone: autoReplyEnabled > 0 ? "orange" : "slate" },
            { label: "隐私边界", value: "可控", description: "记忆、工具和回复策略可单独开关", icon: ShieldCheck, tone: "blue" },
          ]}
        />
        <SoulWingSettingsClient />
      </div>
    </SoulWingPageShell>
  )
}
