import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { InterviewsClient } from "./interviews-client"

export const metadata = { title: "面试记录 — My Space" }

export default async function InterviewsPage() {
  await requireAuth()
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-10 text-sm text-[--color-text-muted]">加载中...</div>}>
      <InterviewsClient />
    </Suspense>
  )
}
