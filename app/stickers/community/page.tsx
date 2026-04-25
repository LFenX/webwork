import { StickerCommunityBackButton } from "@/components/sticker-community-back-button"
import { StickerCommunityBrowser } from "@/components/sticker-community-browser"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { serializeSticker } from "@/lib/stickers"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "社区表情包 - My Space",
}

export default async function StickerCommunityPage() {
  const session = await requireAuth()
  const stickers = await prisma.stickerAsset.findMany({
    where: { scope: "public", ownerId: { not: null } },
    include: {
      owner: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      uploader: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  })

  const groupMap = new Map<string, {
    contributor: { id: string; email: string; displayName: string; avatarText: string; avatarUrl: string | null }
    stickers: Array<ReturnType<typeof serializeSticker>>
  }>()

  for (const sticker of stickers) {
    const contributor = sticker.owner ?? sticker.uploader ?? {
      id: `community-${sticker.id}`,
      email: "",
      displayName: "社区表情",
      avatarText: "社区",
      avatarUrl: null,
    }
    const existing = groupMap.get(contributor.id)
    const serialized = serializeSticker(sticker)
    if (existing) {
      existing.stickers.push(serialized)
    } else {
      groupMap.set(contributor.id, {
        contributor,
        stickers: [serialized],
      })
    }
  }

  const groups = [...groupMap.values()]

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-4">
        <StickerCommunityBackButton />
      </div>
      <StickerCommunityBrowser groups={groups} userId={session.userId} />
    </div>
  )
}
