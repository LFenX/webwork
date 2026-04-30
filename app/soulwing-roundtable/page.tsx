import { requireAuth } from "@/lib/auth"
import { getUserSiteSettings } from "@/lib/settings"
import { prisma } from "@/lib/db"
import { SoulWingRoundtableClient } from "@/components/ai/soulwing-roundtable-client"

export const dynamic = "force-dynamic"

export default async function SoulWingRoundtablePage() {
  const { userId, email } = await requireAuth()
  const settings = await getUserSiteSettings(userId)
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
  })

  return (
    <main className="mx-auto min-h-[calc(var(--app-viewport-height)-3rem)] w-full max-w-[1280px] px-4 py-5 sm:px-6">
      <SoulWingRoundtableClient
        currentUser={{
          id: currentUser?.id ?? userId,
          email: currentUser?.email ?? email,
          displayName: currentUser?.displayName || currentUser?.email || email,
          avatarText: currentUser?.avatarText ?? "",
          avatarUrl: currentUser?.avatarUrl ?? null,
        }}
        locale={settings.language}
      />
    </main>
  )
}
