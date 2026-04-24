import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FriendsClient } from "./friends-client"

export const metadata = { title: "好友 — My Space" }

export default async function FriendsPage() {
  const { userId, email } = await requireAuth()
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
  })
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">好友</h1>
        <p className="text-sm text-[--color-text-muted]">管理好友关系，查看好友的公开内容。</p>
      </div>
      <FriendsClient
        userId={userId}
        currentUser={{
          id: currentUser?.id ?? userId,
          email: currentUser?.email ?? email,
          displayName: currentUser?.displayName ?? currentUser?.email ?? email,
          avatarText: currentUser?.avatarText ?? "",
          avatarUrl: currentUser?.avatarUrl ?? null,
        }}
      />
    </div>
  )
}
