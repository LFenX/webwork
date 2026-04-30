import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import { ResumeThemesAdminClient } from "./admin-client"

export const metadata = { title: "简历模板管理 — 管理后台" }
export const dynamic = "force-dynamic"

export default async function ResumeThemesAdminPage() {
  const { userId } = await requireAuth()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, displayName: true },
  })

  if (user?.role !== "owner") {
    redirect("/admin")
  }

  return <ResumeThemesAdminClient />
}
