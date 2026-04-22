import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { InterviewsClient } from "./interviews-client"

export const metadata = { title: "面试记录 — My Space" }

export default async function InterviewsPage() {
  const { userId } = await requireAuth()
  const visibility = await getModuleVisibility(userId, "interviews")
  return (
    <div>
      <div className="max-w-[1200px] mx-auto px-6 pt-6 flex justify-end">
        <ModuleVisibilitySelect module="interviews" initialVisibility={visibility} />
      </div>
      <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-10 text-sm text-[--color-text-muted]">加载中...</div>}>
        <InterviewsClient />
      </Suspense>
    </div>
  )
}
