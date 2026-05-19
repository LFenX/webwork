// Static configuration for the public landing page.
// Real numbers / posts / activity / spaces / releases are fetched server-side
// via lib/landing-stats.ts and passed in as props — nothing here is fake data.

export type LandingModule = {
  id: string
  cn: string
  en: string
  desc: string
  access: "open" | "auth"
  color: string
  lang: string
  href: string
}

export const LANDING_MODULES: LandingModule[] = [
  { id: "home",        cn: "个人主页",    en: "HOME",        desc: "一处统御所有模块的入口仪表盘",            access: "open", color: "#6aa6ff", lang: "Dashboard", href: "/" },
  { id: "blog",        cn: "博客",        en: "BLOG",        desc: "长文 · 技术 · 读书 · 随笔",              access: "open", color: "#6aa6ff", lang: "长文",      href: "/blog" },
  { id: "daily",       cn: "日常",        en: "DAILY",       desc: "时间线式的轻量日记",                       access: "open", color: "#7ee787", lang: "日记",      href: "/daily" },
  { id: "reflections", cn: "心得",        en: "REFLECTIONS", desc: "复盘 · 年度总结 · 专题思考",              access: "open", color: "#f6c177", lang: "随笔",      href: "/reflections" },
  { id: "notes",       cn: "笔记",        en: "NOTES",       desc: "碎片素材、剪贴板、私人备忘",               access: "auth", color: "#fb923c", lang: "便签",      href: "/notes" },
  { id: "resume",      cn: "简历",        en: "RESUME",      desc: "多模板 · Markdown / JSON · 一键打印",      access: "open", color: "#e94560", lang: "简历",      href: "/resume" },
  { id: "jobs",        cn: "求职追踪",    en: "JOBS",        desc: "投递 · 回复 · 面试 · Offer 全流程看板",    access: "auth", color: "#4a85e0", lang: "求职",      href: "/jobs" },
  { id: "interviews",  cn: "面试记录",    en: "INTERVIEWS",  desc: "每轮提问 · 自评 · 复盘",                   access: "auth", color: "#58c25c", lang: "面试",      href: "/interviews" },
  { id: "friends",     cn: "好友 · 聊天", en: "FRIENDS",     desc: "私聊、群聊、好友圈动态",                   access: "auth", color: "#a78bfa", lang: "社交",      href: "/friends" },
  { id: "community",   cn: "社区资源",    en: "COMMUNITY",   desc: "网站收藏 · GIF 表情包社区",               access: "open", color: "#22d3ee", lang: "社区",      href: "/community/resources" },
  { id: "soulwing",    cn: "蝶灵圆桌",    en: "ROUNDTABLE",  desc: "每天两场议题，多人异步讨论",                access: "auth", color: "#ec4899", lang: "讨论",      href: "/soulwing-roundtable" },
  { id: "ai",          cn: "AI 助手",     en: "AI",          desc: "私人对话 · 写作 / 简历润色",               access: "auth", color: "#a78bfa", lang: "AI",        href: "/ai" },
  { id: "sql",         cn: "SQL 实验室",  en: "SQL LAB",     desc: "在线 SQL 练习 + 小型数据探索",            access: "auth", color: "#22d3ee", lang: "SQL",       href: "/sql" },
  { id: "guestbook",   cn: "留言板",      en: "GUESTBOOK",   desc: "访客留言、表情包、回复线程",               access: "open", color: "#f6c177", lang: "留言",      href: "/community" },
]

export type LandingPost = {
  id: string
  type: string
  typeLabel: string
  title: string
  slug: string
  date: string
  summary: string
  author: { handle: string; name: string; color: string }
  href: string
  authorHref: string
}

export type LandingActivityKind =
  | "publish"
  | "job"
  | "interview"
  | "daily"
  | "guestbook"
  | "join"
  | "comment"
  | "resume"
  | "roundtable"

export type LandingActivity = {
  id: string
  who: string
  whoHref: string
  color: string
  action: LandingActivityKind
  tag: string
  target: string
  href: string
  time: string
}

export const LANDING_ACTION_LABELS: Record<LandingActivityKind, string> = {
  publish:    "发布了",
  job:        "记录了投递",
  interview:  "新增了一轮面试",
  daily:      "写了日常",
  guestbook:  "留下了一条留言",
  join:       "加入了平台",
  comment:    "在评论",
  resume:     "更新了简历",
  roundtable: "参加了圆桌",
}

export type LandingSpace = {
  id: string
  handle: string
  name: string
  color: string
  role: string
  posts: number
  trendPct: number
  href: string
  avatarText: string
  avatarUrl: string | null
}

export type LandingRelease = {
  hash: string
  date: string
  title: string
  latest?: boolean
}

export type LandingModuleCount = {
  id: string
  count: number
}

export type LandingPlatformStats = {
  users: number
  spaces: number
  posts: number
  publicPosts: number
  jobs: number
  interviews: number
  comments: number
  visits: number
  commits365: number
  uptime: string
  version: string
  hash: string
  online: number
  joined7d: number
  uptimeDays: number
  thisMonth: { posts: number; jobs: number; interviews: number; comments: number }
  moduleCounts: LandingModuleCount[]
  heatmap: number[][]
  recentPosts: LandingPost[]
  recentActivity: LandingActivity[]
  activeSpaces: LandingSpace[]
  releases: LandingRelease[]
  topActiveSpaceHref: string
  hasAnyData: boolean
}

export const LANDING_PLATFORM_FALLBACK: LandingPlatformStats = {
  users: 0,
  spaces: 0,
  posts: 0,
  publicPosts: 0,
  jobs: 0,
  interviews: 0,
  comments: 0,
  visits: 0,
  commits365: 0,
  uptime: "—",
  version: "v0.0.0",
  hash: "—",
  online: 0,
  joined7d: 0,
  uptimeDays: 0,
  thisMonth: { posts: 0, jobs: 0, interviews: 0, comments: 0 },
  moduleCounts: [],
  heatmap: [],
  recentPosts: [],
  recentActivity: [],
  activeSpaces: [],
  releases: [],
  topActiveSpaceHref: "/register",
  hasAnyData: false,
}
