import { GroupChatClient } from "@/components/announcement-channel-bar"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function ChannelsPage() {
  const { userId } = await requireAuth()
  return (
    <div className="mx-auto flex h-[calc(var(--app-viewport-height)-3rem)] w-full max-w-[1200px] flex-col overflow-x-hidden px-0 sm:px-6 sm:py-6">
      <div className="flex min-h-0 w-full max-w-full flex-1 overflow-hidden border-[--color-border] bg-[--color-bg-surface] sm:rounded-[--radius-lg] sm:border">
        <GroupChatClient userId={userId} />
      </div>
    </div>
  )
}
