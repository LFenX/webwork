import "server-only"
import { prisma } from "@/lib/db"

export const getMyUploadsOverviewTool = {
  name: "get_my_uploads_overview",
  title: "我的上传概览",
  description: "获取当前用户上传文件的概览信息",
  execute: async ({ userId }: { userId: string }) => {
    const [uploads, aggregate] = await Promise.all([
      prisma.upload.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      }),
      prisma.upload.aggregate({
        where: { userId },
        _sum: { size: true },
        _count: { _all: true },
      }),
    ])

    return {
      total: aggregate._count._all,
      totalSize: aggregate._sum.size ?? 0,
      recentUploads: uploads.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    }
  },
}
