import { Suspense } from "react"
import { ModulePageLoading } from "@/components/loading/app-loading-states"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { JobsClient } from "./jobs-client"

export const metadata = { title: "求职追踪 — My Space" }

export default async function JobsPage() {
  const { userId } = await requireAuth()
  const visibility = await getModuleVisibility(userId, "jobs")
  return (
    <Suspense fallback={<ModulePageLoading rail rows={7} />}>
      <JobsClient initialVisibility={visibility} />
    </Suspense>
  )
}
