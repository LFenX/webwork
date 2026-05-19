import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { LandingShell, SubpageHeader } from "@/components/landing/landing-shell"
import { FAQCard } from "@/components/landing/landing-sections"
import styles from "@/components/landing/landing.module.css"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "常见问题 · my-space",
  description: "数据可导出 · 逐模块可见性 · 自部署 · 蝶灵圆桌 — 高频问题的简短回答。",
}

export default async function WelcomeFaqPage() {
  const platform = await getLandingPlatformStats()
  return (
    <LandingShell platform={platform} activeTab="faq">
      <Link href="/" className={styles.subpageCrumb}>
        <ArrowLeft size={12} strokeWidth={1.6} /> 返回 my-space 主页
      </Link>
      <SubpageHeader
        eyebrow="FAQ"
        title={<>常见<span style={{ color: "var(--accent)" }}>问题</span></>}
        description="如果下面没回答你的问题，可以在「设置」页面查看更详细的隐私可见性与数据导出选项。"
      />
      <FAQCard />
    </LandingShell>
  )
}
