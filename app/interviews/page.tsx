import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { InterviewsClient } from "./interviews-client"

export const metadata = { title: "面试记录 — My Space" }

export default async function InterviewsPage() {
  const { userId } = await requireAuth()
  const visibility = await getModuleVisibility(userId, "interviews")
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-10 text-sm text-[--color-text-muted]">加载中...</div>}>
      <InterviewsClient initialVisibility={visibility} />
    </Suspense>
  )
}
