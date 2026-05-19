import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { LandingShell, SubpageHeader } from "@/components/landing/landing-shell"
import { PersonalHomePreview } from "@/components/landing/landing-sections"
import styles from "@/components/landing/landing.module.css"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "登录后你会看到什么 · my-space",
  description: "登录后的个人主页实景预览：Hero 卡 · 关键指标 · 求职漏斗 · 写作热度 · 访客曲线。",
}

export default async function WelcomePreviewPage() {
  const platform = await getLandingPlatformStats()
  return (
    <LandingShell platform={platform} activeTab="preview">
      <Link href="/" className={styles.subpageCrumb}>
        <ArrowLeft size={12} strokeWidth={1.6} /> 返回 my-space 主页
      </Link>
      <SubpageHeader
        eyebrow="PREVIEW"
        title={<>登录后<span style={{ color: "var(--accent)" }}>你会看到</span>什么</>}
        description="下面这一屏是登录后默认仪表盘的实景预览——基于当前平台上最活跃空间的真实指标渲染。注册后你的主页结构与之相同，数据是属于你自己的。"
        trailing={
          <Link href="/register" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
            <Plus size={12} strokeWidth={1.8} /> 创建你的空间
          </Link>
        }
      />
      <PersonalHomePreview platform={platform} />
    </LandingShell>
  )
}
