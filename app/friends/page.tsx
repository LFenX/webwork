import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FriendsHubClient, type InitialConversation } from "./friends-hub-client"

export const metadata = { title: "好友与群聊 - My Space" }

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string; discussion?: string }>
}) {
  const [{ userId, email }, query] = await Promise.all([requireAuth(), searchParams])
  const initialConversation: InitialConversation = {
    type: query.type === "direct" || query.type === "channel" ? query.type : undefined,
    id: query.id,
    discussion: query.discussion,
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
  })
  return (
    <div className="h-[calc(var(--app-viewport-height)-3.5rem)] min-h-0 overflow-hidden bg-[#eef3f8] px-3 py-4 sm:px-4 lg:px-8 lg:py-6 xl:px-12">
      <div className="mx-auto h-full min-h-0 max-w-[1760px]">
        <FriendsHubClient
          userId={userId}
          initialConversation={initialConversation}
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
