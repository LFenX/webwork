import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Plus } from "lucide-react"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { LandingShell, SubpageHeader } from "@/components/landing/landing-shell"
import { FeaturesShowcase } from "@/components/landing/landing-sections"
import styles from "@/components/landing/landing.module.css"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "十四个模块 · my-space",
  description: "一个空间统一承载写作、求职、面试、社交、AI 与 SQL，逐项可见性控制。",
}

export default async function WelcomeFeaturesPage() {
  const platform = await getLandingPlatformStats()
  return (
    <LandingShell platform={platform} activeTab="features">
      <Link href="/" className={styles.subpageCrumb}>
        <ArrowLeft size={12} strokeWidth={1.6} /> 返回 my-space 主页
      </Link>
      <SubpageHeader
        eyebrow="MODULES"
        title={<>十四个模块 · <span style={{ color: "var(--accent)" }}>一个空间</span></>}
        description="每个用户登录后都会自动获得这 14 个模块。点击任意卡片直接打开该模块；在「设置 → 隐私可见性」中，你可以为每个模块单独配置 public / friends / private。"
        trailing={
          <>
            <Link href="/register" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
              <Plus size={12} strokeWidth={1.8} /> 创建你的空间
            </Link>
            <Link href="/settings/privacy" className={`${styles.btn} ${styles.btnSm}`}>
              可见性设置 <ArrowUpRight size={12} strokeWidth={1.6} />
            </Link>
          </>
        }
      />
      <FeaturesShowcase platform={platform} expanded />
    </LandingShell>
  )
}
