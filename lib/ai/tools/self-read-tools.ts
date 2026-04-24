import "server-only"
import { prisma } from "@/lib/db"
import { getPosts, getPost, getSiteSettings } from "@/lib/mdx"
import { getUserAdminInfo } from "@/lib/admin"
import { compactText } from "@/lib/ai/tools/context"
import { getFriendProfileSnapshot, resolveUserReference, toolGranted, toolNotFound } from "@/lib/ai/tools/helpers"

const MODULE_KEYS = ["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] as const
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

async function readModuleVisibility(userId: string) {
  const rows = await prisma.moduleVisibility.findMany({
    where: { userId },
    select: { module: true, visibility: true },
  })

  return Object.fromEntries(
    MODULE_KEYS.map((module) => [
      module,
      rows.find((row) => row.module === module)?.visibility === "friends" ? "friends" : "private",
    ]),
  ) as Record<(typeof MODULE_KEYS)[number], "private" | "friends">
}

async function buildHomeOverview(userId: string) {
  const [settings, layout, resume, jobsCount, interviewsCount, postsByType, friendCount, moduleVisibility] = await Promise.all([
    getSiteSettings(userId),
    prisma.homeLayout.findUnique({ where: { userId }, select: { config: true, updatedAt: true } }),
    prisma.resume.findUnique({ where: { userId }, select: { mode: true, updatedAt: true, pdfPath: true, content: true } }),
    prisma.jobApplication.count({ where: { userId } }),
    prisma.interviewRecord.count({ where: { userId } }),
    prisma.post.groupBy({
      by: ["type"],
      where: { userId, type: { in: [...POST_TYPES] } },
      _count: { _all: true },
    }),
    prisma.friendship.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    readModuleVisibility(userId),
  ])

  const postCounts = Object.fromEntries(POST_TYPES.map((type) => [type, 0])) as Record<PostType, number>
  for (const row of postsByType) {
    if (row.type in postCounts) {
      postCounts[row.type as PostType] = row._count._all
    }
  }

  return {
    settings,
    layout: layout
      ? {
          config: layout.config,
          updatedAt: layout.updatedAt.toISOString(),
        }
      : null,
    modules: moduleVisibility,
    resume: resume
      ? {
          mode: resume.mode,
          hasPdf: Boolean(resume.pdfPath),
          updatedAt: resume.updatedAt.toISOString(),
        }
      : null,
    counts: {
      posts: postCounts,
      jobs: jobsCount,
      interviews: interviewsCount,
      friends: friendCount,
    },
  }
}

export const getMyPermissionsTool = {
  name: "get_my_permissions",
  title: "检查我的访问权限",
  description: "读取当前用户的角色、管理员状态、管理员权限和各模块开放设置。",
  execute: async ({ userId }: { userId: string }) => {
    const [user, adminInfo, moduleVisibility] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, role: true },
      }),
      getUserAdminInfo(userId),
      readModuleVisibility(userId),
    ])

    if (!user) return toolNotFound("当前用户不存在。", "user_not_found")

    return toolGranted("已读取当前用户的角色、管理员权限和模块开放设置。", {
      actor: user,
      isAdmin: adminInfo?.role === "owner" || adminInfo?.role === "admin",
      adminPermissions: adminInfo?.permissions ?? null,
      modules: Object.entries(moduleVisibility).map(([module, visibility]) => ({
        module,
        access: "granted",
        visibility,
      })),
    })
  },
}

export const getMyModuleVisibilityTool = {
  name: "get_my_module_visibility",
  title: "读取我的模块开放设置",
  description: "查看当前用户主页各模块对好友的开放状态。",
  execute: async ({ userId }: { userId: string }) => {
    const modules = await readModuleVisibility(userId)
    return toolGranted("已读取当前用户的模块开放设置。", {
      modules: Object.entries(modules).map(([module, visibility]) => ({ module, visibility })),
    })
  },
}

export const getMyHomeOverviewTool = {
  name: "get_my_home_overview",
  title: "读取我的主页概览",
  description: "聚合当前用户主页会展示的基础信息、主页布局和各模块数据计数。",
  execute: async ({ userId }: { userId: string }) => {
    const overview = await buildHomeOverview(userId)
    return toolGranted("已汇总当前用户主页相关的核心数据。", overview)
  },
}

export const getMyResumeDetailTool = {
  name: "get_my_resume_detail",
  title: "读取我的简历全文",
  description: "读取当前用户简历的完整内容、模式和 PDF 状态。",
  execute: async ({ userId }: { userId: string }) => {
    const resume = await prisma.resume.upsert({
      where: { userId },
      update: {},
      create: { userId, mode: "markdown", content: "" },
    })

    return toolGranted("已读取当前用户的简历完整内容。", {
      mode: resume.mode,
      content: resume.content,
      pdfPath: resume.pdfPath,
      updatedAt: resume.updatedAt.toISOString(),
    })
  },
}

export const getMyResumeVersionsTool = {
  name: "get_my_resume_versions",
  title: "读取我的简历版本",
  description: "读取当前用户保存过的简历 PDF 版本列表。",
  execute: async ({ userId }: { userId: string }) => {
    const versions = await prisma.resumeVersion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        pdfPath: true,
        originalName: true,
        size: true,
        createdAt: true,
      },
    })

    return toolGranted(`已读取 ${versions.length} 个简历版本。`, {
      items: versions.map((version) => ({
        ...version,
        createdAt: version.createdAt.toISOString(),
      })),
    })
  },
}

export const listMyPostsTool = {
  name: "list_my_posts",
  title: "列出我的文章",
  description: "按类型列出当前用户的博客、日常、心得或笔记文章。",
  execute: async ({
    userId,
    type,
    limit,
    query,
  }: {
    userId: string
    type?: PostType
    limit?: number
    query?: string
  }) => {
    const types = type ? [type] : [...POST_TYPES]
    const posts = (await Promise.all(types.map((item) => getPosts(item, userId)))).flat()
    const filtered = query
      ? posts.filter((post) => matchesQuery([post.title, post.summary, post.tags.join(" "), post.slug], query))
      : posts

    const items = filtered
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

    return toolGranted(`已列出 ${items.length} 篇文章。`, { items })
  },
}

export const searchMyPostsTool = {
  name: "search_my_posts",
  title: "搜索我的文章",
  description: "按关键词搜索当前用户可访问的文章标题、摘要、标签和正文。",
  execute: async ({
    userId,
    query,
    type,
    limit,
  }: {
    userId: string
    query: string
    type?: PostType
    limit?: number
  }) => {
    const types = type ? [type] : [...POST_TYPES]
    const records = await prisma.post.findMany({
      where: {
        userId,
        type: { in: types },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        type: true,
        slug: true,
        title: true,
        summary: true,
        tags: true,
        content: true,
        visibility: true,
        date: true,
        updatedAt: true,
        folder: { select: { id: true, name: true } },
      },
    })

    const items = records
      .filter((post) => matchesQuery([post.title, post.summary, post.content, post.tags], query))
      .slice(0, normalizeLimit(limit, 10, 30))
      .map((post) => ({
        id: post.id,
        type: post.type,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        tags: JSON.parse(post.tags || "[]") as string[],
        visibility: post.visibility,
        folder: post.folder,
        date: post.date.toISOString().slice(0, 10),
        updatedAt: post.updatedAt.toISOString(),
        contentPreview: compactText(post.content, 160),
      }))

    return toolGranted(`已找到 ${items.length} 篇匹配文章。`, { items })
  },
}

export const getMyPostDetailTool = {
  name: "get_my_post_detail",
  title: "读取我的文章详情",
  description: "读取当前用户某篇文章的元信息和摘要，不默认返回全文。",
  execute: async ({
    userId,
    slug,
    postType,
    postId,
  }: {
    userId: string
    slug?: string
    postType?: PostType
    postId?: string
  }) => {
    const record = postId
      ? await prisma.post.findFirst({
          where: { id: postId, userId },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            folder: { select: { id: true, name: true } },
          },
        })
      : slug && postType
        ? await getPost(postType, slug, userId)
        : null

    if (!record) {
      return toolNotFound("没有找到对应文章。", "post_not_found", {
        slug: slug ?? null,
        postType: postType ?? null,
        postId: postId ?? null,
      })
    }

    return toolGranted(`已读取文章《${record.title}》的详情信息。`, {
      id: record.id,
      type: record.type,
      slug: record.slug,
      title: record.title,
      summary: record.summary,
      tags: record.tags,
      visibility: record.visibility,
      folder: record.folder,
      date: record.date,
      updatedAt: record.updatedAt,
      author: "author" in record ? record.author : "user" in record ? record.user : undefined,
      wordCount: "wordCount" in record ? record.wordCount : undefined,
      readingMinutes: "readingMinutes" in record ? record.readingMinutes : undefined,
    })
  },
}

export const getMyPostContentTool = {
  name: "get_my_post_content",
  title: "读取我的文章全文",
  description: "读取当前用户某篇文章的完整正文内容。",
  execute: async ({
    userId,
    slug,
    postType,
    postId,
  }: {
    userId: string
    slug?: string
    postType?: PostType
    postId?: string
  }) => {
    const resolved = postId
      ? await prisma.post.findFirst({
          where: { id: postId, userId },
          select: { type: true, slug: true },
        })
      : null

    const type = postType ?? (resolved?.type as PostType | undefined)
    const finalSlug = slug ?? resolved?.slug
    if (!type || !finalSlug) {
      return toolNotFound("缺少文章定位信息，无法读取全文。", "post_locator_missing")
    }

    const post = await getPost(type, finalSlug, userId)
    if (!post) return toolNotFound("没有找到对应文章全文。", "post_not_found")

    return toolGranted(`已读取文章《${post.title}》的完整正文。`, {
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

export const listMyJobsTool = {
  name: "list_my_jobs",
  title: "列出我的求职记录",
  description: "列出当前用户的求职记录，可按状态或关键词筛选。",
  execute: async ({
    userId,
    status,
    query,
    limit,
  }: {
    userId: string
    status?: string
    query?: string
    limit?: number
  }) => {
    const rows = await prisma.jobApplication.findMany({
      where: {
        userId,
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

    return toolGranted(`已列出 ${items.length} 条求职记录。`, { items })
  },
}

export const getMyJobDetailTool = {
  name: "get_my_job_detail",
  title: "读取我的求职详情",
  description: "读取当前用户某条求职记录的完整字段。",
  execute: async ({ userId, jobId }: { userId: string; jobId: string }) => {
    const job = await prisma.jobApplication.findFirst({
      where: { id: jobId, userId },
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

export const listMyInterviewsTool = {
  name: "list_my_interviews",
  title: "列出我的面试记录",
  description: "列出当前用户的面试记录，可按结果或关键词筛选。",
  execute: async ({
    userId,
    result,
    query,
    limit,
  }: {
    userId: string
    result?: string
    query?: string
    limit?: number
  }) => {
    const rows = await prisma.interviewRecord.findMany({
      where: {
        userId,
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
      }))

    return toolGranted(`已列出 ${items.length} 条面试记录。`, { items })
  },
}

export const getMyInterviewDetailTool = {
  name: "get_my_interview_detail",
  title: "读取我的面试详情",
  description: "读取当前用户某条面试记录的完整字段。",
  execute: async ({ userId, interviewId }: { userId: string; interviewId: string }) => {
    const item = await prisma.interviewRecord.findFirst({
      where: { id: interviewId, userId },
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

export const listMyFriendsTool = {
  name: "list_my_friends",
  title: "列出我的好友",
  description: "列出当前用户的好友资料摘要和最近互动信息。",
  execute: async ({ userId, limit }: { userId: string; limit?: number }) => {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "desc" },
    })

    const items = await Promise.all(
      friendships
        .slice(0, normalizeLimit(limit, 30, 100))
        .map((friendship) => getFriendProfileSnapshot(userId, friendship.userAId === userId ? friendship.userBId : friendship.userAId)),
    )

    return toolGranted(`已读取 ${items.filter(Boolean).length} 位好友的信息。`, {
      items: items.filter(Boolean),
    })
  },
}

export const getMyFriendProfileTool = {
  name: "get_my_friend_profile",
  title: "读取某位好友资料",
  description: "读取当前用户某位好友的昵称、邮箱、个签、地区和最近互动信息。",
  execute: async ({
    userId,
    friendId,
    friendHint,
  }: {
    userId: string
    friendId?: string
    friendHint?: string
  }) => {
    let resolvedFriendId = friendId
    if (!resolvedFriendId && friendHint) {
      const resolved = await resolveUserReference(friendHint)
      resolvedFriendId = resolved?.id
    }

    if (!resolvedFriendId) {
      return toolNotFound("缺少好友定位信息，无法读取资料。", "friend_locator_missing")
    }

    const profile = await getFriendProfileSnapshot(userId, resolvedFriendId)
    if (!profile) {
      return toolNotFound("没有找到对应好友，或者对方不是当前用户的好友。", "friend_not_found", {
        friendId: resolvedFriendId,
      })
    }

    return toolGranted(`已读取好友 ${profile.displayName || profile.email} 的资料。`, profile)
  },
}
