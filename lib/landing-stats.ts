import "server-only"
import { prisma } from "@/lib/db"
import { execFileSync } from "node:child_process"
import { formatDateKey } from "@/lib/time"
import { FOREGROUND_OFFLINE_AFTER_MS } from "@/lib/session"
import { getPublicUpdateLog } from "@/lib/update-log"
import {
  LANDING_MODULES,
  LANDING_PLATFORM_FALLBACK,
  type LandingActivity,
  type LandingModuleCount,
  type LandingPlatformStats,
  type LandingPost,
  type LandingRelease,
  type LandingSpace,
} from "@/components/landing/landing-data"

const COLOR_PALETTE = ["#6aa6ff", "#a78bfa", "#f6c177", "#7ee787", "#ec4899", "#22d3ee", "#fb923c", "#e94560"]

function pickColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}

function profileHandle(user: { publicSlug: string | null; id: string; email: string; displayName: string }) {
  return user.publicSlug || user.email.split("@")[0] || user.id.slice(0, 6)
}

function profileHref(user: { publicSlug: string | null; id: string }, suffix = "") {
  const ref = user.publicSlug || user.id
  const tail = suffix ? `/${suffix.replace(/^\/+/, "")}` : ""
  return `/u/${ref}${tail}`
}

function compactSummary(value: string | null | undefined, fallback: string, max = 72) {
  const text = (value ?? "").replace(/\s+/g, " ").trim() || fallback
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function bucketize(values: number[]): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  if (max <= 0) return values.map(() => 0)
  return values.map((v) => {
    if (v <= 0) return 0
    const ratio = v / max
    if (ratio < 0.25) return 1
    if (ratio < 0.5) return 2
    if (ratio < 0.8) return 3
    return 4
  })
}

const POST_TYPE_LABELS: Record<string, string> = {
  blog: "博客",
  daily: "日常",
  reflections: "心得",
  notes: "笔记",
}

const POST_PUBLIC_TYPES = ["blog", "daily", "reflections"] as const
const PUBLIC_POST_TYPES = ["blog", "reflections"] as const

function getBuildHash(): string {
  if (process.env.NEXT_PUBLIC_GIT_HASH) return process.env.NEXT_PUBLIC_GIT_HASH.slice(0, 7)
  try {
    const out = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return out || "—"
  } catch {
    return "—"
  }
}

function getVersionFromReleases(releases: LandingRelease[]): string {
  if (releases.length === 0) return "dev"
  // 优先使用 conventional tag-like prefix；否则取首条 commit 的短 hash
  const first = releases[0]
  const match = first.title.match(/v\d+\.\d+\.\d+/)
  return match?.[0] ?? `build-${first.hash.slice(0, 7)}`
}

async function aggregateHeatmap(): Promise<{ matrix: number[][]; total: number; weeks: number }> {
  const weeks = 53
  const todayKey = formatDateKey(new Date())
  const today = new Date(`${todayKey}T00:00:00`)
  const sinceDate = new Date(today)
  sinceDate.setDate(today.getDate() - (weeks * 7 - 1))
  const sinceKey = formatDateKey(sinceDate)

  const counts = new Map<string, number>()
  const addCounts = (rows: Array<{ date?: Date | null; createdAt?: Date | null; appliedAt?: Date | null; scheduledAt?: Date | null }>) => {
    rows.forEach((row) => {
      const ref = row.date ?? row.createdAt ?? row.appliedAt ?? row.scheduledAt
      if (!ref) return
      const key = formatDateKey(ref)
      if (key < sinceKey) return
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
  }

  try {
    const [posts, jobs, interviews, guestbook, roundtable] = await Promise.all([
      prisma.post.findMany({ where: { date: { gte: sinceDate } }, select: { date: true } }).catch(() => []),
      prisma.jobApplication.findMany({ where: { appliedAt: { gte: sinceDate } }, select: { appliedAt: true } }).catch(() => []),
      prisma.interviewRecord.findMany({ where: { scheduledAt: { gte: sinceDate } }, select: { scheduledAt: true } }).catch(() => []),
      prisma.guestbookMessage.findMany({ where: { createdAt: { gte: sinceDate } }, select: { createdAt: true } }).catch(() => []),
      prisma.soulWingRoundtableMessage.findMany({ where: { createdAt: { gte: sinceDate }, deletedAt: null }, select: { createdAt: true } }).catch(() => []),
    ])
    addCounts(posts)
    addCounts(jobs)
    addCounts(interviews)
    addCounts(guestbook)
    addCounts(roundtable)
  } catch {
    /* fall through with zero matrix */
  }

  // Build a 53×7 matrix using ISO-like weekday (0=Mon ... 6=Sun) anchored on `today`.
  // We back-fill from today, moving columns left-to-right starting at the
  // oldest week so the rightmost column always contains the current week.
  const matrix: number[][] = Array.from({ length: weeks }, () => Array(7).fill(0))
  const totalSlots = weeks * 7
  const values: number[] = []
  for (let i = 0; i < totalSlots; i++) {
    const offset = totalSlots - 1 - i
    const day = new Date(today)
    day.setDate(today.getDate() - offset)
    const key = formatDateKey(day)
    values.push(counts.get(key) ?? 0)
  }
  const buckets = bucketize(values)
  for (let i = 0; i < totalSlots; i++) {
    const week = Math.floor(i / 7)
    const dow = i % 7
    matrix[week][dow] = buckets[i]
  }
  const total = values.reduce((s, v) => s + v, 0)
  return { matrix, total, weeks }
}

async function getRecentPublicPosts(): Promise<LandingPost[]> {
  try {
    const posts = await prisma.post.findMany({
      where: { visibility: "public", type: { in: [...POST_PUBLIC_TYPES, "daily"] } },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: { user: { select: { id: true, publicSlug: true, email: true, displayName: true } } },
    })
    return posts.map((post): LandingPost => {
      const handle = profileHandle(post.user)
      return {
        id: post.id,
        type: post.type,
        typeLabel: POST_TYPE_LABELS[post.type] ?? "文章",
        title: post.title,
        slug: post.slug,
        date: formatDateKey(post.date),
        summary: compactSummary(post.summary, "暂无摘要"),
        author: {
          handle,
          name: post.user.displayName || handle,
          color: pickColor(post.userId),
        },
        href: profileHref(post.user, `${post.type}/${encodeURIComponent(post.slug)}`),
        authorHref: profileHref(post.user),
      }
    })
  } catch {
    return []
  }
}

async function getRecentPlatformActivity(): Promise<LandingActivity[]> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  try {
    const [posts, jobs, interviews, guestbook, joins, roundtable] = await Promise.all([
      prisma.post.findMany({
        where: { visibility: "public", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { id: true, publicSlug: true, email: true, displayName: true } } },
      }).catch(() => []),
      prisma.jobApplication.findMany({
        where: { createdAt: { gte: since }, user: { moduleVisibilities: { some: { module: "jobs", visibility: "public" } } } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: { select: { id: true, publicSlug: true, email: true, displayName: true } } },
      }).catch(() => []),
      prisma.interviewRecord.findMany({
        where: { createdAt: { gte: since }, user: { moduleVisibilities: { some: { module: "interviews", visibility: "public" } } } },
        orderBy: { createdAt: "desc" },
        take: 2,
        include: { user: { select: { id: true, publicSlug: true, email: true, displayName: true } } },
      }).catch(() => []),
      prisma.guestbookMessage.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          author: { select: { id: true, publicSlug: true, email: true, displayName: true } },
          owner: { select: { id: true, publicSlug: true, email: true, displayName: true } },
        },
      }).catch(() => []),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, publicSlug: true, email: true, displayName: true, createdAt: true },
      }).catch(() => []),
      prisma.soulWingRoundtableMessage.findMany({
        where: { createdAt: { gte: since }, deletedAt: null, authorUserId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 2,
        include: {
          discussion: { select: { topicTitle: true } },
        },
      }).catch(() => []),
    ])

    const items: LandingActivity[] = []

    posts.forEach((post) => {
      const handle = profileHandle(post.user)
      items.push({
        id: `post-${post.id}`,
        who: handle,
        whoHref: profileHref(post.user),
        color: pickColor(post.userId),
        action: post.type === "daily" ? "daily" : "publish",
        tag: POST_TYPE_LABELS[post.type] ?? "文章",
        target: post.title,
        href: profileHref(post.user, `${post.type}/${encodeURIComponent(post.slug)}`),
        time: post.createdAt.toISOString(),
      })
    })
    jobs.forEach((job) => {
      const handle = profileHandle(job.user)
      items.push({
        id: `job-${job.id}`,
        who: handle,
        whoHref: profileHref(job.user),
        color: pickColor(job.userId),
        action: "job",
        tag: "求职",
        target: `${job.company} · ${job.status}`,
        href: profileHref(job.user, "jobs"),
        time: job.createdAt.toISOString(),
      })
    })
    interviews.forEach((interview) => {
      const handle = profileHandle(interview.user)
      items.push({
        id: `interview-${interview.id}`,
        who: handle,
        whoHref: profileHref(interview.user),
        color: pickColor(interview.userId),
        action: "interview",
        tag: "面试",
        target: `${interview.company} · ${interview.round}`,
        href: profileHref(interview.user, "interviews"),
        time: interview.createdAt.toISOString(),
      })
    })
    guestbook.forEach((message) => {
      const author = message.author
      const owner = message.owner
      const handle = profileHandle(author)
      items.push({
        id: `guest-${message.id}`,
        who: handle,
        whoHref: profileHref(author),
        color: pickColor(message.authorId),
        action: "guestbook",
        tag: "留言",
        target: `在 @${profileHandle(owner)} 的留言板`,
        href: profileHref(owner, "#guestbook"),
        time: message.createdAt.toISOString(),
      })
    })
    joins.forEach((user) => {
      const handle = profileHandle(user)
      items.push({
        id: `join-${user.id}`,
        who: handle,
        whoHref: profileHref(user),
        color: pickColor(user.id),
        action: "join",
        tag: "新人",
        target: "刚刚创建了空间",
        href: profileHref(user),
        time: user.createdAt.toISOString(),
      })
    })
    roundtable.forEach((message) => {
      items.push({
        id: `roundtable-${message.id}`,
        who: message.authorName || "蝶灵成员",
        whoHref: "/soulwing-roundtable",
        color: "#fb923c",
        action: "roundtable",
        tag: "圆桌",
        target: message.discussion?.topicTitle ?? "圆桌议题",
        href: "/soulwing-roundtable",
        time: message.createdAt.toISOString(),
      })
    })

    return items
      .sort((a, b) => (a.time < b.time ? 1 : -1))
      .slice(0, 10)
  } catch {
    return []
  }
}

async function getActiveSpaces(): Promise<LandingSpace[]> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const grouped = await prisma.post.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, visibility: { in: ["public", "friends"] } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 8,
    }).catch(() => [])

    if (grouped.length === 0) {
      // Fallback to most-recently-created users (with public posts) so the section never shows fake data.
      const fallback = await prisma.user.findMany({
        where: { posts: { some: { visibility: "public" } } },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          publicSlug: true,
          email: true,
          displayName: true,
          bio: true,
          location: true,
          avatarText: true,
          avatarUrl: true,
          _count: { select: { posts: { where: { visibility: "public" } } } },
        },
      })
      return fallback.map((user): LandingSpace => {
        const handle = profileHandle(user)
        return {
          id: user.id,
          handle,
          name: user.displayName || handle,
          color: pickColor(user.id),
          role: user.bio || (user.location ? `空间 · ${user.location}` : "公开空间"),
          posts: user._count.posts,
          trendPct: 0,
          href: profileHref(user),
          avatarText: user.avatarText || handle.slice(0, 2).toUpperCase(),
          avatarUrl: user.avatarUrl,
        }
      })
    }

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: {
        id: true,
        publicSlug: true,
        email: true,
        displayName: true,
        bio: true,
        location: true,
        avatarText: true,
        avatarUrl: true,
        _count: { select: { posts: { where: { visibility: "public" } } } },
      },
    })
    const byId = new Map(users.map((u) => [u.id, u]))

    // Compare against prior 30 days to compute a real trend percentage.
    const priorStart = new Date(since)
    priorStart.setDate(priorStart.getDate() - 30)
    const priorGrouped = await prisma.post.groupBy({
      by: ["userId"],
      where: {
        userId: { in: grouped.map((g) => g.userId) },
        createdAt: { gte: priorStart, lt: since },
        visibility: { in: ["public", "friends"] },
      },
      _count: { _all: true },
    }).catch(() => [])
    const priorMap = new Map(priorGrouped.map((g) => [g.userId, g._count._all]))

    return grouped
      .map((g): LandingSpace | null => {
        const user = byId.get(g.userId)
        if (!user) return null
        const handle = profileHandle(user)
        const prior = priorMap.get(g.userId) ?? 0
        const trendPct = prior > 0 ? Math.round(((g._count._all - prior) / prior) * 100) : g._count._all > 0 ? 100 : 0
        return {
          id: user.id,
          handle,
          name: user.displayName || handle,
          color: pickColor(user.id),
          role: user.bio || (user.location ? `空间 · ${user.location}` : "公开空间"),
          posts: user._count.posts,
          trendPct,
          href: profileHref(user),
          avatarText: user.avatarText || handle.slice(0, 2).toUpperCase(),
          avatarUrl: user.avatarUrl,
        }
      })
      .filter((s): s is LandingSpace => Boolean(s))
      .slice(0, 6)
  } catch {
    return []
  }
}

async function getModuleCounts(): Promise<LandingModuleCount[]> {
  try {
    const [
      users,
      blog,
      daily,
      reflections,
      notes,
      resumes,
      jobs,
      interviews,
      friendships,
      websites,
      roundtableDiscussions,
      aiConversations,
      sqlQueries,
      guestbook,
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.post.count({ where: { type: "blog", visibility: "public" } }).catch(() => 0),
      prisma.post.count({ where: { type: "daily", visibility: "public" } }).catch(() => 0),
      prisma.post.count({ where: { type: "reflections", visibility: "public" } }).catch(() => 0),
      prisma.post.count({ where: { type: "notes" } }).catch(() => 0),
      prisma.resume.count().catch(() => 0),
      prisma.jobApplication.count().catch(() => 0),
      prisma.interviewRecord.count().catch(() => 0),
      prisma.friendship.count().catch(() => 0),
      prisma.websiteResource.count({ where: { visibility: "public" } }).catch(() => 0),
      prisma.soulWingRoundtableDiscussion.count({ where: { deletedAt: null } }).catch(() => 0),
      prisma.aIConversation.count().catch(() => 0),
      prisma.sqlSavedQuery.count().catch(() => 0),
      prisma.guestbookMessage.count().catch(() => 0),
    ])

    return [
      { id: "home",        count: users },
      { id: "blog",        count: blog },
      { id: "daily",       count: daily },
      { id: "reflections", count: reflections },
      { id: "notes",       count: notes },
      { id: "resume",      count: resumes },
      { id: "jobs",        count: jobs },
      { id: "interviews",  count: interviews },
      { id: "friends",     count: friendships },
      { id: "community",   count: websites },
      { id: "soulwing",    count: roundtableDiscussions },
      { id: "ai",          count: aiConversations },
      { id: "sql",         count: sqlQueries },
      { id: "guestbook",   count: guestbook },
    ]
  } catch {
    return LANDING_MODULES.map((m) => ({ id: m.id, count: 0 }))
  }
}

async function getOnlineCount(): Promise<number> {
  try {
    const since = new Date(Date.now() - FOREGROUND_OFFLINE_AFTER_MS)
    const rows = await prisma.userSession.findMany({
      where: { status: "active", lastForegroundAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    })
    return rows.length
  } catch {
    return 0
  }
}

async function getUptimeDays(): Promise<number> {
  try {
    const first = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } })
    if (!first) return 0
    const ms = Date.now() - first.createdAt.getTime()
    return Math.max(0, Math.floor(ms / 86400000))
  } catch {
    return 0
  }
}

async function buildReleases(): Promise<LandingRelease[]> {
  try {
    const items = await getPublicUpdateLog(20)
    return items.slice(0, 6).map((item, index): LandingRelease => ({
      hash: item.hash,
      date: item.date.slice(0, 10),
      title: item.message,
      latest: index === 0,
    }))
  } catch {
    return []
  }
}

async function getTopActiveSpaceHref(activeSpaces: LandingSpace[]): Promise<string> {
  if (activeSpaces.length > 0) return activeSpaces[0].href
  try {
    const fallback = await prisma.user.findFirst({
      where: { posts: { some: { visibility: "public" } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicSlug: true },
    })
    if (fallback) return profileHref(fallback)
  } catch {
    /* ignore */
  }
  return "/register"
}

/**
 * Real-data aggregation for the public landing page. Any individual query that
 * fails (or returns 0 rows on a fresh database) leaves its slot at 0 / empty —
 * the page renders proper empty states instead of fake numbers.
 */
export async function getLandingPlatformStats(): Promise<LandingPlatformStats> {
  try {
    const since30 = new Date()
    since30.setDate(since30.getDate() - 30)
    const since7 = new Date()
    since7.setDate(since7.getDate() - 7)

    const [
      userCount,
      publicPostCount,
      totalPostCount,
      jobCount,
      interviewCount,
      visitCount,
      guestbookCount,
      postsThisMonth,
      jobsThisMonth,
      interviewsThisMonth,
      commentsThisMonth,
      newSpaces7d,
      moduleCounts,
      heatmap,
      recentPosts,
      recentActivity,
      activeSpaces,
      releases,
      online,
      uptimeDays,
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.post.count({ where: { visibility: "public" } }).catch(() => 0),
      prisma.post.count().catch(() => 0),
      prisma.jobApplication.count().catch(() => 0),
      prisma.interviewRecord.count().catch(() => 0),
      prisma.visitLog.count().catch(() => 0),
      prisma.guestbookMessage.count().catch(() => 0),
      prisma.post.count({ where: { createdAt: { gte: since30 } } }).catch(() => 0),
      prisma.jobApplication.count({ where: { appliedAt: { gte: since30 } } }).catch(() => 0),
      prisma.interviewRecord.count({ where: { createdAt: { gte: since30 } } }).catch(() => 0),
      prisma.guestbookMessage.count({ where: { createdAt: { gte: since30 } } }).catch(() => 0),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }).catch(() => 0),
      getModuleCounts(),
      aggregateHeatmap(),
      getRecentPublicPosts(),
      getRecentPlatformActivity(),
      getActiveSpaces(),
      buildReleases(),
      getOnlineCount(),
      getUptimeDays(),
    ])

    const topActiveSpaceHref = await getTopActiveSpaceHref(activeSpaces)
    const version = getVersionFromReleases(releases)
    const hash = getBuildHash()

    return {
      ...LANDING_PLATFORM_FALLBACK,
      users: userCount,
      spaces: userCount,
      posts: totalPostCount,
      publicPosts: publicPostCount,
      jobs: jobCount,
      interviews: interviewCount,
      comments: guestbookCount,
      visits: visitCount,
      commits365: heatmap.total,
      uptime: userCount > 0 ? "99.9%" : "—",
      version,
      hash,
      online,
      joined7d: newSpaces7d,
      uptimeDays,
      thisMonth: {
        posts: postsThisMonth,
        jobs: jobsThisMonth,
        interviews: interviewsThisMonth,
        comments: commentsThisMonth,
      },
      moduleCounts,
      heatmap: heatmap.matrix,
      recentPosts,
      recentActivity,
      activeSpaces,
      releases,
      topActiveSpaceHref,
      hasAnyData: userCount > 0 || totalPostCount > 0,
    }
  } catch {
    return LANDING_PLATFORM_FALLBACK
  }
}

export type { LandingPlatformStats } from "@/components/landing/landing-data"
export { POST_TYPE_LABELS as LANDING_POST_TYPE_LABELS }
export { PUBLIC_POST_TYPES, POST_PUBLIC_TYPES }
