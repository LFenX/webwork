import "server-only"
import { prisma } from "@/lib/db"
import { getPost, getPosts, getResumeContent, getSiteSettings } from "@/lib/mdx"
import { compactText } from "@/lib/ai/tools/context"
import { explainVisibilityDenial, getVisibleUserAccess, toolForbidden, toolGranted, toolNotFound } from "@/lib/ai/tools/helpers"

const POST_TYPES = ["blog", "daily", "reflections", "notes"] as const
type PostType = (typeof POST_TYPES)[number]

function normalizeLimit(limit: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(limit)) return fallback
  return Math.min(Math.max(Math.trunc(limit as number), 1), max)
}

function matchesQuery(values: Array<string | null | undefined>, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = values.filter(Boolean).join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

async function buildVisibleHomeOverview(viewerId: string, ownerId: string) {
  const access = await getVisibleUserAccess(viewerId, ownerId, "home")
  const moduleNames = ["resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] as const

  if (!access.moduleVisible) {
    return toolForbidden("当前用户无权访问目标用户主页。", explainVisibilityDenial(access.level, "home"), {
      ownerId,
      accessLevel: access.level,
    })
  }

  const [settings, layout, postCounts, jobsCount, interviewsCount] = await Promise.all([
    getSiteSettings(ownerId),
    prisma.homeLayout.findUnique({ where: { userId: ownerId }, select: { config: true, updatedAt: true } }),
    prisma.post.groupBy({
      by: ["type"],
      where: {
        userId: ownerId,
        type: { in: [...POST_TYPES] },
        visibility: { in: access.visibilities },
      },
      _count: { _all: true },
    }),
    prisma.jobApplication.count({ where: { userId: ownerId } }),
    prisma.interviewRecord.count({ where: { userId: ownerId } }),
  ])

  const moduleVisibility = await Promise.all(
    moduleNames.map(async (module) => ({
      module,
      visible: (await getVisibleUserAccess(viewerId, ownerId, module)).moduleVisible,
    })),
  )

  const counts = Object.fromEntries(POST_TYPES.map((type) => [type, 0])) as Record<PostType, number>
  for (const row of postCounts) {
    if (row.type in counts) counts[row.type as PostType] = row._count._all
  }

  return toolGranted("已读取目标用户在当前权限下可见的主页概览。", {
    ownerId,
    accessLevel: access.level,
    settings,
    layout: layout
      ? {
          config: layout.config,
          updatedAt: layout.updatedAt.toISOString(),
        }
      : null,
    modules: moduleVisibility,
    counts: {
      posts: counts,
      jobs: jobsCount,
      interviews: interviewsCount,
    },
  })
}

export const getVisibleUserPermissionsTool = {
  name: "get_visible_user_permissions",
  title: "检查好友主页访问权限",
  description: "检查当前用户是否能访问目标用户主页的各个模块。",
  execute: async ({ userId, targetUserId }: { userId: string; targetUserId: string }) => {
    const owner = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    })
    if (!owner) return toolNotFound("目标用户不存在。", "target_user_not_found", { targetUserId })

    const modules = await Promise.all(
      (["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] as const).map(async (module) => {
        const access = await getVisibleUserAccess(userId, targetUserId, module)
        return {
          module,
          access: access.moduleVisible ? "granted" : "forbidden",
          reason: access.moduleVisible ? null : explainVisibilityDenial(access.level, module),
        }
      }),
    )

    const accessLevel = (await getVisibleUserAccess(userId, targetUserId)).level
    const anyVisible = modules.some((module) => module.access === "granted")
    if (!anyVisible) {
      return toolForbidden("当前用户无法访问目标用户的主页数据。", explainVisibilityDenial(accessLevel), {
        owner,
        accessLevel,
        modules,
      })
    }

    return toolGranted("已检查目标用户主页访问权限。", {
      owner,
      accessLevel,
      modules,
    })
  },
}

export const getVisibleUserHomeOverviewTool = {
  name: "get_visible_user_home_overview",
  title: "读取好友主页概览",
  description: "读取当前用户在权限范围内可见的好友主页概览数据。",
  execute: async ({ userId, targetUserId }: { userId: string; targetUserId: string }) =>
    buildVisibleHomeOverview(userId, targetUserId),
}

export const getVisibleUserResumeDetailTool = {
  name: "get_visible_user_resume_detail",
  title: "读取好友简历",
  description: "读取当前用户有权限查看的目标用户简历完整内容。",
  execute: async ({ userId, targetUserId }: { userId: string; targetUserId: string }) => {
    const access = await getVisibleUserAccess(userId, targetUserId, "resume")
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问目标用户简历。", explainVisibilityDenial(access.level, "resume"), {
        ownerId: targetUserId,
        accessLevel: access.level,
      })
    }

    const resume = await getResumeContent(targetUserId)
    return toolGranted("已读取目标用户简历内容。", {
      mode: resume.mode,
      content: resume.content,
      pdfPath: resume.pdfPath ?? null,
    })
  },
}

export const listVisibleUserPostsTool = {
  name: "list_visible_user_posts",
  title: "列出好友文章",
  description: "列出当前用户有权限看到的目标用户文章，可按类型或关键词筛选。",
  execute: async ({
    userId,
    targetUserId,
    postType,
    query,
    limit,
  }: {
    userId: string
    targetUserId: string
    postType?: PostType
    query?: string
    limit?: number
  }) => {
    const types = postType ? [postType] : [...POST_TYPES]
    const visibleTypes: PostType[] = []
    for (const type of types) {
      const access = await getVisibleUserAccess(userId, targetUserId, type)
      if (access.moduleVisible) visibleTypes.push(type)
    }

    if (visibleTypes.length === 0) {
      return toolForbidden("当前用户无权访问目标用户的相关文章模块。", "no_visible_post_module", {
        ownerId: targetUserId,
        requestedTypes: types,
      })
    }

    const visibilityContexts = await Promise.all(
      visibleTypes.map(async (type) => ({
        type,
        access: await getVisibleUserAccess(userId, targetUserId, type),
      })),
    )

    const posts = (await Promise.all(
      visibilityContexts.map(({ type, access }) => getPosts(type, targetUserId, access.visibilities)),
    )).flat()

    const items = (query ? posts.filter((post) => matchesQuery([post.title, post.summary, post.tags.join(" "), post.slug], query)) : posts)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, normalizeLimit(limit, 20, 50))
      .map((post) => ({
        id: post.id,
        type: post.type,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        tags: post.tags,
        visibility: post.visibility,
        folder: post.folder,
        date: post.date,
        updatedAt: post.updatedAt,
      }))

    return toolGranted(`已列出 ${items.length} 篇当前用户可见的文章。`, { items })
  },
}

export const getVisibleUserPostContentTool = {
  name: "get_visible_user_post_content",
  title: "读取好友文章全文",
  description: "读取当前用户有权限查看的目标用户某篇文章全文。",
  execute: async ({
    userId,
    targetUserId,
    slug,
    postType,
    postId,
  }: {
    userId: string
    targetUserId: string
    slug?: string
    postType?: PostType
    postId?: string
  }) => {
    const resolved = postId
      ? await prisma.post.findFirst({
          where: { id: postId, userId: targetUserId },
          select: { type: true, slug: true },
        })
      : null

    const type = postType ?? (resolved?.type as PostType | undefined)
    const finalSlug = slug ?? resolved?.slug
    if (!type || !finalSlug) {
      return toolNotFound("缺少文章定位信息，无法读取好友文章。", "post_locator_missing")
    }

    const access = await getVisibleUserAccess(userId, targetUserId, type)
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问该文章所属模块。", explainVisibilityDenial(access.level, type), {
        ownerId: targetUserId,
        postType: type,
        slug: finalSlug,
      })
    }

    const post = await getPost(type, finalSlug, targetUserId, access.visibilities)
    if (!post) {
      return toolForbidden("文章不存在，或该文章对当前用户不可见。", "post_not_visible", {
        ownerId: targetUserId,
        postType: type,
        slug: finalSlug,
      })
    }

    return toolGranted(`已读取文章《${post.title}》的全文。`, {
      id: post.id,
      type: post.type,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: post.tags,
      visibility: post.visibility,
      folder: post.folder,
      date: post.date,
      updatedAt: post.updatedAt,
      author: post.author,
      content: post.content,
      wordCount: post.wordCount,
      readingMinutes: post.readingMinutes,
    })
  },
}

export const listVisibleUserJobsTool = {
  name: "list_visible_user_jobs",
  title: "列出好友求职记录",
  description: "列出当前用户有权限访问的目标用户求职记录。",
  execute: async ({
    userId,
    targetUserId,
    status,
    query,
    limit,
  }: {
    userId: string
    targetUserId: string
    status?: string
    query?: string
    limit?: number
  }) => {
    const access = await getVisibleUserAccess(userId, targetUserId, "jobs")
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问目标用户求职记录。", explainVisibilityDenial(access.level, "jobs"), {
        ownerId: targetUserId,
      })
    }

    const rows = await prisma.jobApplication.findMany({
      where: {
        userId: targetUserId,
        ...(status ? { status } : {}),
      },
      orderBy: { appliedAt: "desc" },
      include: { _count: { select: { interviews: true } } },
    })

    const items = rows
      .filter((job) => !query || matchesQuery([
        job.company,
        job.position,
        job.channel,
        job.status,
        job.baseLocation,
        job.hrContact,
        job.link,
        job.notes,
      ], query))
      .slice(0, normalizeLimit(limit, 20, 50))
      .map((job) => ({
        id: job.id,
        company: job.company,
        position: job.position,
        channel: job.channel,
        status: job.status,
        appliedAt: job.appliedAt.toISOString(),
        repliedAt: job.repliedAt?.toISOString() ?? null,
        notes: job.notes,
        baseLocation: job.baseLocation,
        hrContact: job.hrContact,
        link: job.link,
        interviewCount: job._count.interviews,
      }))

    return toolGranted(`已列出 ${items.length} 条好友求职记录。`, { items })
  },
}

export const getVisibleUserJobDetailTool = {
  name: "get_visible_user_job_detail",
  title: "读取好友求职详情",
  description: "读取当前用户有权限访问的目标用户某条求职记录。",
  execute: async ({
    userId,
    targetUserId,
    jobId,
  }: {
    userId: string
    targetUserId: string
    jobId: string
  }) => {
    const access = await getVisibleUserAccess(userId, targetUserId, "jobs")
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问目标用户求职详情。", explainVisibilityDenial(access.level, "jobs"), {
        ownerId: targetUserId,
        jobId,
      })
    }

    const job = await prisma.jobApplication.findFirst({
      where: { id: jobId, userId: targetUserId },
      include: { _count: { select: { interviews: true } } },
    })
    if (!job) return toolNotFound("没有找到对应求职记录。", "job_not_found", { jobId })

    return toolGranted(`已读取 ${job.company} - ${job.position} 的求职详情。`, {
      id: job.id,
      company: job.company,
      position: job.position,
      channel: job.channel,
      status: job.status,
      appliedAt: job.appliedAt.toISOString(),
      repliedAt: job.repliedAt?.toISOString() ?? null,
      notes: job.notes,
      baseLocation: job.baseLocation,
      hrContact: job.hrContact,
      link: job.link,
      interviewCount: job._count.interviews,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })
  },
}

export const listVisibleUserInterviewsTool = {
  name: "list_visible_user_interviews",
  title: "列出好友面试记录",
  description: "列出当前用户有权限访问的目标用户面试记录。",
  execute: async ({
    userId,
    targetUserId,
    result,
    query,
    limit,
  }: {
    userId: string
    targetUserId: string
    result?: string
    query?: string
    limit?: number
  }) => {
    const access = await getVisibleUserAccess(userId, targetUserId, "interviews")
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问目标用户面试记录。", explainVisibilityDenial(access.level, "interviews"), {
        ownerId: targetUserId,
      })
    }

    const rows = await prisma.interviewRecord.findMany({
      where: {
        userId: targetUserId,
        ...(result ? { result } : {}),
      },
      orderBy: { scheduledAt: "desc" },
      include: {
        job: { select: { id: true, company: true, position: true } },
      },
    })

    const items = rows
      .filter((item) => !query || matchesQuery([
        item.company,
        item.position,
        item.round,
        item.format,
        item.result,
        item.interviewers,
        item.questions,
        item.feedback,
      ], query))
      .slice(0, normalizeLimit(limit, 20, 50))
      .map((item) => ({
        id: item.id,
        company: item.company,
        position: item.position,
        round: item.round,
        format: item.format,
        scheduledAt: item.scheduledAt.toISOString(),
        interviewers: item.interviewers,
        selfRating: item.selfRating,
        result: item.result,
        linkedJob: item.job,
        notesPreview: compactText([item.questions, item.feedback].filter(Boolean).join(" "), 120),
      }))

    return toolGranted(`已列出 ${items.length} 条好友面试记录。`, { items })
  },
}

export const getVisibleUserInterviewDetailTool = {
  name: "get_visible_user_interview_detail",
  title: "读取好友面试详情",
  description: "读取当前用户有权限访问的目标用户某条面试记录。",
  execute: async ({
    userId,
    targetUserId,
    interviewId,
  }: {
    userId: string
    targetUserId: string
    interviewId: string
  }) => {
    const access = await getVisibleUserAccess(userId, targetUserId, "interviews")
    if (!access.moduleVisible) {
      return toolForbidden("当前用户无权访问目标用户面试详情。", explainVisibilityDenial(access.level, "interviews"), {
        ownerId: targetUserId,
        interviewId,
      })
    }

    const item = await prisma.interviewRecord.findFirst({
      where: { id: interviewId, userId: targetUserId },
      include: {
        job: { select: { id: true, company: true, position: true } },
      },
    })
    if (!item) return toolNotFound("没有找到对应面试记录。", "interview_not_found", { interviewId })

    return toolGranted(`已读取 ${item.company} - ${item.position} 的面试详情。`, {
      id: item.id,
      company: item.company,
      position: item.position,
      round: item.round,
      format: item.format,
      scheduledAt: item.scheduledAt.toISOString(),
      interviewers: item.interviewers,
      questions: item.questions,
      selfRating: item.selfRating,
      result: item.result,
      feedback: item.feedback,
      linkedJob: item.job,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })
  },
}
