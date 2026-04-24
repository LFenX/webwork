import { GroupChatClient } from "@/components/announcement-channel-bar"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getUserSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  const { userId, email } = await requireAuth()
  const settings = await getUserSiteSettings(userId)
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
  })
  return (
    <div className="mx-auto flex h-[calc(var(--app-viewport-height)-3rem)] w-full max-w-[1200px] flex-col overflow-x-hidden px-0 sm:px-6 sm:py-6">
      <div className="flex min-h-0 w-full max-w-full flex-1 overflow-hidden border-[--color-border] bg-[--color-bg-surface] sm:rounded-[--radius-lg] sm:border">
        <GroupChatClient
          userId={userId}
          locale={settings.language}
          currentUser={{
            id: currentUser?.id ?? userId,
            email: currentUser?.email ?? email,
            displayName: currentUser?.displayName ?? currentUser?.email ?? email,
            avatarText: currentUser?.avatarText ?? "",
            avatarUrl: currentUser?.avatarUrl ?? null,
          }}
        />
      </div>
    </div>
  )
}
