import Link from "next/link"
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Code2, Eye, Flame, LogIn, PenLine, Plus, Sparkles, Users } from "lucide-react"
import styles from "./landing.module.css"
import { BigSpaceMark } from "./landing-mark"
import { LANDING_MODULES, type LandingPlatformStats } from "./landing-data"

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

export function LandingSidebar({ platform }: { platform: LandingPlatformStats }) {
  const moduleMap = new Map(platform.moduleCounts.map((m) => [m.id, m.count]))
  const totalModuleEntries = platform.moduleCounts.reduce((s, m) => s + m.count, 0)
  const sidebarModules = LANDING_MODULES.slice(0, 8)
  const top = sidebarModules
    .map((m) => ({ ...m, count: moduleMap.get(m.id) ?? 0 }))
    .filter((m) => m.count > 0)
  const moduleBarSegments =
    top.length > 0
      ? top.slice(0, 7).map((m) => ({
          color: m.color,
          w: Math.max(6, Math.round(((moduleMap.get(m.id) ?? 0) / Math.max(1, totalModuleEntries)) * 100)),
        }))
      : sidebarModules.slice(0, 7).map((m) => ({ color: m.color, w: 100 / 7 }))

  const primaryStats = [
    { label: "活跃空间", value: platform.users,       href: platform.topActiveSpaceHref, emptyHint: "等你创建第一个" },
    { label: "公开文章", value: platform.publicPosts, href: "/blog",                     emptyHint: "暂无公开文章" },
    { label: "求职记录", value: platform.jobs,        href: "/jobs",                     emptyHint: "暂无求职数据" },
    { label: "访客访问", value: platform.visits,      href: "/welcome/activity",         emptyHint: "等待第一次访问" },
  ]

  const recommendedSpaces = platform.activeSpaces.slice(0, 4)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.avatarWrap}>
        <div className={styles.avatarCircle}>
          <BigSpaceMark />
        </div>
        <span className={styles.statusPill} aria-live="polite">
          <span className={styles.liveDot} />
          <span style={{ color: "var(--text)" }}>
            {platform.online > 0 ? `当前 ${platform.online} 人在线` : "等待第一位访客"}
            {platform.joined7d > 0 ? ` · 7 天新增 ${platform.joined7d}` : ""}
          </span>
        </span>
      </div>

      <div className={styles.sidebarIdentity}>
        <h1 className={styles.sidebarTitle}>my-space</h1>
        <span className={`${styles.sidebarHandle} ${styles.mono}`}>/@你</span>
      </div>

      <p className={styles.sidebarDesc}>
        一处统御写作、求职、社交的个人空间。
        <strong style={{ color: "var(--text)", fontWeight: 600 }}>每个用户自带一整套模块</strong>
        ，公开还是私人由你决定。
      </p>

      <div className={styles.sidebarCtaStack}>
        <Link href="/register" className={`${styles.btn} ${styles.btnPrimaryHero}`}>
          <Plus size={15} strokeWidth={2} />
          <span>创建你的空间</span>
          <ArrowUpRight size={14} strokeWidth={2} className={styles.heroCtaArrow} />
        </Link>
        <div className={styles.sidebarCtaRow}>
          <Link href="/login" className={styles.sidebarLink}>
            <LogIn size={12} strokeWidth={1.6} /> 登录已有账号
          </Link>
          <span className={styles.sidebarLinkDivider} aria-hidden />
          <Link href={platform.topActiveSpaceHref} className={styles.sidebarLink}>
            <Eye size={12} strokeWidth={1.6} /> 浏览公开空间
          </Link>
        </div>
      </div>

      <section className={styles.sidebarStats} aria-label="平台数据">
        {primaryStats.map((stat) => (
          <Link key={stat.label} href={stat.href} className={styles.sidebarStatCard}>
            <span className={styles.sidebarStatLabel}>{stat.label}</span>
            {stat.value > 0 ? (
              <>
                <span className={`${styles.sidebarStatValue} ${styles.mono}`}>{formatCount(stat.value)}</span>
                <span className={styles.sidebarStatHint}>查看 →</span>
              </>
            ) : (
              <>
                <span className={`${styles.sidebarStatValue} ${styles.mono} ${styles.sidebarStatValueEmpty}`}>—</span>
                <span className={styles.sidebarStatHint}>{stat.emptyHint}</span>
              </>
            )}
          </Link>
        ))}
      </section>

      <div className={styles.sidebarMetaRow}>
        <Sparkles size={11} strokeWidth={1.6} />
        <span>
          {platform.uptimeDays > 0 ? (
            <>上线 <strong style={{ color: "var(--text-2)" }}>{platform.uptimeDays}</strong> 天</>
          ) : (
            <>初次启用中</>
          )}
        </span>
        <span aria-hidden>·</span>
        <Code2 size={11} strokeWidth={1.6} />
        <span>开源 · MIT · {platform.version}</span>
      </div>

      <section className={styles.sidebarSection}>
        <div className={styles.sidebarSectionHead}>
          <h3>平台模块</h3>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>共 {LANDING_MODULES.length} 个</span>
        </div>
        <div className={styles.modulesBar} aria-hidden>
          {moduleBarSegments.map((s, i) => (
            <span key={i} style={{ width: `${s.w}%`, background: s.color }} />
          ))}
        </div>
        <div className={styles.modulesGrid}>
          {sidebarModules.map((m) => {
            const count = moduleMap.get(m.id) ?? 0
            return (
              <Link key={m.id} href={m.href} className={styles.modulesItem}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                <span>{m.cn}</span>
                <span className="badge">{count > 0 ? formatCount(count) : (m.access === "open" ? "公开" : "私")}</span>
              </Link>
            )
          })}
        </div>
        <Link href="/welcome/features" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
          查看全部 {LANDING_MODULES.length} 个模块 →
        </Link>
      </section>

      <section className={styles.sidebarSection}>
        <div className={styles.sidebarSectionHead}>
          <h3>推荐空间</h3>
          {recommendedSpaces.length > 0 ? (
            <Link href={platform.topActiveSpaceHref} style={{ fontSize: 12, color: "var(--accent)" }}>全部 →</Link>
          ) : null}
        </div>
        {recommendedSpaces.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendedSpaces.map((s) => (
              <Link key={s.id} href={s.href} className={styles.spaceRow}>
                <span className={styles.spaceAvatar} style={{ background: s.color }}>
                  {(s.avatarText || s.handle).slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
                    @{s.handle}
                  </div>
                  <div style={{ color: "var(--text-3)", fontSize: 11, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.role}</div>
                </div>
                <span className={styles.mono} style={{ fontSize: 10.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                  <Flame size={10} strokeWidth={1.6} style={{ verticalAlign: "-1px" }} /> {s.posts}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.sidebarEmpty}>
            <Users size={20} strokeWidth={1.4} />
            <p>还没有公开空间。</p>
            <Link href="/register" className={styles.sidebarEmptyLink}>
              来做第一个 <ArrowUpRight size={11} strokeWidth={1.6} />
            </Link>
          </div>
        )}
      </section>

      <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text-4)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Link href="/updates" style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <BookOpen size={11} strokeWidth={1.6} /> 更新日志
        </Link>
        <span aria-hidden>·</span>
        <Link href="/community/resources" style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <PenLine size={11} strokeWidth={1.6} /> 社区资源
        </Link>
        <span aria-hidden>·</span>
        <Link href="/sql" style={{ color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <BriefcaseBusiness size={11} strokeWidth={1.6} /> SQL 实验室
        </Link>
      </div>
    </aside>
  )
}
