import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { LandingShell, SubpageHeader } from "@/components/landing/landing-shell"
import {
  ActivityFeedCard,
  ContributionCard,
  LatestWritingCard,
} from "@/components/landing/landing-sections"
import styles from "@/components/landing/landing.module.css"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "平台活跃度 · my-space",
  description: "53 周写入热力图 · 站内动态 · 最近公开文章。来自真实数据库聚合。",
}

export default async function WelcomeActivityPage() {
  const platform = await getLandingPlatformStats()
  return (
    <LandingShell platform={platform} activeTab="activity">
      <Link href="/" className={styles.subpageCrumb}>
        <ArrowLeft size={12} strokeWidth={1.6} /> 返回 my-space 主页
      </Link>
      <SubpageHeader
        eyebrow="ACTIVITY"
        title={<>平台<span style={{ color: "var(--accent)" }}>活跃度</span></>}
        description="所有数字都来自数据库聚合：博客 · 日常 · 心得 · 求职 · 面试 · 留言 · 圆桌。空状态会如实展示，不会编造数字。"
      />
      <ContributionCard platform={platform} />
      <div className={styles.doubleRow}>
        <ActivityFeedCard items={platform.recentActivity} limit={12} />
        <LatestWritingCard posts={platform.recentPosts} limit={8} />
      </div>
    </LandingShell>
  )
}
