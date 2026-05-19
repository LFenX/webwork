import Link from "next/link"
import { ArrowRight, BookOpen, Code2, MessageCircle, Plus } from "lucide-react"
import styles from "./landing.module.css"
import { FooterSpaceMark } from "./landing-mark"
import type { LandingPlatformStats } from "./landing-data"

export function BottomCTA({ topActiveSpaceHref }: { topActiveSpaceHref: string }) {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaInner}>
        <div className={styles.kicker} style={{ color: "var(--accent)", marginBottom: 14 }}>
          → 准备好开始了？
        </div>
        <h2 className={styles.ctaTitle}>
          创建一个空间，<br />
          把<span style={{ color: "var(--accent)" }}>这一年</span>写下来。
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--text-2)", maxWidth: 540, margin: "0 auto 22px", fontFamily: "var(--f-cn-serif)", lineHeight: 1.7 }}>
          免费 · 邀请制 · MIT 开源 · 数据可随时导出。注册后立刻拿到
          {" "}<span className={styles.mono} style={{ color: "var(--text)" }}>/u/yourname</span>{" "}
          的公开主页。
        </p>
        <div className={styles.ctaButtons}>
          <Link href="/register" className={`${styles.btn} ${styles.btnPrimary}`} style={{ padding: "11px 22px", fontSize: 14 }}>
            <Plus size={14} strokeWidth={1.8} /> 创建你的空间 <ArrowRight size={14} strokeWidth={1.8} />
          </Link>
          <Link href="/login" className={styles.btn} style={{ padding: "11px 22px", fontSize: 14 }}>
            登录已有账号
          </Link>
          <Link href={topActiveSpaceHref} className={`${styles.btn} ${styles.btnGhost}`} style={{ padding: "11px 16px", fontSize: 14 }}>
            浏览公开空间 →
          </Link>
        </div>
      </div>
    </section>
  )
}

const FOOTER_COLS = [
  { h: "产品", items: [
    { label: "博客", href: "/blog" },
    { label: "日常", href: "/daily" },
    { label: "心得", href: "/reflections" },
    { label: "更新日志", href: "/updates" },
    { label: "邀请注册", href: "/register" },
  ] },
  { h: "资源", items: [
    { label: "社区资源", href: "/community/resources" },
    { label: "GIF 表情包", href: "/stickers/community" },
    { label: "蝶灵圆桌", href: "/soulwing-roundtable" },
    { label: "SQL 实验室", href: "/sql" },
    { label: "AI 助手", href: "/ai" },
  ] },
  { h: "社区", items: [
    { label: "推荐空间", href: "/welcome/spaces" },
    { label: "好友 · 聊天", href: "/friends" },
    { label: "面试记录", href: "/interviews" },
    { label: "求职追踪", href: "/jobs" },
    { label: "简历", href: "/resume" },
  ] },
  { h: "支持", items: [
    { label: "登录", href: "/login" },
    { label: "注册", href: "/register" },
    { label: "用户设置", href: "/settings" },
    { label: "隐私可见性", href: "/settings/privacy" },
    { label: "更新日志", href: "/updates" },
  ] },
]

export function LandingFooter({ platform }: { platform: LandingPlatformStats }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--text-2)" }}>
            <FooterSpaceMark />
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>my-space</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 14 }}>
            一处属于你的个人空间。<br />
            自部署 · 开源 · MIT 许可。<br />
            中文为主。
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/updates" className={styles.footerSocial} aria-label="更新日志"><Code2 size={13} strokeWidth={1.6} /></Link>
            <Link href="/community/resources" className={styles.footerSocial} aria-label="社区资源"><BookOpen size={13} strokeWidth={1.6} /></Link>
            <Link href="/friends" className={styles.footerSocial} aria-label="讨论"><MessageCircle size={13} strokeWidth={1.6} /></Link>
          </div>
        </div>

        {FOOTER_COLS.map((col) => (
          <div key={col.h} className={styles.footerCol}>
            <h4>{col.h}</h4>
            <ul>
              {col.items.map((it) => (
                <li key={it.label}>
                  <Link href={it.href}>{it.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.footerKicker}>
        <span className={styles.kicker} style={{ color: "var(--text-4)" }}>
          © 2026 MY-SPACE · 构建 {platform.hash} · {platform.version}
          {platform.uptimeDays > 0 ? ` · 运行 ${platform.uptimeDays} 天` : ""}
          {platform.online > 0 ? ` · 在线 ${platform.online} 人` : ""}
        </span>
        <span className={styles.kicker} style={{ color: "var(--text-4)", display: "flex", gap: 12 }}>
          <span style={{ color: "var(--green)" }}>● 系统正常</span>
          <span>·</span>
          <Link href="/settings/privacy" style={{ color: "var(--text-3)" }}>隐私</Link>
          <span>·</span>
          <Link href="/settings" style={{ color: "var(--text-3)" }}>设置</Link>
          <span>·</span>
          <Link href="/updates" style={{ color: "var(--text-3)" }}>许可</Link>
        </span>
      </div>
    </footer>
  )
}
