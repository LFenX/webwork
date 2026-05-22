"use client"

import {
  Activity,
  BookOpen,
  Eye,
  Flame,
  Lightbulb,
  Pin,
  Tag,
  Users,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { LANDING_PLATFORM_FALLBACK } from "./landing-data"
import { GlobalHeader, ProjectHeaderStrip } from "./landing-header"
import { LandingThemeProvider } from "./landing-theme"
import type { LandingActiveTab } from "./landing-shell"
import styles from "./landing.module.css"

export type LandingLoadingVariant =
  | "overview"
  | "features"
  | "preview"
  | "activity"
  | "spaces"
  | "updates"
  | "faq"

type VariantMeta = {
  activeTab: LandingActiveTab
  eyebrow: string
  titleWidth: string
  descWidth: string
  descWidth2?: string
}

const VARIANT_META: Record<LandingLoadingVariant, VariantMeta> = {
  overview: { activeTab: "overview", eyebrow: "README", titleWidth: "42%", descWidth: "74%" },
  features: { activeTab: "features", eyebrow: "MODULES", titleWidth: "34%", descWidth: "78%", descWidth2: "54%" },
  preview: { activeTab: "preview", eyebrow: "PREVIEW", titleWidth: "38%", descWidth: "76%", descWidth2: "58%" },
  activity: { activeTab: "activity", eyebrow: "ACTIVITY", titleWidth: "30%", descWidth: "70%", descWidth2: "48%" },
  spaces: { activeTab: "spaces", eyebrow: "SPACES", titleWidth: "28%", descWidth: "74%", descWidth2: "46%" },
  updates: { activeTab: "updates", eyebrow: "CHANGELOG", titleWidth: "32%", descWidth: "68%" },
  faq: { activeTab: "faq", eyebrow: "FAQ", titleWidth: "26%", descWidth: "58%" },
}

function variantFromPath(pathname: string | null): LandingLoadingVariant {
  if (!pathname) return "overview"
  if (pathname.startsWith("/welcome/features")) return "features"
  if (pathname.startsWith("/welcome/preview")) return "preview"
  if (pathname.startsWith("/welcome/activity")) return "activity"
  if (pathname.startsWith("/welcome/spaces")) return "spaces"
  if (pathname.startsWith("/welcome/faq")) return "faq"
  if (pathname.startsWith("/updates")) return "updates"
  return "overview"
}

function SkeletonLine({ width, className }: { width: string; className?: string }) {
  return <span className={`${styles.loadingLine} ${className ?? ""}`} style={{ width }} />
}

function SkeletonCard() {
  return (
    <div className={styles.loadingNavCard}>
      <span className={styles.loadingIcon} />
      <SkeletonLine width="44%" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="62%" />
    </div>
  )
}

function LoadingCardChrome({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className={styles.cardHead}>
      <div className={styles.cardHeadTitle}>
        {icon}
        <span>{title}</span>
      </div>
      <span className={styles.loadingTiny}>加载中</span>
    </div>
  )
}

export function LandingLoadingScreen({ variant }: { variant?: LandingLoadingVariant }) {
  const pathname = usePathname()
  const resolvedVariant = variant ?? variantFromPath(pathname)
  const meta = VARIANT_META[resolvedVariant]

  return (
    <LandingThemeProvider pageClassName={styles.page}>
      <GlobalHeader platform={LANDING_PLATFORM_FALLBACK} />
      <ProjectHeaderStrip platform={LANDING_PLATFORM_FALLBACK} activeTab={meta.activeTab} />
      {resolvedVariant === "overview" ? (
        <OverviewLoading />
      ) : (
        <SubpageLoading variant={resolvedVariant} meta={meta} />
      )}
    </LandingThemeProvider>
  )
}

function OverviewLoading() {
  return (
    <div className={styles.shell} aria-busy="true" aria-label="总览加载中" data-loading-variant="overview">
      <aside className={`${styles.sidebar} ${styles.loadingSidebar}`}>
        <span className={styles.loadingAvatar} />
        <div className={styles.loadingCentered}>
          <SkeletonLine width="42%" />
          <SkeletonLine width="78%" />
          <SkeletonLine width="66%" />
        </div>
        <span className={`${styles.loadingLine} ${styles.loadingButton}`} />
        <div className={styles.sidebarStats}>
          <span className={styles.loadingStat} />
          <span className={styles.loadingStat} />
          <span className={styles.loadingStat} />
          <span className={styles.loadingStat} />
        </div>
      </aside>

      <main className={styles.main}>
        <section className={styles.cardGh}>
          <LoadingCardChrome icon={<BookOpen size={14} strokeWidth={1.6} />} title="平台介绍" />
          <div className={styles.loadingIntroBody}>
            <div>
              <SkeletonLine width="58%" />
              <SkeletonLine width="84%" />
              <SkeletonLine width="76%" />
              <span className={styles.loadingQuote} />
              <span className={`${styles.loadingLine} ${styles.loadingCode}`} />
            </div>
            <div>
              <SkeletonLine width="46%" />
              <SkeletonLine width="92%" />
              <SkeletonLine width="86%" />
              <SkeletonLine width="78%" />
              <SkeletonLine width="88%" />
            </div>
          </div>
        </section>

        <section className={styles.navGridInner}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </section>
      </main>
    </div>
  )
}

function SubpageLoading({ variant, meta }: { variant: LandingLoadingVariant; meta: VariantMeta }) {
  return (
    <div className={styles.subpageShell} aria-busy="true" aria-label={`${meta.eyebrow} 加载中`} data-loading-variant={variant}>
      <SkeletonLine width="130px" className={styles.loadingSubpageCrumb} />
      <header className={styles.loadingSubpageHeader}>
        <div className={styles.loadingSubpageCopy}>
          <SkeletonLine width="82px" className={styles.loadingEyebrow} />
          <SkeletonLine width={meta.titleWidth} className={styles.loadingSubpageTitle} />
          <SkeletonLine width={meta.descWidth} />
          {meta.descWidth2 ? <SkeletonLine width={meta.descWidth2} /> : null}
        </div>
        <div className={styles.loadingHeaderActions}>
          <span className={`${styles.loadingLine} ${styles.loadingAction}`} />
          <span className={`${styles.loadingLine} ${styles.loadingAction}`} />
        </div>
      </header>
      {variant === "features" ? <FeaturesLoading /> : null}
      {variant === "preview" ? <PreviewLoading /> : null}
      {variant === "activity" ? <ActivityLoading /> : null}
      {variant === "spaces" ? <SpacesLoading /> : null}
      {variant === "updates" ? <UpdatesLoading /> : null}
      {variant === "faq" ? <FaqLoading /> : null}
    </div>
  )
}

function FeaturesLoading() {
  return (
    <section>
      <LoadingSectionHead icon={<Pin size={13} strokeWidth={1.6} />} title="十四个模块 · 一个空间" />
      <div className={styles.loadingFeatureGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={styles.loadingFeatureCard}>
            <div className={styles.loadingFeatureHead}>
              <span className={styles.loadingIcon} />
              <SkeletonLine width="32%" />
              <span className={`${styles.loadingLine} ${styles.loadingPill}`} />
            </div>
            <SkeletonLine width="88%" />
            <SkeletonLine width="58%" />
            <div className={styles.loadingFeatureMeta}>
              <SkeletonLine width="64px" />
              <SkeletonLine width="52px" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PreviewLoading() {
  return (
    <section>
      <LoadingSectionHead icon={<Eye size={13} strokeWidth={1.6} />} title="登录后你会看到" />
      <div className={`${styles.cardGh} ${styles.loadingCardBody}`}>
        <div className={styles.loadingPreviewMockup}>
          <div className={styles.loadingPreviewMain}>
            <div className={styles.loadingPanel}>
              <span className={styles.loadingAvatarSmall} />
              <div style={{ flex: 1 }}>
                <SkeletonLine width="36%" />
                <SkeletonLine width="62%" />
                <div className={styles.loadingMiniActions}>
                  <span className={`${styles.loadingLine} ${styles.loadingMiniButton}`} />
                  <span className={`${styles.loadingLine} ${styles.loadingMiniButton}`} />
                  <span className={`${styles.loadingLine} ${styles.loadingMiniButton}`} />
                </div>
              </div>
            </div>
            <div className={styles.loadingMetricStrip}>
              {Array.from({ length: 6 }).map((_, i) => <span key={i} className={styles.loadingMetric} />)}
            </div>
            <div className={styles.doubleRow}>
              <span className={styles.loadingPanelTall} />
              <span className={styles.loadingPanelTall} />
            </div>
          </div>
          <aside className={styles.loadingPreviewAside}>
            <span className={styles.loadingPanelTall} />
            <span className={styles.loadingPanelTall} />
            <span className={styles.loadingPanelTall} />
          </aside>
        </div>
      </div>
    </section>
  )
}

function ActivityLoading() {
  return (
    <>
      <section className={styles.cardGh}>
        <LoadingCardChrome icon={<Activity size={14} strokeWidth={1.6} />} title="平台活跃度" />
        <div className={styles.loadingActivityBody}>
          <div className={styles.loadingHeatmap}>
            {Array.from({ length: 53 * 7 }).map((_, i) => <span key={i} className={styles.loadingHeatCell} />)}
          </div>
          <div className={styles.statsRow}>
            {Array.from({ length: 4 }).map((_, i) => <span key={i} className={styles.loadingStatsCell} />)}
          </div>
        </div>
      </section>
      <div className={styles.doubleRow}>
        <LoadingListCard icon={<Activity size={14} strokeWidth={1.6} />} title="站内动态" rows={7} />
        <LoadingListCard icon={<BookOpen size={14} strokeWidth={1.6} />} title="最近公开文章" rows={6} />
      </div>
    </>
  )
}

function SpacesLoading() {
  return (
    <>
      <LoadingListCard icon={<Flame size={14} strokeWidth={1.6} />} title="本月活跃空间" rows={6} avatar />
      <section className={styles.cardGh}>
        <LoadingCardChrome icon={<Users size={14} strokeWidth={1.6} />} title="全部活跃空间网格" />
        <div className={styles.loadingSpacesGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.loadingSpaceCard}>
              <span className={styles.loadingSpaceAvatar} />
              <div style={{ flex: 1 }}>
                <SkeletonLine width="38%" />
                <SkeletonLine width="70%" />
                <SkeletonLine width="54%" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function UpdatesLoading() {
  return (
    <LoadingListCard icon={<Tag size={14} strokeWidth={1.6} />} title="更新日志" rows={8} />
  )
}

function FaqLoading() {
  return (
    <section className={styles.cardGh}>
      <LoadingCardChrome icon={<Lightbulb size={14} strokeWidth={1.6} />} title="常见问题" />
      <div className={styles.loadingFaqGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.loadingFaqItem}>
            <SkeletonLine width="52%" />
            <SkeletonLine width="92%" />
            <SkeletonLine width="66%" />
          </div>
        ))}
      </div>
    </section>
  )
}

function LoadingListCard({
  icon,
  title,
  rows,
  avatar = false,
}: {
  icon: React.ReactNode
  title: string
  rows: number
  avatar?: boolean
}) {
  return (
    <section className={styles.cardGh}>
      <LoadingCardChrome icon={icon} title={title} />
      <div className={styles.loadingList}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.loadingListItem}>
            {avatar ? <span className={styles.loadingSpaceAvatar} /> : <span className={styles.loadingDot} />}
            <div style={{ flex: 1 }}>
              <SkeletonLine width={i % 2 === 0 ? "64%" : "46%"} />
              <SkeletonLine width={i % 2 === 0 ? "82%" : "68%"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function LoadingSectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className={styles.loadingSectionHead}>
      <h3>
        {icon}
        <span>{title}</span>
      </h3>
      <SkeletonLine width="120px" />
    </div>
  )
}
