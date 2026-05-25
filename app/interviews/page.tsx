import { Suspense } from "react"
import { ModulePageLoading } from "@/components/loading/app-loading-states"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { InterviewsClient } from "./interviews-client"

export const metadata = { title: "面试记录 — My Space" }

export default async function InterviewsPage() {
  const { userId } = await requireAuth()
  const visibility = await getModuleVisibility(userId, "interviews")
  return (
    <Suspense fallback={<ModulePageLoading stats={4} rows={7} />}>
      <InterviewsClient initialVisibility={visibility} />
    </Suspense>
  )
}
