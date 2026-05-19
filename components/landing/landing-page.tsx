import { LANDING_PLATFORM_FALLBACK, type LandingPlatformStats } from "./landing-data"
import { LandingShell } from "./landing-shell"
import { LandingSidebar } from "./landing-sidebar"
import { LandingMain } from "./landing-sections"
import styles from "./landing.module.css"

export function LandingPage({ platform }: { platform?: Partial<LandingPlatformStats> } = {}) {
  const merged: LandingPlatformStats = { ...LANDING_PLATFORM_FALLBACK, ...platform }
  return (
    <LandingShell platform={merged} activeTab="overview" contentClassName={styles.shell}>
      <LandingSidebar platform={merged} />
      <LandingMain platform={merged} />
    </LandingShell>
  )
}
