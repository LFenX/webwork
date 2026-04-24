import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FriendChatPageClient } from "./chat-page-client"

export const metadata = { title: "好友聊天 - My Space" }

export default async function FriendChatPage({ params }: { params: Promise<{ friendId: string }> }) {
  const { userId, email } = await requireAuth()
  const { friendId } = await params
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
  })
  return (
    <FriendChatPageClient
      userId={userId}
      friendId={friendId}
      currentUser={{
        id: currentUser?.id ?? userId,
        email: currentUser?.email ?? email,
        displayName: currentUser?.displayName ?? currentUser?.email ?? email,
        avatarText: currentUser?.avatarText ?? "",
        avatarUrl: currentUser?.avatarUrl ?? null,
      }}
    />
  )
}
