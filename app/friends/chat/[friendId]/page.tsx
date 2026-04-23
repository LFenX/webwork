import { requireAuth } from "@/lib/auth"
import { FriendChatPageClient } from "./chat-page-client"

export const metadata = { title: "好友聊天 - My Space" }

export default async function FriendChatPage({ params }: { params: Promise<{ friendId: string }> }) {
  await requireAuth()
  const { friendId } = await params
  return <FriendChatPageClient friendId={friendId} />
}
