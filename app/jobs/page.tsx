import { Suspense } from "react"
import { requireAuth } from "@/lib/auth"
import { JobsClient } from "./jobs-client"

export const metadata = { title: "求职追踪 — My Space" }

export default async function JobsPage() {
  await requireAuth()
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-10 text-sm text-[--color-text-muted]">加载中...</div>}>
      <JobsClient />
    </Suspense>
  )
}
