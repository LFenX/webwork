import Link from "next/link"
import { ArrowLeft, Eye, Flame, Plus, Users } from "lucide-react"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { LandingShell, SubpageHeader } from "@/components/landing/landing-shell"
import { ActiveSpacesCard } from "@/components/landing/landing-sections"
import styles from "@/components/landing/landing.module.css"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "公开空间 · my-space",
  description: "按近 30 天写作活跃度排序的公开空间。每一个都是真实用户的真实主页。",
}

export default async function WelcomeSpacesPage() {
  const platform = await getLandingPlatformStats()
  const spaces = platform.activeSpaces

  return (
    <LandingShell platform={platform} activeTab="spaces">
      <Link href="/" className={styles.subpageCrumb}>
        <ArrowLeft size={12} strokeWidth={1.6} /> 返回 my-space 主页
      </Link>
      <SubpageHeader
        eyebrow="SPACES"
        title={<>公开<span style={{ color: "var(--accent)" }}>空间</span></>}
        description="下面这些都是真实在用 my-space 的用户。点头像或卡片进入对方的公开主页，可以看到他们公开的博客、日常、简历、求职动态等。"
        trailing={
          <Link href="/register" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
            <Plus size={12} strokeWidth={1.8} /> 创建你的空间
          </Link>
        }
      />

      <ActiveSpacesCard spaces={spaces} limit={20} />

      {spaces.length > 0 ? (
        <section className={styles.cardGh}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadTitle}>
              <Users size={14} strokeWidth={1.6} />
              <span>全部活跃空间网格</span>
            </div>
            <span className={styles.mono} style={{ fontSize: 11.5, color: "var(--text-3)" }}>{spaces.length} 个</span>
          </div>
          <div className={styles.spacesGrid}>
            {spaces.map((s) => (
              <Link key={s.id} href={s.href} className={styles.spaceGridCard}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-deep)", fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 14 }}>
                  {(s.avatarText || s.handle).slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 600, lineHeight: 1.2 }}>
                    @{s.handle}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.role}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Flame size={10} strokeWidth={1.6} /> {s.posts} 篇公开文章
                    {s.trendPct > 0 ? <span style={{ color: "var(--green)" }}> · +{s.trendPct}%</span> : null}
                  </div>
                </div>
                <Eye size={13} strokeWidth={1.6} style={{ color: "var(--text-3)", marginLeft: "auto" }} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </LandingShell>
  )
}
