import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"

export const metadata = { title: "好友聊天 - My Space" }

export default async function FriendChatPage({ params }: { params: Promise<{ friendId: string }> }) {
  await requireAuth()
  const { friendId } = await params
  redirect(`/friends?type=direct&id=${encodeURIComponent(friendId)}`)
}
