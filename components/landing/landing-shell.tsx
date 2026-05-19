import { LANDING_PLATFORM_FALLBACK, type LandingPlatformStats } from "./landing-data"
import { LandingThemeProvider } from "./landing-theme"
import { GlobalHeader, ProjectHeaderStrip } from "./landing-header"
import { BottomCTA, LandingFooter } from "./landing-footer"
import styles from "./landing.module.css"

export type LandingActiveTab =
  | "overview"
  | "spaces"
  | "activity"
  | "posts"
  | "updates"
  | "faq"
  | "features"
  | "preview"
  | "none"

export function LandingShell({
  platform: incoming,
  activeTab = "none",
  children,
  contentClassName,
}: {
  platform?: Partial<LandingPlatformStats>
  activeTab?: LandingActiveTab
  children: React.ReactNode
  contentClassName?: string
}) {
  const platform: LandingPlatformStats = { ...LANDING_PLATFORM_FALLBACK, ...incoming }
  return (
    <LandingThemeProvider>
      <GlobalHeader platform={platform} />
      <ProjectHeaderStrip platform={platform} activeTab={activeTab} />
      <div className={contentClassName ?? styles.subpageShell}>
        {children}
      </div>
      <BottomCTA topActiveSpaceHref={platform.topActiveSpaceHref} />
      <LandingFooter platform={platform} />
    </LandingThemeProvider>
  )
}

export function SubpageHeader({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <header className={styles.subpageHeader}>
      <div className={styles.subpageHeaderInner}>
        {eyebrow ? <span className={styles.subpageEyebrow}>{eyebrow}</span> : null}
        <h1 className={styles.subpageTitle}>{title}</h1>
        {description ? <p className={styles.subpageDesc}>{description}</p> : null}
      </div>
      {trailing ? <div className={styles.subpageTrailing}>{trailing}</div> : null}
    </header>
  )
}
