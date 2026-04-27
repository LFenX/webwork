import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { WebsiteShareClient } from "@/components/community/website-share-client"

export const dynamic = "force-dynamic"

const USER_SELECT = { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } as const
const FOLDER_SELECT = { id: true, name: true, userId: true } as const

interface Props {
  params: Promise<{ folderId: string }>
}

export default async function FolderDetailPage({ params }: Props) {
  const { folderId } = await params
  const session = await getOptionalSession()

  const [folder, rawItems, foldersRaw] = await Promise.all([
    prisma.websiteFolder.findUnique({
      where: { id: folderId },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
        _count: { select: { websites: true } },
      },
    }),
    prisma.websiteResource.findMany({
      where: { visibility: "public", folderId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { select: USER_SELECT },
        folder: { select: FOLDER_SELECT },
      },
    }),
    prisma.websiteFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { websites: true } },
        user: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
      },
    }),
  ])

  if (!folder) notFound()

  const initialItems = rawItems.map((item) => ({
    ...item,
    tags: JSON.parse(item.tags || "[]"),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/community/resources/websites"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary] hover:no-underline"
        >
          <ArrowLeft size={16} />
          网站分享
        </Link>
      </div>

      <WebsiteShareClient
        initialItems={initialItems}
        initialTotal={folder._count.websites}
        initialFolders={foldersRaw}
        session={session}
        prefilledFolderId={folderId}
        folderInfo={folder}
      />
    </div>
  )
}
