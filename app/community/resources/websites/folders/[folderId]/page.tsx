import Link from "next/link"
import { ArrowLeft, FolderInput } from "lucide-react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { WebsiteShareClient } from "@/components/community/website-share-client"
import { ModuleHero, ModulePageShell } from "@/components/module/module-shell"

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
        user: { select: USER_SELECT },
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
        user: { select: USER_SELECT },
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
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={FolderInput}
          title={folder.name}
          description={folder.description || "浏览这个文件夹中的社区网站资源。"}
          actions={
            <Link
              href="/community/resources/websites"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
            >
              <ArrowLeft size={16} />
              网站分享
            </Link>
          }
        />

        <WebsiteShareClient
          initialItems={initialItems}
          initialTotal={folder._count.websites}
          initialFolders={foldersRaw}
          session={session}
          prefilledFolderId={folderId}
          folderInfo={folder}
        />
      </div>
    </ModulePageShell>
  )
}
