import { LandingShell } from "@/components/landing/landing-shell"
import { UpdatesModule } from "@/components/updates/update-log-module"
import styles from "@/components/updates/update-log.module.css"
import { getCurrentAdmin } from "@/lib/admin"
import { getOptionalSession } from "@/lib/auth"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { getPublicUpdateDetail, getPublicUpdateSummaries, getUpdateComments } from "@/lib/update-log"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "网站建设日志 · my-space",
  description: "把每一次代码变化，整理成用户看得懂、可追溯、可讨论的网站建设记录。",
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ change?: string }>
}) {
  const [{ change }, session, listResult] = await Promise.all([
    searchParams,
    getOptionalSession(),
    getPublicUpdateSummaries({ limit: 20 }),
  ])
  const requestedHash = change?.trim()
  const fallbackHash = listResult.items[0]?.hash
  let detail = requestedHash ? await getPublicUpdateDetail(requestedHash) : null
  if (!detail && fallbackHash) detail = await getPublicUpdateDetail(fallbackHash)
  const comments = detail ? await getUpdateComments(detail.summary.hash) : []

  const admin = session ? await getCurrentAdmin() : null
  const viewer = {
    isAuthenticated: Boolean(session),
    userId: session?.userId ?? null,
    canModerate: Boolean(admin && (admin.role === "owner" || admin.role === "admin")),
  }

  const updatesContent = (
    <UpdatesModule
      shell={session ? "app" : "landing"}
      initialSummaries={listResult.items}
      initialNextCursor={listResult.nextCursor}
      initialDetail={detail}
      initialComments={comments}
      viewer={viewer}
    />
  )

  if (session) {
    return <div className={`${styles.appShell} updates-viewport`}>{updatesContent}</div>
  }

  const platform = await getLandingPlatformStats()
  return (
    <LandingShell platform={platform} activeTab="updates" contentClassName={`${styles.landingShell} updates-viewport`}>
      {updatesContent}
    </LandingShell>
  )
}
