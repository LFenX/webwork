import Link from "next/link"
import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Check,
  Database,
  Eye,
  FileText,
  Filter,
  Flame,
  Folder,
  Inbox,
  Lightbulb,
  MessageCircle,
  PenLine,
  Pin,
  Share2,
  Sparkles,
  StickyNote,
  Tag,
  Users,
  Video,
} from "lucide-react"
import styles from "./landing.module.css"
import { ActivityHeatmap, HeatLegendCells } from "./landing-heatmap"
import {
  LANDING_ACTION_LABELS,
  LANDING_MODULES,
  type LandingActivity,
  type LandingModule,
  type LandingPlatformStats,
} from "./landing-data"

const MODULE_ICONS: Record<string, typeof Folder> = {
  home: Folder,
  blog: PenLine,
  daily: CalendarDays,
  reflections: Lightbulb,
  notes: StickyNote,
  resume: FileText,
  jobs: BriefcaseBusiness,
  interviews: Video,
  friends: Users,
  community: Share2,
  soulwing: MessageCircle,
  ai: Sparkles,
  sql: Database,
  guestbook: MessageCircle,
}

const ACTION_ICONS: Record<LandingActivity["action"], typeof PenLine> = {
  publish: PenLine,
  job: BriefcaseBusiness,
  interview: Video,
  daily: CalendarDays,
  guestbook: MessageCircle,
  join: Users,
  comment: MessageCircle,
  resume: FileText,
  roundtable: Users,
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return "刚刚"
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} 秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  const mo = Math.floor(d / 30)
  return `${mo} 个月前`
}

export function LandingMain({ platform }: { platform: LandingPlatformStats }) {
  return (
    <main className={styles.main}>
      <IntroCard />
      <HomeNavGrid platform={platform} />
    </main>
  )
}

function HomeNavGrid({ platform }: { platform: LandingPlatformStats }) {
  const features = platform.moduleCounts.reduce((sum, m) => sum + m.count, 0)
  const cards = [
    {
      key: "features",
      title: "十四个模块",
      desc: "一个空间统一承载写作、求职、面试、社交、AI 与 SQL，逐项可见性。",
      meta: features > 0 ? `${features.toLocaleString()} 条真实数据` : "等你加入第一条",
      href: "/welcome/features",
      icon: Pin,
      tone: "#6aa6ff",
    },
    {
      key: "preview",
      title: "登录后你会看到",
      desc: "实景预览：Hero 卡 · 指标 · 文章 · 求职漏斗 · 写作热度 · 访客曲线。",
      meta: platform.activeSpaces[0] ? `示例 @${platform.activeSpaces[0].handle}` : "等你成为第一位",
      href: "/welcome/preview",
      icon: Eye,
      tone: "#7ee787",
    },
    {
      key: "activity",
      title: "平台活跃度",
      desc: "53 周写入热力图 · 站内动态 · 最近公开文章。",
      meta: platform.commits365 > 0 ? `${platform.commits365.toLocaleString()} 次写入 · 365d` : "等待第一次写入",
      href: "/welcome/activity",
      icon: Activity,
      tone: "#f6c177",
    },
    {
      key: "spaces",
      title: "公开空间",
      desc: "本月活跃空间 + 推荐用户。可点入对方主页查看完整内容。",
      meta: platform.activeSpaces.length > 0 ? `${platform.activeSpaces.length} 个活跃空间` : "等你创建第一个",
      href: "/welcome/spaces",
      icon: Users,
      tone: "#a78bfa",
    },
    {
      key: "updates",
      title: "更新日志",
      desc: "每一次提交、每一次修复、每一个新功能，全部从 git 提交流出。",
      meta: platform.releases.length > 0 ? `${platform.releases.length} 次最近提交` : "等待第一次提交",
      href: "/updates",
      icon: Tag,
      tone: "#fb923c",
    },
    {
      key: "faq",
      title: "常见问题",
      desc: "数据可导出？逐模块可见性？AI 训练？六个高频问题在这里。",
      meta: "约 1 分钟读完",
      href: "/welcome/faq",
      icon: Lightbulb,
      tone: "#22d3ee",
    },
  ]
  return (
    <section className={styles.navGrid} aria-label="继续浏览">
      <div className={styles.sectionHead}>
        <h3>
          <Folder size={13} strokeWidth={1.6} />
          继续浏览
          <span className={styles.chip} style={{ fontSize: 10, padding: "0 6px" }}>真实路由</span>
        </h3>
        <span className={styles.mono} style={{ fontSize: 11.5, color: "var(--text-3)" }}>每张卡片都是独立页面</span>
      </div>
      <div className={styles.navGridInner}>
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link key={c.key} href={c.href} className={styles.navCard}>
              <div className={styles.navCardHead}>
                <span className={styles.moduleIcon} style={{ color: c.tone, background: `color-mix(in oklab, ${c.tone} 14%, transparent)` }}>
                  <Icon size={13} strokeWidth={1.6} />
                </span>
                <span className={styles.navCardTitle}>{c.title}</span>
                <span className={`${styles.mono} ${styles.navCardArrow}`}>→</span>
              </div>
              <p className={styles.navCardDesc}>{c.desc}</p>
              <span className={`${styles.kicker} ${styles.navCardMeta}`}>{c.meta}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function IntroCard() {
  const bullets = [
    "公开主页可分享：/u/handle 自定义短链，访客可留言、统计访问数",
    "求职闭环：投递 → 已回复 → 进入面试 → Offer，看漏斗看自己的转化率",
    "面试记录：每轮提问、自评 1–5 星、复盘，下次复习不靠记忆",
    "蝶灵圆桌：每天早晚两场议题，多人异步讨论，凉了再来",
    "AI 助手只对你说话：写作辅助、简历润色、不训练你的数据",
    "数据全部可导出：Markdown + JSON，跟我无关也带走",
  ]
  const moduleLinks = LANDING_MODULES
    .filter((m) => m.id !== "home")
    .map((m) => ({ label: m.cn, href: m.href }))
  return (
    <section className={styles.cardGh} id="features-intro">
      <CardChrome
        icon={<FileText size={14} strokeWidth={1.6} />}
        title="平台介绍"
        right={
          <span className={styles.mono} style={{ color: "var(--text-3)", fontSize: 11.5 }}>
            README.md · 中文 / EN · 阅读约 2 分钟
          </span>
        }
      />
      <div style={{ padding: "26px 30px 28px" }}>
        <h2 className={styles.serif} style={{ fontSize: 36, color: "var(--text)", marginBottom: 8, letterSpacing: "-0.015em", lineHeight: 1.15 }}>
          一处<span style={{ color: "var(--accent)" }}>属于你</span>的个人空间。
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 16, fontFamily: "var(--f-cn-serif)" }}>
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>my-space</strong>
          {" "}是一个多用户写作 + 求职 + 社交平台。每个用户登录后会得到一整套模块——
          {moduleLinks.map((m, i) => (
            <span key={m.href}>
              <Link href={m.href} className={styles.link}>{m.label}</Link>
              {i < moduleLinks.length - 1 ? "、" : "。"}
            </span>
          ))}
          <br />
          <span style={{ color: "var(--text-3)" }}>哪些公开、哪些只给好友看、哪些彻底私人——逐模块由你决定。</span>
        </p>

        <blockquote className={styles.quote}>
          “把事情写下来。回头看。注意到自己这一年的形状。”
          <span style={{ display: "block", fontSize: 12, color: "var(--text-3)", marginTop: 4, fontStyle: "normal", fontFamily: "var(--f-cn-serif)" }}>
            —— 这个平台唯一的规矩
          </span>
        </blockquote>

        <div className={styles.cliBlock}>
          <span style={{ color: "var(--text-3)" }}>→</span>
          <span style={{ color: "var(--text)" }}>
            访问 <span style={{ color: "var(--green)" }}>{"/u/<你的 handle>"}</span>
          </span>
          <span style={{ color: "var(--text-3)" }}># 注册即生成你的公开空间 URL，可一键分享</span>
          <span style={{ flex: 1 }} />
        </div>

        <h3 style={{ marginTop: 22, fontSize: 16, color: "var(--text)", fontWeight: 600 }}>
          为什么用 my-space
        </h3>
        <ul className={styles.checkList}>
          {bullets.map((t) => (
            <li key={t} className={styles.checkItem}>
              <span className={styles.checkBox}>
                <Check size={10} strokeWidth={3} />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <hr style={{ margin: "20px 0", border: 0, borderTop: "1px solid var(--line-2)" }} />
        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
          继续阅读：<Link href="/welcome/preview" className={styles.link}>登录后你会看到什么</Link>
          {" · "}
          <Link href="/welcome/spaces" className={styles.link}>浏览公开空间</Link>
          {" · "}
          <Link href="/updates" className={styles.link}>更新内容</Link>
          {" · "}
          <Link href="/welcome/faq" className={styles.link}>常见问题</Link>
        </p>
      </div>
    </section>
  )
}

export function FeaturesShowcase({ platform, expanded = false }: { platform: LandingPlatformStats; expanded?: boolean }) {
  const countMap = new Map(platform.moduleCounts.map((m) => [m.id, m.count]))
  const modules = expanded ? LANDING_MODULES : LANDING_MODULES.slice(0, 9)
  return (
    <section id="features">
      <div className={styles.sectionHead}>
        <h3>
          <Pin size={13} strokeWidth={1.6} />
          十四个模块 · 一个空间
          <span className={styles.chip} style={{ fontSize: 10, padding: "0 6px" }}>实际功能</span>
        </h3>
        <Link href="/settings/privacy" style={{ fontSize: 12, color: "var(--accent)" }}>逐项可见性控制 →</Link>
      </div>
      <div className={styles.featureGrid}>
        {modules.map((m) => (
          <FeatureCard key={m.id} m={m} count={countMap.get(m.id) ?? 0} />
        ))}
      </div>
      {!expanded && LANDING_MODULES.length > modules.length ? (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <Link href="/welcome/features" className={styles.link} style={{ fontSize: 13 }}>
            查看全部 {LANDING_MODULES.length} 个模块 →
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function FeatureCard({ m, count }: { m: LandingModule; count: number }) {
  const Icon = MODULE_ICONS[m.id] ?? Folder
  return (
    <Link href={m.href} className={styles.featureCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className={styles.moduleIcon} style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 14%, transparent)` }}>
          <Icon size={13} strokeWidth={1.6} />
        </span>
        <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13.5 }}>{m.cn}</span>
        <span className={`${styles.chip} ${m.access === "open" ? styles.chipOpen : styles.chipAuth}`} style={{ marginLeft: "auto", fontSize: 9.5, padding: "1px 6px" }}>
          {m.access === "open" ? "公开可见" : "仅登录"}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, minHeight: 36 }}>{m.desc}</p>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: m.color, borderRadius: "50%" }} />
          {m.lang}
        </span>
        <span className={styles.mono}>
          {count > 0 ? `${formatCount(count)} 条` : "暂无数据"}
        </span>
      </div>
    </Link>
  )
}

export function PersonalHomePreview({ platform }: { platform: LandingPlatformStats }) {
  const flagship = platform.activeSpaces[0]
  const sampleVisits = Math.min(platform.visits, 999_999)

  return (
    <section id="preview">
      <div className={styles.sectionHead}>
        <h3>
          <Eye size={13} strokeWidth={1.6} />
          登录后你会看到
          <span className={`${styles.chip} ${styles.chipOpen}`} style={{ fontSize: 10, padding: "0 6px" }}>实景</span>
        </h3>
        <span className={styles.mono} style={{ fontSize: 12, color: "var(--text-3)" }}>
          {flagship ? `示例：${flagship.href}` : "/u/<你> · 主页布局"}
        </span>
      </div>
      <div className={styles.cardGh} style={{ padding: 18, background: "var(--bg-deep)" }}>
        <PersonalHomeMockup
          platform={platform}
          flagship={flagship ?? null}
          totalVisits={sampleVisits}
          recentPostsForMockup={platform.recentPosts.slice(0, 3)}
        />
      </div>
    </section>
  )
}

function PersonalHomeMockup({
  platform,
  flagship,
  totalVisits,
  recentPostsForMockup,
}: {
  platform: LandingPlatformStats
  flagship: LandingPlatformStats["activeSpaces"][number] | null
  totalVisits: number
  recentPostsForMockup: LandingPlatformStats["recentPosts"]
}) {
  const profileHandle = flagship?.handle ?? "you"
  const profileColor = flagship?.color ?? "#6aa6ff"
  const profileAvatar = (flagship?.avatarText || profileHandle).slice(0, 2).toUpperCase()
  const profileHref = flagship?.href ?? "/register"
  const role = flagship?.role || "你的个人空间"
  const blogCount = platform.moduleCounts.find((m) => m.id === "blog")?.count ?? 0
  const dailyCount = platform.moduleCounts.find((m) => m.id === "daily")?.count ?? 0
  const jobsCount = platform.moduleCounts.find((m) => m.id === "jobs")?.count ?? 0
  const guestbookCount = platform.moduleCounts.find((m) => m.id === "guestbook")?.count ?? 0
  const friendsCount = platform.moduleCounts.find((m) => m.id === "friends")?.count ?? 0

  const stats = [
    { k: "文章",   v: formatCount(blogCount),     u: "篇" },
    { k: "日常",   v: formatCount(dailyCount),    u: "条" },
    { k: "求职",   v: formatCount(jobsCount),     u: "项" },
    { k: "访客",   v: formatCount(totalVisits),   u: "次" },
    { k: "互动",   v: formatCount(friendsCount),  u: "条" },
    { k: "留言",   v: formatCount(guestbookCount), u: "条" },
  ]
  const funnelTotal = Math.max(1, jobsCount)
  const funnel = [
    { l: "投递",     v: jobsCount,                        w: 100,  c: "#6aa6ff" },
    { l: "已回复",   v: Math.round(jobsCount * 0.47),     w: 47,   c: "#7ee787" },
    { l: "进入面试", v: Math.round(jobsCount * 0.22),     w: 22,   c: "#f6c177" },
    { l: "Offer",   v: Math.max(1, Math.round(jobsCount * 0.04)), w: jobsCount === 0 ? 0 : 3.5, c: "#e94560" },
  ]
  // When platform has no real job data, show the funnel as a "you'll see your own pipeline" preview.
  const funnelEmpty = jobsCount === 0
  return (
    <div className={styles.mockup}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={styles.mockupSurface} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
          <span style={{ width: 56, height: 56, borderRadius: "50%", background: profileColor, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-deep)", fontWeight: 700, fontFamily: "var(--f-mono)", fontSize: 18 }}>
            {profileAvatar}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600 }}>@{profileHandle}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
              {role} {platform.uptimeDays > 0 ? `· 加入 ${platform.uptimeDays} 天` : "· 等你加入"}
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, padding: "2px 7px", background: "var(--blue)", color: "var(--bg-deep)", borderRadius: 4 }}>编辑资料</span>
              <span style={{ fontSize: 10.5, padding: "2px 7px", border: "1px solid var(--line-2)", color: "var(--text-2)", borderRadius: 4 }}>写文章</span>
              <span style={{ fontSize: 10.5, padding: "2px 7px", border: "1px solid var(--line-2)", color: "var(--text-2)", borderRadius: 4 }}>分享主页</span>
            </div>
          </div>
          <Link href={profileHref} className={styles.mono} style={{ fontSize: 10, color: "var(--text-3)" }}>{profileHref}</Link>
        </div>

        <div className={styles.mockupSurface} style={{ padding: 0, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", overflow: "hidden" }}>
          {stats.map((s, i) => (
            <div key={s.k} style={{ padding: "10px 12px", borderRight: i < 5 ? "1px solid var(--line)" : "none" }}>
              <div style={{ fontSize: 9.5, color: "var(--text-3)", marginBottom: 2 }}>{s.k}</div>
              <div className={styles.mono} style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                {s.v}<span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 400, marginLeft: 2 }}>{s.u}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className={styles.mockupSurface}>
            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <BookOpen size={11} strokeWidth={1.6} /> 最新文章
              </span>
              <Link href="/blog" style={{ fontSize: 10.5, color: "var(--accent)" }}>更多 →</Link>
            </div>
            {recentPostsForMockup.length > 0 ? (
              recentPostsForMockup.map((p, i) => (
                <Link key={p.id} href={p.href} style={{ display: "block", padding: "5px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none", textDecoration: "none" }}>
                  <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1 }}>{p.title}</div>
                  <div className={styles.mono} style={{ fontSize: 9, color: "var(--text-3)", marginTop: 1 }}>
                    {p.date} · {p.typeLabel}
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-3)" }}>暂无公开文章，等你写下第一篇。</div>
            )}
          </div>

          <div className={styles.mockupSurface}>
            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Filter size={11} strokeWidth={1.6} /> 求职漏斗
            </div>
            {funnelEmpty ? (
              <div style={{ padding: "12px 0", fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
                投递 · 已回复 · 进入面试 · Offer。<br />
                登录后这里会绘制你自己的转化曲线。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {funnel.map((f) => (
                  <div key={f.l} style={{ fontSize: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-2)" }}>
                      <span>{f.l}</span>
                      <span className={styles.mono}>{f.v}</span>
                    </div>
                    <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(2, (f.v / funnelTotal) * 100)}%`, height: "100%", background: f.c, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={styles.mockupSurface}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em" }}>写作统计</div>
          <div className={styles.mono} style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
            {formatCount(platform.commits365)} <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>次写入 · 365d</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
            本月 <span style={{ color: "var(--text-2)" }}>{platform.thisMonth.posts}</span> 篇 · 公开 <span style={{ color: "var(--text-2)" }}>{formatCount(platform.publicPosts)}</span> 篇
          </div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 2 }}>
            {platform.heatmap.slice(-14).flatMap((col) => col).slice(0, 28).map((v, i) => (
              <span
                key={i}
                style={{
                  aspectRatio: "1/1",
                  background: v === 0 ? "var(--surface-2)" : "var(--accent)",
                  opacity: v === 0 ? 1 : 0.3 + Math.min(4, v) * 0.18,
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        </div>

        <div className={styles.mockupSurface}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em" }}>访客概览 · 累计</div>
          <div className={styles.mono} style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>
            {formatCount(totalVisits)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>
            7 天新增空间 {platform.joined7d} · 当前在线 {platform.online}
          </div>
          <svg width="100%" height="32" viewBox="0 0 200 32" style={{ marginTop: 6 }}>
            <polyline
              points={platform.heatmap.slice(-15).map((col, i) => {
                const sum = col.reduce((s, v) => s + v, 0)
                const max = Math.max(1, ...platform.heatmap.slice(-15).map((c) => c.reduce((s, v) => s + v, 0)))
                const y = 30 - (sum / max) * 26
                return `${(i / 14) * 200},${y}`
              }).join(" ")}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.2"
            />
          </svg>
        </div>

        <div className={styles.mockupSurface}>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.05em", marginBottom: 6 }}>最近留言</div>
          {platform.recentActivity.filter((a) => a.action === "guestbook").slice(0, 3).length > 0 ? (
            platform.recentActivity.filter((a) => a.action === "guestbook").slice(0, 3).map((a, i) => (
              <Link key={a.id} href={a.href} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none", textDecoration: "none" }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: a.color, opacity: 0.7, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: "var(--text-2)" }}>@{a.who}</span>
                <span className={styles.mono} style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--text-4)" }}>{relativeTime(a.time)}</span>
              </Link>
            ))
          ) : (
            <div style={{ fontSize: 10.5, color: "var(--text-3)", padding: "4px 0" }}>留言会出现在这里。</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ContributionCard({ platform }: { platform: LandingPlatformStats }) {
  const stats = [
    { l: "公开文章", n: platform.publicPosts, sub: platform.thisMonth.posts > 0 ? `+${platform.thisMonth.posts} 本月` : "等你写下第一篇" },
    { l: "求职记录", n: platform.jobs,        sub: platform.thisMonth.jobs > 0 ? `+${platform.thisMonth.jobs} 本月` : "登录后追踪你的投递" },
    { l: "面试记录", n: platform.interviews,  sub: platform.thisMonth.interviews > 0 ? `+${platform.thisMonth.interviews} 本月` : "复盘从一次面试开始" },
    { l: "留言互动", n: platform.comments,    sub: platform.thisMonth.comments > 0 ? `+${platform.thisMonth.comments} 本月` : "欢迎在公开主页留言" },
  ]
  return (
    <section className={styles.cardGh} id="contribution">
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--line-2)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          <span style={{ color: "var(--text)" }}>{platform.commits365.toLocaleString()}</span>
          <span style={{ color: "var(--text-2)", fontWeight: 400 }}>
            {" "}次写入，来自 {platform.users.toLocaleString()} 个空间的过去一年
          </span>
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <span className={styles.ghButton}>过去一年 <ChevronDown size={10} strokeWidth={1.8} /></span>
          <span className={styles.ghButton}>全部模块 <ChevronDown size={10} strokeWidth={1.8} /></span>
        </div>
      </div>
      <div style={{ padding: "16px 20px 18px" }}>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <ActivityHeatmap matrix={platform.heatmap} weeks={53} cell={13} gap={3} />
        </div>
        <div className={styles.heatLegend}>
          <span>包含：博客 · 日常 · 心得 · 求职 · 面试 · 留言 · 圆桌</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>少</span>
            <HeatLegendCells />
            <span>多</span>
          </div>
        </div>

        <div className={styles.statsRow}>
          {stats.map((s) => (
            <div key={s.l} className={styles.statsCell}>
              <div className={styles.kicker} style={{ fontSize: 10, marginBottom: 4 }}>{s.l}</div>
              <div className={styles.bigNum}>{s.n > 0 ? s.n.toLocaleString() : "—"}</div>
              <div style={{ fontSize: 11, color: s.n > 0 ? "var(--green)" : "var(--text-3)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function RecentRow({ platform }: { platform: LandingPlatformStats }) {
  return (
    <div id="community" className={styles.doubleRow}>
      <ActivityFeedCard items={platform.recentActivity} />
      <LatestWritingCard posts={platform.recentPosts} />
    </div>
  )
}

export function ActivityFeedCard({ items, limit = 8 }: { items: LandingActivity[]; limit?: number }) {
  return (
    <section className={styles.cardGh}>
      <CardChrome
        icon={<Activity size={14} strokeWidth={1.6} />}
        title="站内动态"
        right={
          <>
            <span className={styles.chip} style={{ fontSize: 9.5, padding: "0 6px" }}>
              <span className={styles.liveDot} />
              实时
            </span>
            <span className={styles.ghButton}>
              全部模块 <ChevronDown size={10} strokeWidth={1.8} />
            </span>
          </>
        }
      />
      <div style={{ padding: "4px 0" }}>
        {items.length > 0 ? (
          items.slice(0, limit).map((a) => {
            const Icon = ACTION_ICONS[a.action] ?? Activity
            return (
              <Link key={a.id} href={a.href} className={styles.activityItem} style={{ textDecoration: "none" }}>
                <span className={styles.activityAvatar} style={{ background: a.color }}>
                  {a.who.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--text-2)", lineHeight: 1.35 }}>
                    <span style={{ color: "var(--accent)", fontWeight: 500 }}>@{a.who}</span>
                    <span style={{ color: "var(--text-3)" }}> {LANDING_ACTION_LABELS[a.action]} </span>
                    <span style={{ color: "var(--text)", fontSize: 12.5 }}>{a.target}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--text-3)", display: "flex", gap: 8 }}>
                    <span className={styles.mono}>{relativeTime(a.time)}</span>
                    <span className={styles.chip} style={{ padding: "0 5px", fontSize: 9 }}>{a.tag}</span>
                  </div>
                </div>
                <Icon size={14} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
              </Link>
            )
          })
        ) : (
          <EmptyRow icon={Inbox} label="暂时没有平台动态。新用户发布后会出现在这里。" />
        )}
      </div>
    </section>
  )
}

export function LatestWritingCard({ posts, limit = 5 }: { posts: LandingPlatformStats["recentPosts"]; limit?: number }) {
  return (
    <section className={styles.cardGh}>
      <CardChrome
        icon={<BookOpen size={14} strokeWidth={1.6} />}
        title="最近公开文章"
        right={
          <>
            <Link href="/blog" className={styles.link} style={{ fontSize: 12, marginRight: 12 }}>归档 →</Link>
          </>
        }
      />
      <div>
        {posts.length > 0 ? (
          posts.slice(0, limit).map((p, i) => {
            const dot = p.author.color
            return (
              <Link key={p.id} href={p.href} className={styles.writingItem}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0, transform: "translateY(2px)" }} />
                  <span style={{ color: "var(--accent)", fontSize: 12.5, fontWeight: 500 }}>@{p.author.handle}</span>
                  <span style={{ color: "var(--text-3)", fontSize: 12 }}>·</span>
                  <span className={styles.mono} style={{ color: "var(--text-3)", fontSize: 11.5 }}>{p.date.slice(5)}</span>
                  <span className={styles.mono} style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {p.typeLabel}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500, lineHeight: 1.4, paddingLeft: 22 }}>{p.title}</div>
                {i < limit ? (
                  <div className={styles.kicker} style={{ marginTop: 4, fontSize: 9.5, color: "var(--text-3)", paddingLeft: 22 }}>
                    {p.summary}
                  </div>
                ) : null}
              </Link>
            )
          })
        ) : (
          <EmptyRow icon={Inbox} label="暂无公开文章。" cta={{ label: "成为第一个写作的人 →", href: "/register" }} />
        )}
      </div>
    </section>
  )
}

export function ChangelogAndSpacesRow({ platform }: { platform: LandingPlatformStats }) {
  return (
    <div id="changelog" className={styles.doubleRow}>
      <ChangelogCard releases={platform.releases} />
      <ActiveSpacesCard spaces={platform.activeSpaces} />
    </div>
  )
}

export function ChangelogCard({ releases }: { releases: LandingPlatformStats["releases"] }) {
  return (
    <section className={styles.cardGh}>
      <CardChrome
        icon={<Tag size={14} strokeWidth={1.6} />}
        title={
          <>
            更新日志{releases.length > 0 ? <span className={styles.chip} style={{ fontSize: 10, padding: "0 6px", marginLeft: 4 }}>{releases.length} 次提交</span> : null}
          </>
        }
        right={<Link href="/updates" className={styles.link} style={{ fontSize: 12 }}>全部 →</Link>}
      />
      <div>
        {releases.length > 0 ? (
          releases.map((r) => (
            <div key={r.hash} className={styles.releaseItem}>
              <span className={styles.mono} style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Tag size={12} strokeWidth={1.6} />
                {r.hash.slice(0, 7)}
                {r.latest && (
                  <span className={`${styles.chip} ${styles.chipLatest}`} style={{ fontSize: 9, padding: "0 5px" }}>
                    最新
                  </span>
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div className={styles.kicker} style={{ fontSize: 9.5, marginTop: 2 }}>{r.date}</div>
              </div>
              <Link href="/updates" className={`${styles.link} ${styles.mono}`} style={{ fontSize: 11 }}>详情 →</Link>
            </div>
          ))
        ) : (
          <EmptyRow icon={Tag} label="更新日志从 git 提交生成，等待第一次提交。" />
        )}
      </div>
    </section>
  )
}

export function ActiveSpacesCard({ spaces, limit = 4 }: { spaces: LandingPlatformStats["activeSpaces"]; limit?: number }) {
  return (
    <section className={styles.cardGh}>
      <CardChrome
        icon={<Flame size={14} strokeWidth={1.6} />}
        title="本月活跃空间"
        right={<span className={styles.ghButton}>近 30 天 <ChevronDown size={10} strokeWidth={1.8} /></span>}
      />
      <div>
        {spaces.length > 0 ? (
          spaces.slice(0, limit).map((s) => (
            <div key={s.id} className={styles.spaceCardRow}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: s.color, opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-deep)", fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                {(s.avatarText || s.handle).slice(0, 2).toUpperCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  <Link href={s.href} style={{ color: "var(--accent)", fontWeight: 500 }}>@{s.handle}</Link>
                  <span style={{ color: "var(--text-3)", marginLeft: 8, fontSize: 12 }}>{s.role}</span>
                </div>
                <div className={styles.kicker} style={{ fontSize: 9.5, marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {s.posts} 篇公开文章{s.trendPct !== 0 ? <> · 近 30 天 {s.trendPct > 0 ? "+" : ""}{s.trendPct}%</> : null}
                </div>
              </div>
              {s.trendPct > 0 ? (
                <span className={styles.mono} style={{ fontSize: 11, color: "var(--green)", padding: "2px 7px", border: "1px solid color-mix(in oklab, var(--green) 30%, var(--line-2))", borderRadius: 999 }}>
                  ↑ {s.trendPct}%
                </span>
              ) : (
                <span />
              )}
              <Link href={s.href} className={`${styles.btn} ${styles.btnXs}`}>
                <Eye size={10} strokeWidth={1.6} /> 看看
              </Link>
            </div>
          ))
        ) : (
          <EmptyRow icon={Users} label="暂无公开活跃空间。" cta={{ label: "创建你的空间 →", href: "/register" }} />
        )}
      </div>
    </section>
  )
}

export function FAQCard() {
  const faqs = [
    { q: "数据真的可以导出吗？", a: "可以。Markdown + JSON 全量打包下载，没有锁定。" },
    { q: "我能让某个模块只给好友看吗？", a: "可以。逐模块独立设置 public / friends / private，访客和好友看到不同视图。" },
    { q: "公开主页的 URL 能自定义吗？", a: "在设置 → 个人资料中设置 publicSlug，访问 /@yourname。未设置则用用户 ID。" },
    { q: "AI 助手会拿我的数据训练吗？", a: "不会。AI 调用仅在你的会话内，不入训练集。" },
    { q: "想自部署？", a: "支持。Next.js + Prisma + PostgreSQL，开源 MIT。" },
    { q: "蝶灵圆桌是什么？", a: "每天 8:00 / 22:00 自动开启一场议题，多用户异步发言，议题完结后仍可回看与追问。" },
  ]
  return (
    <section className={styles.cardGh} id="faq">
      <CardChrome icon={<Lightbulb size={14} strokeWidth={1.6} />} title="常见问题" />
      <div className={styles.faqGrid}>
        {faqs.map((f) => (
          <div key={f.q} className={styles.faqItem}>
            <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>{f.q}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55 }}>{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CardChrome({ icon, title, right }: { icon?: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <div className={styles.cardHeadTitle}>
        {icon}
        <span>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{right}</div>
    </div>
  )
}

function EmptyRow({ icon: Icon, label, cta }: { icon: typeof Inbox; label: string; cta?: { label: string; href: string } }) {
  return (
    <div className={styles.emptyRow}>
      <Icon size={26} strokeWidth={1.3} className={styles.emptyIcon} />
      <p>{label}</p>
      {cta ? (
        <Link href={cta.href} className={styles.link} style={{ fontSize: 12.5 }}>
          {cta.label}
        </Link>
      ) : null}
    </div>
  )
}
