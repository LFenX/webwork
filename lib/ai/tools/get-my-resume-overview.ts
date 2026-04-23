import "server-only"
import { prisma } from "@/lib/db"
import { getResumeContent } from "@/lib/mdx"
import { countWords } from "@/lib/text-stats"

export const getMyResumeOverviewTool = {
  name: "get_my_resume_overview",
  title: "我的简历概览",
  description: "获取当前用户简历模式、内容概览和版本数量",
  execute: async ({ userId }: { userId: string }) => {
    const [resume, versionCount] = await Promise.all([
      getResumeContent(userId),
      prisma.resumeVersion.count({ where: { userId } }),
    ])

    return {
      resume: {
        mode: resume.mode,
        hasPdf: Boolean(resume.pdfPath),
        wordCount: countWords(resume.content || ""),
        versionCount,
      },
    }
  },
}
