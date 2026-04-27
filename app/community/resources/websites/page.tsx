import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { WebsiteShareClient } from "@/components/community/website-share-client"

export const dynamic = "force-dynamic"

const USER_SELECT = { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } as const
const FOLDER_SELECT = { id: true, name: true, userId: true } as const

export default async function WebsitesPage() {
  const session = await getOptionalSession()

  const [rawItems, foldersRaw] = await Promise.all([
    prisma.websiteResource.findMany({
      where: { visibility: "public" },
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
          href="/community/resources"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary] hover:no-underline"
        >
          <ArrowLeft size={16} />
          社区资源
        </Link>
        <h1 className="text-xl font-semibold text-[--color-text-primary]">网站分享</h1>
      </div>

      <WebsiteShareClient
        initialItems={initialItems}
        initialTotal={0}
        initialFolders={foldersRaw}
        session={session}
        prefilledFolderId={undefined}
        folderInfo={null}
      />
    </div>
  )
}
