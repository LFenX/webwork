import Link from "next/link"
import { ArrowLeft, Globe } from "lucide-react"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { WebsiteShareClient } from "@/components/community/website-share-client"
import { ModuleHero, ModulePageShell } from "@/components/module/module-shell"

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
        user: { select: USER_SELECT },
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
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={Globe}
          title="网站分享"
          description="发现大家收藏的实用网站，按文件夹、标签和贡献者快速筛选。"
          actions={
            <Link
              href="/community/resources"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
            >
              <ArrowLeft size={16} />
              社区资源
            </Link>
          }
        />

        <WebsiteShareClient
          initialItems={initialItems}
          initialTotal={0}
          initialFolders={foldersRaw}
          session={session}
          prefilledFolderId={undefined}
          folderInfo={null}
        />
      </div>
    </ModulePageShell>
  )
}
