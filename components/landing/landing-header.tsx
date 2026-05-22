import Link from "next/link"
import {
  Activity,
  Bell,
  BookOpen,
  Eye,
  Folder,
  Lightbulb,
  Pin,
  Search,
  Tag,
  User,
} from "lucide-react"
import styles from "./landing.module.css"
import { SpaceMark } from "./landing-mark"
import { LandingThemeToggle } from "./landing-theme"
import type { LandingPlatformStats } from "./landing-data"
import type { LandingActiveTab } from "./landing-shell"

const NAV: { label: string; href: string }[] = [
  { label: "功能",  href: "/welcome/features" },
  { label: "预览",  href: "/welcome/preview" },
  { label: "动态",  href: "/welcome/activity" },
  { label: "空间",  href: "/welcome/spaces" },
  { label: "更新",  href: "/updates" },
  { label: "FAQ",   href: "/welcome/faq" },
]

function fmt(n: number) {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

export function GlobalHeader({ platform }: { platform: LandingPlatformStats }) {
  return (
    <header className={styles.globalHeader} data-has-data={platform.hasAnyData ? "true" : "false"}>
      <div className={styles.globalHeaderInner}>
        <Link href="/" className={styles.headerBrand}>
          <SpaceMark size={26} />
          <span>my-space</span>
        </Link>

        <div className={styles.headerSearch}>
          <Search size={13} strokeWidth={1.6} />
          <span style={{ flex: 1 }}>搜索空间、文章、模块</span>
          <span className={styles.kbd}>⌘ K</span>
        </div>

        <div style={{ flex: 1 }} />

        <nav className={styles.headerNav}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>{n.label}</Link>
          ))}
        </nav>

        <span className={styles.divider} />

        <LandingThemeToggle className={styles.themeToggle} />

        <Link href="/login" style={{ fontSize: 13, color: "var(--text)", padding: "5px 12px", fontWeight: 500 }}>
          登录
        </Link>
        <Link href="/register" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.headerPrimaryCta}`}>
          创建你的空间
        </Link>
      </div>
    </header>
  )
}

const TAB_DEFS: Array<{ id: LandingActiveTab; label: string; icon?: typeof BookOpen; href: string; countKey?: (p: LandingPlatformStats) => string }> = [
  { id: "overview", label: "总览",     icon: BookOpen,      href: "/" },
  { id: "features", label: "功能",     icon: Pin,           href: "/welcome/features",  countKey: () => "14" },
  { id: "preview",  label: "预览",     icon: Eye,           href: "/welcome/preview" },
  { id: "spaces",   label: "空间",     icon: User,          href: "/welcome/spaces",    countKey: (p) => fmt(p.users) },
  { id: "activity", label: "动态",     icon: Activity,      href: "/welcome/activity",  countKey: (p) => fmt(p.commits365) },
  { id: "posts",    label: "公开文章", icon: BookOpen,      href: "/blog",              countKey: (p) => fmt(p.publicPosts) },
  { id: "updates",  label: "更新日志", icon: Tag,           href: "/updates",           countKey: (p) => `${p.releases.length}` },
  { id: "faq",      label: "FAQ",      icon: Lightbulb,     href: "/welcome/faq" },
]

export function ProjectHeaderStrip({ platform, activeTab = "none" }: { platform: LandingPlatformStats; activeTab?: LandingActiveTab }) {
  return (
    <div className={styles.projectStrip}>
      <div className={styles.projectStripInner}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.projectTitle}>
            <Folder size={16} strokeWidth={1.6} />
            <Link href="/" style={{ color: "var(--accent)" }}>my-space</Link>
            <span style={{ color: "var(--text-3)" }}>/</span>
            <span style={{ color: "var(--text)" }}>你的个人空间</span>
            <span className={`${styles.chip} ${styles.projectStateChip}`}>公开</span>
            <span className={`${styles.chip} ${styles.chipWarm} ${styles.projectInviteChip} landing-project-invite-chip`}>
              <Pin size={10} strokeWidth={1.8} /> 邀请制
            </span>
          </div>
          <p className={styles.projectSubtitle}>
            一处写作、求职、复盘、社交的个人空间。博客 · 日常 · 简历 · 求职追踪 · 面试记录 · 蝶灵圆桌 · AI 助手 · SQL 实验室。
            <span style={{ color: "var(--text-2)" }}>所有模块逐项可见性控制，数据可导出。</span>
          </p>
        </div>

        <div className={`${styles.projectActions} landing-project-actions`}>
          <GroupButton icon={<Eye size={13} strokeWidth={1.6} />} label="浏览公开空间" num={fmt(platform.users)} href="/welcome/spaces" />
          <GroupButton icon={<Bell size={13} strokeWidth={1.6} />} label="更新日志" num={`${platform.releases.length}`} href="/updates" />
          <GroupButton icon={<Activity size={13} strokeWidth={1.6} />} label="本月动态" num={fmt(platform.commits365)} href="/welcome/activity" />
        </div>
      </div>

      <div className={styles.projectTabs}>
        <nav className={styles.projectTabsNav}>
          {TAB_DEFS.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            const count = t.countKey ? t.countKey(platform) : ""
            return (
              <Link key={t.id} href={t.href} className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}>
                {Icon && <Icon size={14} strokeWidth={1.6} />}
                {t.label}
                {count && <span className={styles.chip} style={{ padding: "0 6px", fontSize: 10, color: "var(--text-3)" }}>{count}</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function GroupButton({ icon, label, num, href }: { icon: React.ReactNode; label: string; num: string; href: string }) {
  return (
    <Link href={href} className={styles.groupBtn}>
      <span className={styles.groupBtnMain}>
        {icon} {label}
      </span>
      <span className={styles.groupBtnNum}>{num}</span>
    </Link>
  )
}
